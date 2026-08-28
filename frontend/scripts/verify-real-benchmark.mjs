import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'

import { chromium } from 'playwright-core'
import { preview } from 'vite'

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
      const response = await fetch('http://127.0.0.1:8000/api/v1/health')
      if (response.ok) return
    } catch {
      // Server is still starting.
    }
    await new Promise(resolveDelay => setTimeout(resolveDelay, 200))
  }
  throw new Error(`Backend did not become healthy.\n${backendLog}`)
}

await waitForHealth()
const server = await preview({
  preview: { host: '127.0.0.1', port: 8443, strictPort: true },
  logLevel: 'silent',
})
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } })

try {
  await page.goto('http://127.0.0.1:8443/', { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })

  await page.getByRole('button', { name: /Start Demo/ }).click()
  await page.getByText('Document File Reader', { exact: true }).click()
  await page.getByRole('button', { name: /Run Benchmark Task/ }).click()
  await page.getByRole('button', { name: /Generate Code/ }).click()
  await page.getByRole('button', { name: /Configure Security Scan/ }).waitFor({
    timeout: 8_000,
  })
  await page.getByRole('button', { name: /Configure Security Scan/ }).click()
  await page.getByText('Input Validation', { exact: true }).first().click()
  await page.getByRole('button', { name: /Run Security Analysis/ }).click()

  await page.getByText('Real baseline analysis complete', { exact: true }).waitFor({
    timeout: 30_000,
  })
  await page.getByRole('button', { name: /Select Repair Strategy/ }).click()
  await page.getByRole('button', { name: /Run Security Repair/ }).click()
  await page.getByRole('button', { name: /View Final Results/ }).waitFor({
    timeout: 60_000,
  })
  await page.getByRole('button', { name: /View Final Results/ }).click()

  await page.getByText('Semgrep · secureeval.python.path-traversal', { exact: true }).waitFor()

  await page.getByText(/Persisted result · local_fallback/).waitFor()
  const winner = await page.getByTestId('best-overall-strategy').textContent()

  await page.reload({ waitUntil: 'networkidle' })
  await page.getByText('Semgrep · secureeval.python.path-traversal', { exact: true }).waitFor({
    timeout: 15_000,
  })
  const persistedWinner = await page.getByTestId('best-overall-strategy').textContent()
  if (!winner || winner !== persistedWinner) {
    throw new Error(`Winner did not survive refresh: ${winner} -> ${persistedWinner}`)
  }

  await page.route('http://127.0.0.1:8000/api/v1/**', route => route.abort())
  await page.evaluate(() => localStorage.clear())
  await page.goto('http://127.0.0.1:8443/', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Start Demo/ }).click()
  await page.getByText('Document File Reader', { exact: true }).click()
  await page.getByRole('button', { name: /Run Benchmark Task/ }).click()
  await page.getByRole('button', { name: /Generate Code/ }).click()
  await page.getByRole('button', { name: /Configure Security Scan/ }).click()
  await page.getByText('Input Validation', { exact: true }).first().click()
  await page.getByRole('button', { name: /Run Security Analysis/ }).click()
  await page.getByRole('alert').waitFor({ timeout: 8_000 })
  await page.getByText('Live controlled benchmark', { exact: true }).waitFor()
  if (await page.getByText('Demo analysis complete', { exact: true }).count()) {
    throw new Error('T-02 API failure fell back to simulated analysis.')
  }

  await page.unroute('http://127.0.0.1:8000/api/v1/**')
  await page.route('http://127.0.0.1:8000/api/v1/runs/*/start', route =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        error: {
          code: 'tool_error',
          message: 'Injected start failure.',
          request_id: 'browser-regression',
        },
      }),
    }),
  )
  await page.evaluate(() => localStorage.clear())
  await page.goto('http://127.0.0.1:8443/', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Start Demo/ }).click()
  await page.getByText('Document File Reader', { exact: true }).click()
  await page.getByRole('button', { name: /Run Benchmark Task/ }).click()
  await page.getByRole('button', { name: /Generate Code/ }).click()
  await page.getByRole('button', { name: /Configure Security Scan/ }).click()
  await page.getByText('Input Validation', { exact: true }).first().click()
  await page.getByRole('button', { name: /Run Security Analysis/ }).click()
  await page.getByRole('alert').getByText(/could not be started/i).waitFor({
    timeout: 8_000,
  })
  await page.waitForTimeout(1_000)
  await page.getByRole('alert').getByText(/could not be started/i).waitFor()

  console.log('Real T-02 workflow, refresh persistence, API creation failure, and start failure verified.')
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
