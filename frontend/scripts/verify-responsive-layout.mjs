import { chromium } from 'playwright-core'
import { preview } from 'vite'

const server = await preview({
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  logLevel: 'silent',
})
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })

const baseSession = {
  mode: 'benchmark',
  selectedTaskId: 'T-01',
  customPrompt: '',
  uploadMeta: null,
  selectedScans: ['injection', 'authentication_authorization', 'secrets', 'input_validation', 'dependency_configuration'],
  selectedStrategies: ['vulnerability_specific_v1', 'scanner_feedback_v1', 'test_feedback_v1'],
  runId: null,
  liveRequested: false,
}

async function openScreen(screen, overrides = {}) {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' })
  await page.evaluate(session => {
    sessionStorage.setItem('secureeval.demo-session.v1', JSON.stringify(session))
    localStorage.setItem('secureeval.demo-session.v1', JSON.stringify(session))
  }, { ...baseSession, ...overrides, screen })
  await page.reload({ waitUntil: 'networkidle' })
}

async function assertNoDocumentOverflow(label) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    legacyLightUi: [...document.querySelectorAll('*')].some(element => typeof element.className === 'string' && element.className.includes('bg-[#F7F5F0]')),
  }))
  if (dimensions.document > dimensions.viewport) {
    throw new Error(`${label} overflows: ${dimensions.document}px document > ${dimensions.viewport}px viewport`)
  }
  if (dimensions.legacyLightUi) throw new Error(`${label} rendered reachable legacy light UI.`)
}

async function verify(width, height) {
  await page.setViewportSize({ width, height })
  await openScreen(1, { mode: 'upload', selectedTaskId: null })
  await page.getByRole('heading', { name: 'Analyze your own Python code', exact: true }).waitFor()
  await assertNoDocumentOverflow(`Analyze Your Code ${width}px`)

  await openScreen(1, {
    mode: 'custom',
    selectedTaskId: null,
    customPrompt: 'Create a Python function that safely parses a JSON document.',
  })
  await page.getByRole('heading', { name: 'Generate code with AI, then inspect its security', exact: true }).waitFor()
  await assertNoDocumentOverflow(`Generate & Evaluate ${width}px`)

  await openScreen(2)
  await page.getByText('This step is no longer part of the current flow', { exact: true }).waitFor()
  await assertNoDocumentOverflow(`Retired route 2 ${width}px`)

  await openScreen(3)
  await page.getByText('This step is no longer part of the current flow', { exact: true }).waitFor()
  await assertNoDocumentOverflow(`Retired route 3 ${width}px`)

  const liveRun = {
    runId: `run_${'a'.repeat(32)}`,
    liveRequested: true,
    selectedTaskId: null,
  }
  await openScreen(4, { ...liveRun, mode: 'upload' })
  await page.getByRole('heading', { name: 'Analyze Your Code', exact: true }).waitFor()
  await assertNoDocumentOverflow(`Dark upload analysis route ${width}px`)

  await openScreen(5, { ...liveRun, mode: 'upload' })
  await page.getByText('Compare three ways to guide the AI repair', { exact: true }).waitFor()
  await assertNoDocumentOverflow(`Dark upload strategy route ${width}px`)

  await openScreen(6)
  await page.getByText('No active repair run', { exact: true }).waitFor()
  await assertNoDocumentOverflow(`Honest repair empty state ${width}px`)

  await openScreen(7)
  await page.getByText('No persisted report available', { exact: true }).waitFor()
  await assertNoDocumentOverflow(`Honest results empty state ${width}px`)
}

try {
  await verify(390, 844)
  await verify(1440, 1080)
  console.log('Core dark screens, retired routes, and honest empty states verified at 390px and 1440px.')
} finally {
  await browser.close()
  await server.close()
}