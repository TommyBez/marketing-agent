const callbackBaseURL = new URL('https://callback.invalid')

export function safeCallbackURL(value: string | undefined) {
  if (!value?.startsWith('/') || value.includes('\\')) return '/workspace'

  try {
    const callbackURL = new URL(value, callbackBaseURL)
    if (callbackURL.origin !== callbackBaseURL.origin) return '/workspace'
    return `${callbackURL.pathname}${callbackURL.search}${callbackURL.hash}`
  } catch {
    return '/workspace'
  }
}
