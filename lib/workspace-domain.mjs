/**
 * @param {string} value
 * @returns {string}
 */
export function normalizeWorkspaceDomain(value) {
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) {
    throw new TypeError('Workspace URLs must use HTTP or HTTPS and include a hostname')
  }

  return url.hostname.replace(/^www\./, '').toLowerCase()
}
