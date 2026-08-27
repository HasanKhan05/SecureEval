import { getLiveEvidenceCopy } from './LiveScreens'

const uploadEvidence = getLiveEvidenceCopy('upload_static')

const expectedUploadEvidence: {
  eyebrow: 'Exploratory upload analysis'
  syntaxValid: 'Syntax valid'
  functionalTestsUnavailable: 'Functional tests unavailable — uploaded code was not executed.'
  staticOnlyScore: 'Static-only score'
} = uploadEvidence

void expectedUploadEvidence
