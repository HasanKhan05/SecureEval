import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'

import { chromium } from 'playwright-core'
import { preview } from 'vite'

const VALID_SQL_SOURCE = `import sqlite3

def find_user(connection: sqlite3.Connection, username: str) -> dict[str, object] | None:
    query = f"SELECT id, username, role FROM users WHERE username = '{username}'"
    row = connection.execute(query).fetchone()
    if row is None:
        return None
    return {"id": row[0], "username": row[1], "role": row[2]}
`
const INVALID_PYTHON_SOURCE = 'def broken(:\n    return 1\n'
const API_URL = 'http://127.0.0.1:8000/api/v1'
const APP_URL = 'http://127.0.0.1:8443/'

const tempRoot = await mkdtemp(resolve(tmpdir(), 'secureeval-browser-'))
const backendRoot = resolve(process.cwd(), '..', 'backend')
const databasePath = resolve(tempRoot, 'secureeval.db').replaceAll('\\', '/')
const artifactRoot = resolve(tempRoot, 'artifacts')
const workRoot = resolve(tempRoot, 'runs')
const backend = spawn(
  process.env.PYTHON || 'python',
  ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000'],
  {
    cwd: backendRoot,
    env: {
      ...process.env,
      SECUREEVAL_DATABASE_URL: `sqlite:///${databasePath}`,
      SECUREEVAL_ARTIFACT_ROOT: artifactRoot,
      SECUREEVAL_WORK_ROOT: workRoot,
      SECUREEVAL_LLM_API_KEY: '',
      SECUREEVAL_LLM_MODEL: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
)

let backendLog = ''
backend.stdout.on('data', chunk => { backendLog = (backendLog + chunk).slice(-12_000) })
backend.stderr.on('data', chunk => { backendLog = (backendLog + chunk).slice(-12_000) })

async function waitForHealth() {
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${API_URL}/health`)
      if (response.ok) return
    } catch {
      // Server is still starting.
    }
    await new Promise(resolveDelay => setTimeout(resolveDelay, 200))
  }
  throw new Error(`Backend did not become healthy.\n${backendLog}`)
}

async function openUpload(page, source) {
  await page.goto(APP_URL, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Start Demo/ }).click()
  await page.getByRole('button', { name: /Upload Code/ }).click()
  await page.getByRole('button', { name: /Or Paste Python Code/ }).click()
  await page.locator('textarea').first().fill(source)
  await page.getByRole('button', { name: /Start Code Analysis/ }).click()
  await page.getByRole('button', { name: /Configure Security Scan/ }).click()
  await page.getByText('Injection', { exact: true }).first().click()
}

async function startUploadAnalysis(page, source) {
  await openUpload(page, source)
  await page.getByRole('button', { name: /Run Security Analysis/ }).click()
}

async function assertNoStoredSource(page, source) {
  const storedValues = await page.evaluate(() => Object.values(localStorage))
  if (storedValues.some(value => value.includes(source))) {
    throw new Error('Uploaded source was persisted in localStorage.')
  }
}

await waitForHealth()
const server = await preview({
  preview: { host: '127.0.0.1', port: 8443, strictPort: true },
  logLevel: 'silent',
})
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } })

try {
  await page.goto(APP_URL, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })

  await startUploadAnalysis(page, VALID_SQL_SOURCE)
  await assertNoStoredSource(page, VALID_SQL_SOURCE)
  await page.getByText('Exploratory upload analysis', { exact: true }).waitFor({ timeout: 30_000 })
  await page.getByText('Functional tests unavailable — uploaded code was not executed.').first().waitFor()
  await page.getByRole('button', { name: /Select Repair Strategy/ }).click()

  await page.getByRole('button', { name: /Vulnerability-Specific Repair/ }).click()
  await page.getByRole('button', { name: /Test-Feedback Repair/ }).click()
  await page.getByRole('button', { name: /Run Security Repair \(1\)/ }).click()
  await page.getByText('Scanner-Feedback Repair', { exact: true }).waitFor({ timeout: 60_000 })
  await page.getByText('Static-only score', { exact: true }).first().waitFor()
  await page.getByText('Syntax valid', { exact: true }).first().waitFor()
  await page.getByRole('button', { name: /View Final Results/ }).click()

  await page.getByText('Exploratory upload analysis', { exact: true }).waitFor()
  await page.getByText('Syntax valid', { exact: true }).first().waitFor()
  await page.getByText('Functional tests unavailable — uploaded code was not executed.').first().waitFor()
  await page.getByText('Static-only score', { exact: true }).first().waitFor()
  await page.getByText('Bandit · B608', { exact: true }).waitFor()
  await page.getByText('Semgrep · secureeval.python.sql-injection', { exact: true }).waitFor()
  const winner = await page.getByTestId('best-overall-strategy').textContent()
  if (!winner) throw new Error('Upload results did not show a winner.')
  await assertNoStoredSource(page, VALID_SQL_SOURCE)

  await page.reload({ waitUntil: 'networkidle' })
  await page.getByText('Bandit · B608', { exact: true }).waitFor({ timeout: 15_000 })
  const persistedWinner = await page.getByTestId('best-overall-strategy').textContent()
  if (winner !== persistedWinner) {
    throw new Error(`Upload winner did not survive refresh: ${winner} -> ${persistedWinner}`)
  }
  await assertNoStoredSource(page, VALID_SQL_SOURCE)

  await page.evaluate(() => localStorage.clear())
  await page.goto(APP_URL, { waitUntil: 'networkidle' })
  await startUploadAnalysis(page, INVALID_PYTHON_SOURCE)
  await page.getByText(/Invalid Python syntax at line \d+, column \d+:/).waitFor({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Back' }).click()
  await page.getByRole('button', { name: 'Prompt' }).click()
  await page.getByRole('button', { name: /Upload Code/ }).click()
  await page.getByRole('button', { name: /Or Paste Python Code/ }).click()
  await page.locator('textarea').first().fill(VALID_SQL_SOURCE)
  if (!await page.getByRole('button', { name: /Start Code Analysis/ }).isEnabled()) {
    throw new Error('Returning from syntax failure did not allow replacement source.')
  }
  await assertNoStoredSource(page, INVALID_PYTHON_SOURCE)

  await page.evaluate(() => localStorage.clear())
  await page.goto(APP_URL, { waitUntil: 'networkidle' })
  await page.route(`${API_URL}/uploads`, route => route.abort())
  await startUploadAnalysis(page, VALID_SQL_SOURCE)
  await page.getByRole('alert').getByText(/Failed to fetch/).waitFor({ timeout: 8_000 })
  if (await page.getByText('Demo analysis complete', { exact: true }).count()) {
    throw new Error('Upload API failure fell back to simulated analysis.')
  }
  await assertNoStoredSource(page, VALID_SQL_SOURCE)

  console.log('Real upload workflow, static evidence, refresh persistence, syntax failure, API failure, and localStorage privacy verified.')
} finally {
  await browser.close()
  await server.close()
  backend.kill()
  await new Promise(resolveExit => {
    if (backend.exitCode !== null) return resolveExit()
    backend.once('exit', resolveExit)
    setTimeout(resolveExit, 3_000)
  })
  await rm(tempRoot, { recursive: true, force: true })
}
