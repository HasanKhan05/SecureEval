export function assertNoSourceDisclosure({ backendLog, visibleErrorText, sensitiveValues }) {
  if ([backendLog, visibleErrorText].some(text => sensitiveValues.some(value => value && text.includes(value)))) {
    throw new Error('Upload source was disclosed by backend output or visible error text.')
  }
}
