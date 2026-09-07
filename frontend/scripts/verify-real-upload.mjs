import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'

import { chromium } from 'playwright-core'
import { preview } from 'vite'

import { assertNoSourceDisclosure } from './upload-log-privacy.mjs'

const VALID_SQL_SOURCE = `import sqlite3

def find_user(connection: sqlite3.Connection, username: str) -> dict[str, object] | None:
    query = f"SELECT id, username, role FROM users WHERE username = '{username}'"
    row = connection.execute(query).fetchone()
    if row is None:
        return None
    return {"id": row[0], "username": row[1], "role": row[2]}
`
const CLEAN_SOURCE = `def add(left: int, right: int) -> int:
    return left + right
`
const INVALID_PYTHON_SOURCE = 'def broken(:\n    return 1\n'
const API_URL = 'http://127.0.0.1:8000/api/v1'
const APP_URL = 'http://127.0.0.1:8443/'
const FUNCTIONAL_TESTS_UNAVAILABLE = 'Functional tests unavailable — uploaded code was not executed.'
const BASELINE_STATIC_EVIDENCE = `${FUNCTIONAL_TESTS_UNAVAILABLE} Syntax and scanner evidence are saved; choose repair strategies to continue.`

const backendRoot = resolve(process.cwd(), '..', 'backend')
let backendLog = ''
let backendSpawnError = null

async function waitForHealth() {
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    if (backendSpawnError) throw backendSpawnError
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

async function waitForBackendExit(backend, timeoutMs = 3_000) {
  if (backend.exitCode !== null || backend.signalCode !== null || backendSpawnError) return true
  return await new Promise(resolveExit => {
    let settled = false
    const finish = exited => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      resolveExit(exited)
    }
    const timeout = setTimeout(() => finish(false), timeoutMs)
    backend.once('exit', () => finish(true))
    backend.once('close', () => finish(true))
    backend.once('error', () => finish(true))
  })
}

async function forceTerminateBackendTree(backend) {
  if (process.platform === 'win32' && backend.pid) {
    await new Promise(resolveTermination => {
      const terminator = spawn('taskkill', ['/pid', String(backend.pid), '/t', '/f'], {
        stdio: 'ignore',
        windowsHide: true,
      })
      terminator.once('error', resolveTermination)
      terminator.once('close', resolveTermination)
    })
    return
  }
  try {
    backend.kill('SIGKILL')
  } catch {
    // The backend may already have exited between the status check and signal.
  }
}

async function stopBackend(backend) {
  if (!backend || await waitForBackendExit(backend, 0)) return
  try {
    backend.kill()
  } catch {
    // Fall through to process-tree termination below.
  }
  if (await waitForBackendExit(backend)) return
  await forceTerminateBackendTree(backend)
  if (!await waitForBackendExit(backend)) {
    throw new Error('Backend did not exit after process-tree termination.')
  }
}

async function cleanup({ browser, server, backend, tempRoot }) {
  let cleanupError = null
  for (const close of [
    async () => browser?.close(),
    async () => server?.close(),
  ]) {
    try {
      await close()
    } catch (error) {
      cleanupError ??= error
    }
  }
  let backendStopped = true
  try {
    await stopBackend(backend)
  } catch (error) {
    backendStopped = false
    cleanupError ??= error
  }
  if (backendStopped && tempRoot) {
    try {
      await rm(tempRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 })
    } catch (error) {
      cleanupError ??= error
    }
  }
  if (cleanupError) throw cleanupError
}

async function assertNoOverflow(page, width, height) {
  await page.setViewportSize({ width, height })
  await page.waitForTimeout(150)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  if (overflow > 1) throw new Error(`Analyze Code Results overflowed by ${overflow}px at ${width}px.`)
}

async function openUpload(page, source) {
  await page.goto(APP_URL, { waitUntil: 'networkidle' })
  await page.locator('main').getByRole('button', { name: 'Analyze Code', exact: true }).click()
  await page.getByRole('heading', { name: 'Analyze your own Python code', exact: true }).waitFor()
  await page.getByText('1. Add your code', { exact: true }).waitFor()
  await page.getByText('2. What SecureEval does next', { exact: true }).waitFor()
  await page.getByTestId('analyze-workspace').waitFor()
  const inputColumns = await page.getByTestId('analyze-workspace').locator(':scope > *').evaluateAll(items => items.map(item => item.getBoundingClientRect().top))
  if (inputColumns.length !== 2 || Math.abs(inputColumns[0] - inputColumns[1]) > 2) throw new Error('Screen 5 did not render its two-column desktop workspace.')
  await page.getByRole('button', { name: 'Paste code', exact: true }).click()
  await page.locator('textarea').first().fill(source)
  await page.getByRole('button', { name: /Scan this code/i }).click()
}

async function startUploadAnalysis(page, source) {
  await openUpload(page, source)
}

