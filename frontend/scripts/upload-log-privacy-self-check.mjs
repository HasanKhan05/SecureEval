import { assertNoSourceDisclosure } from './upload-log-privacy.mjs'

const sentinel = 'SECUREEVAL_CONTROLLED_LOG_PRIVACY_SENTINEL'

let rejection = null
try {
  assertNoSourceDisclosure({
    backendLog: `controlled backend output ${sentinel}`,
    visibleErrorText: '',
    sensitiveValues: [sentinel],
  })
} catch (error) {
  rejection = error
}

if (!(rejection instanceof Error)) {
  throw new Error('Log privacy assertion accepted a controlled leaked sentinel.')
}
if (rejection.message.includes(sentinel)) {
  throw new Error('Log privacy assertion leaked the sentinel in its error message.')
}

console.log('Controlled backend-log privacy leak was rejected without source disclosure.')
