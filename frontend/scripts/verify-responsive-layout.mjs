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
  uploadedCode: '',
  uploadMeta: null,
  selectedScans: ['injection', 'authentication_authorization', 'secrets', 'input_validation', 'dependency_configuration'],
  selectedStrategies: ['vulnerability_specific_v1', 'scanner_feedback_v1', 'test_feedback_v1'],
}

async function openScreen(screen) {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' })
  await page.evaluate(session => localStorage.setItem('secureeval.demo-session.v1', JSON.stringify(session)), { ...baseSession, screen })
  await page.reload({ waitUntil: 'networkidle' })
}

async function assertNoDocumentOverflow(label) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
  }))
  if (dimensions.document > dimensions.viewport) {
    throw new Error(`${label} overflows the mobile viewport: ${dimensions.document}px document > ${dimensions.viewport}px viewport`)
  }
}

try {
  await openScreen(3)
  await page.getByText('Configure Security Scan', { exact: true }).waitFor()
  await assertNoDocumentOverflow('Scan selection')

  await openScreen(6)
  await page.getByText('Repair Comparison', { exact: true }).waitFor()
  await assertNoDocumentOverflow('Repair comparison progress')
  await page.getByRole('button', { name: /View Final Results/ }).waitFor({ timeout: 8_000 })
  await assertNoDocumentOverflow('Repair comparison results')
  const usageLabel = page.getByText(/Sample Usage —/).first()
  const usageCard = usageLabel.locator('xpath=../..')
  const usageGrid = usageCard.locator('.grid.grid-cols-5')
  const usageWidths = await usageGrid.evaluate(element => ({
    grid: element.getBoundingClientRect().width,
    viewport: element.parentElement?.clientWidth || 0,
  }))
  if (usageWidths.grid <= usageWidths.viewport) {
    throw new Error(`Usage metrics are compressed instead of scrollable: ${usageWidths.grid}px grid <= ${usageWidths.viewport}px viewport`)
  }
  const usageScroll = await usageGrid.evaluate(element => {
    if (!element.parentElement) return 0
    element.parentElement.scrollLeft = 100
    return element.parentElement.scrollLeft
  })
  if (usageScroll === 0) throw new Error('Usage metrics cannot be scrolled horizontally on mobile')

  await openScreen(7)
  await page.getByText('Demo analysis complete', { exact: true }).waitFor()
  await assertNoDocumentOverflow('Results dashboard')

  await page.setViewportSize({ width: 1440, height: 1080 })
  await page.reload({ waitUntil: 'networkidle' })
  await assertNoDocumentOverflow('Desktop results dashboard')
  console.log('Responsive layout verified at 390px and 1440px.')
} finally {
  await browser.close()
  await server.close()
}