async function assertNoStoredSource(page, source, visibleErrorText = '') {
  const storedValues = await page.evaluate(() => [
    ...Object.values(localStorage),
    ...Object.values(sessionStorage),
  ])
  if (storedValues.some(value => value.includes(source))) {
    throw new Error('Uploaded source was persisted in browser storage.')
  }
  const alertText = (await page.getByRole('alert').allTextContents()).join('\n')
  assertNoSourceDisclosure({
    backendLog,
    visibleErrorText: `${alertText}\n${visibleErrorText}`,
    sensitiveValues: [source],
  })
}

let tempRoot = null
let backend = null
let server = null
let browser = null

try {
  tempRoot = await mkdtemp(resolve(tmpdir(), 'secureeval-browser-'))
  const databasePath = resolve(tempRoot, 'secureeval.db').replaceAll('\\', '/')
  const artifactRoot = resolve(tempRoot, 'artifacts')
  const workRoot = resolve(tempRoot, 'runs')
  backend = spawn(
    process.env.PYTHON || 'python',
    ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000'],
    {
      cwd: backendRoot,
      env: {
        ...process.env,
        SECUREEVAL_DATABASE_URL: `sqlite:///${databasePath}`,
        SECUREEVAL_ARTIFACT_ROOT: artifactRoot,
        SECUREEVAL_WORK_ROOT: workRoot,
        OMNIROUTE_API_KEY: '',
        NORMAL_ASSISTANT_MODEL: '',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  backend.stdout.on('data', chunk => { backendLog += chunk })
  backend.stderr.on('data', chunk => { backendLog += chunk })
  backend.once('error', error => { backendSpawnError = error })

  await waitForHealth()
  server = await preview({
    preview: { host: '127.0.0.1', port: 8443, strictPort: true },
    logLevel: 'silent',
  })
  browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } })

  await page.goto(APP_URL, { waitUntil: 'networkidle' })
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); })
  await page.reload({ waitUntil: 'networkidle' })

  let strategyRequests = 0
  page.on('request', request => {
    if (request.method() === 'POST' && /\/api\/v1\/runs\/run_[0-9a-f]{32}\/strategies$/.test(request.url())) strategyRequests += 1
  })
  const cleanReportResponse = page.waitForResponse(response =>
    response.request().method() === 'GET'
    && response.status() === 200
    && /^http:\/\/127\.0\.0\.1:8000\/api\/v1\/runs\/run_[0-9a-f]{32}\/report$/.test(response.url()),
    { timeout: 60_000 },
  )
  await startUploadAnalysis(page, CLEAN_SOURCE)
  const cleanReport = await (await cleanReportResponse).json()
  await page.getByText('Analyze Code Results', { exact: true }).waitFor({ timeout: 60_000 })
  await page.getByText('No security findings detected', { exact: true }).waitFor()
  await page.getByText('Repair was not run because there were no findings to repair.', { exact: true }).first().waitFor()
  if (await page.getByTestId('upload-result-state').getAttribute('data-state') !== 'no-repair-needed') throw new Error('Clean upload did not render its no-repair-needed terminal state.')
  if (cleanReport.strategy_results.length !== 0 || cleanReport.best_overall !== null) throw new Error('Clean upload fabricated repair results.')
  if (strategyRequests !== 0) throw new Error('Clean upload called the repair-strategy endpoint.')
  if (await page.getByTestId('upload-before-after').count()) throw new Error('Clean upload rendered an empty repair comparison.')
  if (await page.getByRole('button', { name: /Repair with AI/ }).count()) throw new Error('Clean upload still offered AI repair.')
  await assertNoStoredSource(page, CLEAN_SOURCE)
  await page.getByRole('button', { name: 'Start new evaluation', exact: true }).click()

  await startUploadAnalysis(page, VALID_SQL_SOURCE)
  await assertNoStoredSource(page, VALID_SQL_SOURCE)
  await page.getByText('Exploratory upload analysis', { exact: true }).waitFor({ timeout: 30_000 })
  await page.getByText(BASELINE_STATIC_EVIDENCE, { exact: true }).waitFor()
  await page.getByRole('button', { name: /Repair with AI/ }).click()

  await page.getByRole('button', { name: /Vulnerability-Specific Repair/ }).click()
  await page.getByRole('button', { name: /Test-Feedback Repair/ }).click()
  const initialReportResponse = page.waitForResponse(response =>
    response.request().method() === 'GET'
    && response.status() === 200
    && /^http:\/\/127\.0\.0\.1:8000\/api\/v1\/runs\/run_[0-9a-f]{32}\/report$/.test(response.url()),
    { timeout: 60_000 },
  )
  await page.getByRole('button', { name: /Run 1 Selected/ }).click()
  const initialReport = await (await initialReportResponse).json()
  if (typeof initialReport.run_id !== 'string' || typeof initialReport.best_overall !== 'string') {
    throw new Error('Initial upload report omitted its run ID or winner.')
  }
  await page.getByText('Scanner-Feedback Repair', { exact: true }).waitFor({ timeout: 60_000 })
  await page.getByText('Static-only score', { exact: true }).first().waitFor()
  await page.getByText('Syntax valid', { exact: true }).first().waitFor()
  await page.getByRole('button', { name: /View Final Results/ }).click()

  await page.getByText('Analyze Code Results', { exact: true }).waitFor()
  if (await page.getByTestId('upload-result-state').getAttribute('data-state') !== 'post-repair') throw new Error('Upload result did not render its real post-repair state.')
  await page.getByTestId('upload-before-after').waitFor()
  const uploadColumns = await page.getByTestId('upload-before-after').locator(':scope > *').evaluateAll(items => items.map(item => item.getBoundingClientRect().top))
  if (uploadColumns.length !== 2 || Math.abs(uploadColumns[0] - uploadColumns[1]) > 2) throw new Error('Screen 8 did not render side-by-side desktop evidence.')
  await page.getByText('Bandit and Semgrep inspect the source without running it.', { exact: true }).waitFor()
  await page.getByText('Syntax valid', { exact: true }).first().waitFor()
  const exactFunctionalResults = page.getByText(FUNCTIONAL_TESTS_UNAVAILABLE, { exact: true })
  if (await exactFunctionalResults.count() < 1) {
    throw new Error('Final results omitted exact unavailable functional-test evidence.')
  }
  await exactFunctionalResults.first().waitFor()
  await page.getByText('Static-only score', { exact: true }).first().waitFor()
  await page.getByText('Bandit · B608', { exact: true }).waitFor()
  await page.getByText('Semgrep · secureeval.python.sql-injection', { exact: true }).waitFor()
  const winner = await page.getByTestId('best-overall-strategy').textContent()
  if (!winner) throw new Error('Upload results did not show a winner.')
  await assertNoStoredSource(page, VALID_SQL_SOURCE)
  await assertNoOverflow(page, 390, 844)

  const reloadReportResponse = page.waitForResponse(response =>
    response.request().method() === 'GET'
    && response.status() === 200
    && response.url() === `${API_URL}/runs/${initialReport.run_id}/report`,
    { timeout: 15_000 },
  )
  await page.reload({ waitUntil: 'networkidle' })
  const reloadedReport = await (await reloadReportResponse).json()
  if (reloadedReport.run_id !== initialReport.run_id || reloadedReport.best_overall !== initialReport.best_overall) {
    throw new Error('Reloaded API report did not match the initial persisted upload report.')
  }
  await page.getByText('Bandit · B608', { exact: true }).waitFor({ timeout: 15_000 })
  const persistedWinner = await page.getByTestId('best-overall-strategy').textContent()
  if (winner !== persistedWinner) {
    throw new Error(`Upload winner did not survive refresh: ${winner} -> ${persistedWinner}`)
  }
  await assertNoStoredSource(page, VALID_SQL_SOURCE)
  await assertNoOverflow(page, 1440, 1080)

  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); })
  await page.goto(APP_URL, { waitUntil: 'networkidle' })
  await startUploadAnalysis(page, INVALID_PYTHON_SOURCE)
  const syntaxError = page.getByText(/Invalid Python syntax at line \d+, column \d+:/)
  await syntaxError.waitFor({ timeout: 15_000 })
  await assertNoStoredSource(page, INVALID_PYTHON_SOURCE, await syntaxError.textContent() || '')
  await page.getByRole('button', { name: 'Back' }).click()
  await page.getByRole('heading', { name: 'Analyze your own Python code', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Paste code', exact: true }).click()
  await page.locator('textarea').first().fill(VALID_SQL_SOURCE)
  if (!await page.getByRole('button', { name: /Scan this code/i }).isEnabled()) {
    throw new Error('Returning from syntax failure did not allow replacement source.')
  }

  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); })
  await page.goto(APP_URL, { waitUntil: 'networkidle' })
  let uploadRequestIntercepted = false
  await page.route(`${API_URL}/uploads`, route => {
    if (route.request().method() !== 'POST') return route.continue()
    uploadRequestIntercepted = true
    return route.abort()
  })
  await startUploadAnalysis(page, VALID_SQL_SOURCE)
  await page.getByRole('alert').getByText(/Failed to fetch/).waitFor({ timeout: 8_000 })
  if (!uploadRequestIntercepted) {
    throw new Error('The aborted upload path did not intercept a POST upload request.')
  }
  if (await page.getByText('Demo analysis complete', { exact: true }).count()) {
    throw new Error('Upload API failure fell back to simulated analysis.')
  }
  await assertNoStoredSource(page, VALID_SQL_SOURCE)

  console.log('Clean-scan skip, vulnerable upload repair, static evidence, refresh persistence, failure states, and storage privacy verified.')
} finally {
  await cleanup({ browser, server, backend, tempRoot })
}
