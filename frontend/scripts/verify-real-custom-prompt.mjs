import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

import { chromium } from 'playwright-core'
import { preview } from 'vite'

const API_URL = 'http://127.0.0.1:8000/api/v1'
const APP_URL = 'http://127.0.0.1:8443/'
const PROMPT = 'Create a Python function that safely looks up a user by username in SQLite.'
const MARKER = 'provider_generated_lookup'
const CLEAN_MARKER = 'provider_generated_add'
const CLEAN_GENERATED = `def ${CLEAN_MARKER}(left, right):
    return left + right
`
const GENERATED = `def ${MARKER}(connection, username):
    query = f"SELECT id FROM users WHERE username = '{username}'"
    return connection.execute(query).fetchone()
`
const REPAIRED = `def ${MARKER}(connection, username):
    query = "SELECT id FROM users WHERE username = ?"
    return connection.execute(query, (username,)).fetchone()
`
const backendRoot = resolve(process.cwd(), '..', 'backend')
let backendLog = ''

async function listen(server, port) {
  await new Promise((done, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', done)
  })
}

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

async function assertNoOverflow(page, width, height) {
  await page.setViewportSize({ width, height })
  await page.waitForTimeout(150)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  if (overflow > 1) throw new Error(`Generate & Evaluate Results overflowed by ${overflow}px at ${width}px.`)
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

let tempRoot, provider, backend, server, browser
const contracts = []
let generationCount = 0
try {
  provider = createServer((request, response) => {
    let body = ''
    request.on('data', chunk => { body += chunk })
    request.on('end', () => {
      const payload = JSON.parse(body)
      const contract = payload.response_format?.json_schema?.name
      contracts.push(contract)
      if (contract === 'GeneratedProgram') generationCount += 1
      const content = contract === 'GeneratedProgram'
        ? { code: generationCount === 1 ? CLEAN_GENERATED : GENERATED }
        : { repaired_code: REPAIRED, summary: 'Parameterized the generated SQL query.', limitations: ['Smoke execution is not a trusted test suite.'] }
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({
        choices: [{ message: { content: JSON.stringify(content) } }],
        usage: { prompt_tokens: 31, completion_tokens: 19 },
      }))
    })
  })
  await listen(provider, 8765)

  tempRoot = await mkdtemp(resolve(tmpdir(), 'secureeval-custom-browser-'))
  const databasePath = resolve(tempRoot, 'secureeval.db').replaceAll('\\', '/')
  backend = spawn(process.env.PYTHON || 'python', ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000'], {
    cwd: backendRoot,
    env: {
      ...process.env,
      SECUREEVAL_DATABASE_URL: `sqlite:///${databasePath}`,
      SECUREEVAL_ARTIFACT_ROOT: resolve(tempRoot, 'artifacts'),
      SECUREEVAL_WORK_ROOT: resolve(tempRoot, 'runs'),
      OMNIROUTE_API_KEY: 'browser-test-key',
      NORMAL_ASSISTANT_MODEL: 'browser-test-model',
      OMNIROUTE_BASE_URL: 'http://127.0.0.1:8765/v1',
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

  await page.locator('main').getByRole('button', { name: 'Generate Code', exact: true }).click()
  await page.getByPlaceholder(/Write a Python API endpoint/).fill(PROMPT)
  const cleanReportResponse = page.waitForResponse(response => response.request().method() === 'GET'
    && response.status() === 200 && /\/api\/v1\/runs\/run_[0-9a-f]{32}\/report$/.test(response.url()), { timeout: 90_000 })
  await page.getByRole('button', { name: /Generate & Scan/ }).click()
  const cleanReport = await (await cleanReportResponse).json()
  await page.getByText('Generate & Evaluate Results', { exact: true }).waitFor({ timeout: 90_000 })
  await page.getByText('No security findings detected', { exact: true }).waitFor()
  await page.getByText('Repair was not run because there were no findings to repair.', { exact: true }).first().waitFor()
  await page.getByText(CLEAN_MARKER, { exact: false }).first().waitFor()
  if (cleanReport.strategy_results.length !== 0 || cleanReport.best_overall !== null) throw new Error('Clean generation fabricated repair results.')
  if (JSON.stringify(contracts) !== JSON.stringify(['GeneratedProgram'])) throw new Error(`Clean generation invoked repair: ${JSON.stringify(contracts)}`)
  if (await page.getByTestId('custom-before-after').count()) throw new Error('Clean generation rendered an empty repair comparison.')
  await page.getByRole('button', { name: 'Start new evaluation', exact: true }).click()

  await page.locator('main').getByRole('button', { name: 'Generate Code', exact: true }).click()
  await page.getByRole('heading', { name: 'Generate code with AI, then inspect its security', exact: true }).waitFor()
  await page.getByTestId('generation-pipeline').waitFor()
  if (await page.getByTestId('generation-pipeline').locator('[data-pipeline-stage]').count() !== 5) throw new Error('Screen 6 pipeline does not show five compact stages.')
  await page.getByText('2. Generated code', { exact: true }).waitFor()
  await page.getByText('3. Security findings', { exact: true }).waitFor()
  const generatedColumns = await page.getByTestId('generated-workspace').locator(':scope > *').evaluateAll(items => items.map(item => item.getBoundingClientRect().top))
  if (generatedColumns.length !== 2 || Math.abs(generatedColumns[0] - generatedColumns[1]) > 2) throw new Error('Screen 6 did not render its two-column desktop workspace.')
  await page.getByPlaceholder(/Write a Python API endpoint/).fill(PROMPT)
  await page.getByRole('button', { name: /Generate & Scan/ }).click()
  await page.getByText('Baseline Evaluation Ready', { exact: true }).waitFor({ timeout: 45_000 })
  if (await page.getByText('Demo Output', { exact: false }).count()) throw new Error('Custom Prompt displayed fake generated code.')
  await page.getByText('Scanner findings are evidence from configured rules, not proof of exploitability.', { exact: true }).waitFor()
  await page.getByRole('button', { name: /Repair & Compare/ }).click()

  const reportResponse = page.waitForResponse(response => response.request().method() === 'GET'
    && response.status() === 200 && /\/api\/v1\/runs\/run_[0-9a-f]{32}\/report$/.test(response.url()), { timeout: 90_000 })
  await page.getByRole('button', { name: /Run All Repairs/ }).click()
  const report = await (await reportResponse).json()
  if (report.evaluation_kind !== 'custom_prompt_smoke') throw new Error('Wrong Custom Prompt evaluation kind.')
  if (report.generation_usage?.input_tokens !== 31 || report.strategy_results.length !== 3) throw new Error('Provider usage or strategies were not persisted.')
  await page.getByText('Real AI repair comparison', { exact: true }).waitFor()
  await page.getByRole('button', { name: /View Final Results/ }).click()
  await page.getByText('Generate & Evaluate Results', { exact: true }).waitFor()
  await page.getByTestId('custom-before-after').waitFor()
  const customColumns = await page.getByTestId('custom-before-after').locator(':scope > *').evaluateAll(items => items.map(item => item.getBoundingClientRect().top))
  if (customColumns.length !== 2 || Math.abs(customColumns[0] - customColumns[1]) > 2) throw new Error('Screen 9 did not render side-by-side desktop evidence.')
  await page.getByText('What the comparison means', { exact: true }).waitFor()
  await page.getByText('Fewer configured SAST findings are useful evidence, not proof that the program is fully secure.', { exact: true }).waitFor()
  await page.getByText(MARKER, { exact: false }).first().waitFor()
  await page.getByText('Smoke check', { exact: true }).first().waitFor()
  await assertNoOverflow(page, 390, 844)

  const expected = ['GeneratedProgram', 'GeneratedProgram', 'RepairProposal', 'RepairProposal', 'RepairProposal']
  if (JSON.stringify(contracts) !== JSON.stringify(expected)) throw new Error(`Unexpected provider contracts: ${JSON.stringify(contracts)}`)
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByText('Generate & Evaluate Results', { exact: true }).waitFor({ timeout: 15_000 })
  await page.getByText(MARKER, { exact: false }).first().waitFor()
  await assertNoOverflow(page, 1440, 1080)
  console.log('Clean-generation skip, vulnerable three-repair flow, provider boundary, evidence, and refresh persistence verified.')
} finally {
  await browser?.close().catch(() => {})
  await server?.close().catch(() => {})
  await stopTree(backend).catch(() => {})
  if (provider) await new Promise(done => provider.close(done))
  if (tempRoot) await rm(tempRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 }).catch(() => {})
}
