import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'

import { chromium } from 'playwright-core'
import { preview } from 'vite'

const API_URL = 'http://127.0.0.1:8000/api/v1'
const APP_URL = 'http://127.0.0.1:8443/'
const backendRoot = resolve(process.cwd(), '..', 'backend')
let backendLog = ''

async function waitForHealth() {
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${API_URL}/health`)).ok) return
    } catch { /* starting */ }
    await new Promise(done => setTimeout(done, 200))
  }
  throw new Error(`Backend did not become healthy.\n${backendLog}`)
}

async function stopTree(child) {
  if (!child || child.exitCode !== null) return
  if (process.platform === 'win32' && child.pid) {
    await new Promise(done => {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true })
      killer.once('error', done)
      killer.once('close', done)
    })
  } else child.kill('SIGKILL')
}

async function assertNoOverflow(page, width, height) {
  await page.setViewportSize({ width, height })
  await page.waitForTimeout(150)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  if (overflow > 1) throw new Error(`Benchmark Results overflowed by ${overflow}px at ${width}px.`)
}

let tempRoot, backend, server, browser
try {
  tempRoot = await mkdtemp(resolve(tmpdir(), 'secureeval-benchmark-browser-'))
  const databasePath = resolve(tempRoot, 'secureeval.db').replaceAll('\\', '/')
  backend = spawn(process.env.PYTHON || 'python', ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000'], {
    cwd: backendRoot,
    env: {
      ...process.env,
      SECUREEVAL_DATABASE_URL: `sqlite:///${databasePath}`,
      SECUREEVAL_ARTIFACT_ROOT: resolve(tempRoot, 'artifacts'),
      SECUREEVAL_WORK_ROOT: resolve(tempRoot, 'runs'),
      OMNIROUTE_API_KEY: '',
      EXPERIMENT_MODEL: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  backend.stdout.on('data', chunk => { backendLog += chunk })
  backend.stderr.on('data', chunk => { backendLog += chunk })

  await waitForHealth()
  server = await preview({ preview: { host: '127.0.0.1', port: 8443, strictPort: true }, logLevel: 'silent' })
  browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } })

  await page.goto(APP_URL, { waitUntil: 'networkidle' })
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  await page.reload({ waitUntil: 'networkidle' })

  await page.getByText('PYTHON SECURITY', { exact: true }).waitFor()
  for (const label of ['Overview', 'Benchmark Lab', 'Analyze Code', 'Generate & Evaluate']) {
    await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('button', { name: label, exact: true }).waitFor()
  }
  await page.getByText('SecureEval checks Python code for security warnings, can ask AI to repair them, and then compares what changed.', { exact: true }).waitFor()
  await page.getByText('Code', { exact: true }).last().waitFor()
  await page.getByText('Compare', { exact: true }).last().waitFor()
  await page.getByText('Research project by Muhammad Hasan Dad Khan · FAST-NUCES', { exact: true }).waitFor()
  await assertNoOverflow(page, 390, 844)
  await assertNoOverflow(page, 1440, 1080)

  await page.getByRole('button', { name: 'Open Benchmark Lab', exact: true }).click()
  await page.getByRole('heading', { name: 'Benchmark Lab — choose a known vulnerable task', exact: true }).waitFor()
  await page.getByText('Official Research', { exact: true }).first().waitFor()
  await assertNoOverflow(page, 390, 844)
  await assertNoOverflow(page, 1440, 1080)

  await page.getByText('User Login Service', { exact: true }).first().click()
  await page.getByRole('button', { name: /Start Baseline Analysis/ }).click()
  await page.getByRole('button', { name: /Choose Repair Approach/ }).waitFor({ timeout: 30_000 })
  const t01BaselineTests = await page.getByTestId('baseline-test-summary').textContent()
  if (t01BaselineTests !== '2 / 2 passed') throw new Error(`T-01 displayed the wrong baseline test count: ${t01BaselineTests}`)

  await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('button', { name: 'Overview', exact: true }).click()
  await page.getByRole('button', { name: 'Open Benchmark Lab', exact: true }).click()
  await page.getByText('Document File Reader', { exact: true }).click()
  await page.getByRole('button', { name: /Start Baseline Analysis/ }).click()
  await page.getByRole('button', { name: /Choose Repair Approach/ }).waitFor({ timeout: 30_000 })
  await page.getByRole('heading', { name: 'Understand the original security problem', exact: true }).waitFor()
  await page.getByTestId('baseline-source').waitFor()
  const baselineSource = await page.getByTestId('baseline-source').textContent()
  if (!baselineSource?.includes('def ')) throw new Error('Screen 3 did not render the real benchmark source.')
  await page.getByText('Semgrep', { exact: true }).first().waitFor()
  const persistedSession = await page.evaluate(() => JSON.parse(sessionStorage.getItem('secureeval.demo-session.v1') ?? '{}'))
  const progressPayload = await (await page.request.get(`${API_URL}/runs/${persistedSession.runId}/progress`)).json()
  if (progressPayload.baseline_tests?.passed !== 2 || progressPayload.baseline_tests?.failed !== 0) {
    throw new Error(`Progress API exposed the wrong baseline test counts: ${JSON.stringify(progressPayload.baseline_tests)}`)
  }
  const baselineTests = await page.getByTestId('baseline-test-summary').textContent()
  if (baselineTests !== '2 / 2 passed') throw new Error(`T-02 displayed the wrong baseline test count: ${baselineTests}`)
  await assertNoOverflow(page, 390, 844)
  await assertNoOverflow(page, 1440, 1080)
  await page.getByRole('button', { name: /Choose Repair Approach/ }).click()
  await page.getByRole('heading', { name: 'Compare three ways to guide the AI repair', exact: true }).waitFor()
  await page.getByText('What the AI receives', { exact: true }).first().waitFor()
  await page.getByText('Why compare it', { exact: true }).first().waitFor()
  await assertNoOverflow(page, 390, 844)
  await assertNoOverflow(page, 1440, 1080)
  await page.getByRole('button', { name: /Run All.*Results/ }).click()
  await page.getByRole('button', { name: /View Final Results/ }).click({ timeout: 120_000 })

  await page.getByText('Benchmark Results', { exact: true }).waitFor()
  await page.getByRole('heading', { name: 'Results — what changed after the repair?', exact: true }).waitFor()
  await page.getByTestId('benchmark-before-after').waitFor()
  const benchmarkColumns = await page.getByTestId('benchmark-before-after').locator(':scope > *').evaluateAll(items => items.map(item => item.getBoundingClientRect().top))
  if (benchmarkColumns.length !== 2 || Math.abs(benchmarkColumns[0] - benchmarkColumns[1]) > 2) throw new Error('Screen 7 did not render side-by-side desktop evidence.')
  const benchmarkHeight = await page.evaluate(() => document.documentElement.scrollHeight)
  if (benchmarkHeight > 2200) throw new Error(`Benchmark Results remained excessively tall: ${benchmarkHeight}px.`)
  await page.getByText('Official Research', { exact: true }).waitFor()
  await page.getByText('A clean scan does not prove the code is fully secure.', { exact: true }).waitFor()
  await page.getByText('Semgrep · secureeval.python.path-traversal', { exact: true }).waitFor()
  await page.getByText('Local Fallback — No LLM Used', { exact: true }).first().waitFor()
  await page.getByText('Security Score', { exact: true }).first().waitFor()
  await page.getByText('Functionality Score', { exact: true }).first().waitFor()
  await page.getByText('Overall Score', { exact: true }).first().waitFor()
  await page.getByText(/2 \/ 2 passed → 2 \/ 2 passed/).first().waitFor()
  const winner = await page.getByTestId('best-overall-strategy').textContent()
  if (!winner) throw new Error('Benchmark Results omitted the backend winner.')

  await assertNoOverflow(page, 390, 844)
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByText('Benchmark Results', { exact: true }).waitFor({ timeout: 15_000 })
  const persistedWinner = await page.getByTestId('best-overall-strategy').textContent()
  if (winner !== persistedWinner) throw new Error(`Winner did not survive refresh: ${winner} -> ${persistedWinner}`)
  await assertNoOverflow(page, 1440, 1080)

  console.log('Real benchmark result, local-fallback provenance, refresh persistence, and 390/1440 responsiveness verified.')
} finally {
  await browser?.close().catch(() => {})
  await server?.close().catch(() => {})
  await stopTree(backend).catch(() => {})
  if (tempRoot) await rm(tempRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 }).catch(() => {})
}
