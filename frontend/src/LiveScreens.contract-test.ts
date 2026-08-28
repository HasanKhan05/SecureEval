import { getLiveEvidenceCopy, hasStaticScoreEvidence } from './LiveScreens'

const uploadEvidence = getLiveEvidenceCopy('upload_static')

const expectedUploadEvidence: {
  eyebrow: 'Exploratory upload analysis'
  syntaxValid: 'Syntax valid'
  functionalTestsUnavailable: 'Functional tests unavailable — uploaded code was not executed.'
  staticOnlyScore: 'Static-only score'
} = uploadEvidence

void expectedUploadEvidence

const validStaticEvidence = {
  baselineSyntax: { valid: true },
  baselineScanStatus: 'completed',
  strategyStatus: 'completed',
  repairedSyntax: { valid: true },
  repairedScanStatus: 'completed',
  scoreBasis: 'static_only',
} as const

const invalidBaselineSyntax = {
  ...validStaticEvidence,
  baselineSyntax: null,
} as const

const invalidBaselineSyntaxValue = {
  ...validStaticEvidence,
  baselineSyntax: { valid: false },
} as const

const invalidRepairedSyntax = {
  ...validStaticEvidence,
  repairedSyntax: null,
} as const

const invalidRepairedSyntaxValue = {
  ...validStaticEvidence,
  repairedSyntax: { valid: false },
} as const

const completedStaticEvidence: true = hasStaticScoreEvidence(validStaticEvidence)
const nullBaselineSuppressesScores: false = hasStaticScoreEvidence(invalidBaselineSyntax)
const invalidBaselineSuppressesScores: false = hasStaticScoreEvidence(invalidBaselineSyntaxValue)
const nullRepairSuppressesScores: false = hasStaticScoreEvidence(invalidRepairedSyntax)
const invalidRepairSuppressesScores: false = hasStaticScoreEvidence(invalidRepairedSyntaxValue)

void [
  completedStaticEvidence,
  nullBaselineSuppressesScores,
  invalidBaselineSuppressesScores,
  nullRepairSuppressesScores,
  invalidRepairSuppressesScores,
]
