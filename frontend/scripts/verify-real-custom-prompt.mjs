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
try {
  provider = createServer((request, response) => {
    let body = ''
    request.on('data', chunk => { body += chunk })
    request.on('end', () => {
      const payload = JSON.parse(body)
      const contract = payload.response_format?.json_schema?.name
      contracts.push(contract)
      const content = contract === 'GeneratedProgram'
        ? { code: GENERATED }
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
      SECUREEVAL_LLM_API_KEY: 'browser-test-key',
      SECUREEVAL_LLM_MODEL: 'browser-test-model',
      SECUREEVAL_LLM_BASE_URL: 'http://127.0.0.1:8765/v1',
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
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })

  await page.getByRole('button', { name: /Start Demo/ }).click()
  await page.getByRole('button', { name: /Custom Prompt/ }).click()
  await page.getByPlaceholder(/Describe the Python application/).fill(PROMPT)
  await page.getByRole('button', { name: /Generate From Custom Prompt/ }).click()
  await page.getByText('Real AI generation', { exact: true }).waitFor()
  if (await page.getByText('Demo Output', { exact: false }).count()) throw new Error('Custom Prompt displayed fake generated code.')
  await page.getByRole('button', { name: /Configure Security Scan/ }).click()
  await page.getByText('Injection', { exact: true }).first().click()
  await page.getByRole('button', { name: /Run Security Analysis/ }).click()
  await page.getByText('Real AI custom analysis', { exact: true }).waitFor({ timeout: 45_000 })
  await page.getByText(/Generated code, syntax, scanner, and isolated smoke evidence/).waitFor({ timeout: 45_000 })
  await page.getByRole('button', { name: /Select Repair Strategy/ }).click()

  const reportResponse = page.waitForResponse(response => response.request().method() === 'GET'
    && response.status() === 200 && /\/api\/v1\/runs\/run_[0-9a-f]{32}\/report$/.test(response.url()), { timeout: 90_000 })
  await page.getByRole('button', { name: /Run Security Repair \(3\)/ }).click()
  const report = await (await reportResponse).json()
  if (report.evaluation_kind !== 'custom_prompt_smoke') throw new Error('Wrong Custom Prompt evaluation kind.')
  if (report.generation_usage?.input_tokens !== 31 || report.strategy_results.length !== 3) throw new Error('Provider usage or strategies were not persisted.')
  await page.getByText('Real AI repair comparison', { exact: true }).waitFor()
  await page.getByRole('button', { name: /View Final Results/ }).click()
  await page.getByText('Persisted real AI analysis', { exact: true }).waitFor()
  await page.getByText(MARKER, { exact: false }).waitFor()
  await page.getByText('Smoke check', { exact: true }).first().waitFor()

  const expected = ['GeneratedProgram', 'RepairProposal', 'RepairProposal', 'RepairProposal']
  if (JSON.stringify(contracts) !== JSON.stringify(expected)) throw new Error(`Unexpected provider contracts: ${JSON.stringify(contracts)}`)
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByText('Persisted real AI analysis', { exact: true }).waitFor({ timeout: 15_000 })
  await page.getByText(MARKER, { exact: false }).waitFor()
  console.log('Real Custom Prompt provider boundary, three repairs, evidence, and refresh persistence verified.')
} finally {
  await browser?.close().catch(() => {})
  await server?.close().catch(() => {})
  await stopTree(backend).catch(() => {})
  if (provider) await new Promise(done => provider.close(done))
  if (tempRoot) await rm(tempRoot, { recursive: true, force: true }).catch(() => {})
}
