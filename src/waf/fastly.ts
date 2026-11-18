/**
 * Fastly WAF stealth patches.
 *
 * Fastly detects bots through:
 * - X-Cache headers inspection (Cloud-Fastly patterns)
 * - Timing heuristics (request speed, typing patterns)
 * - TLS fingerprint analysis (JA3/JA4)
 * - HTTP/2 SETTINGS frame consistency
 * - Missing or inconsistent Accept-* headers
 *
 * Note: TLS/Timing patches require CDP-level intervention (handled in
 * launchStealthBrowser args). This module focuses on page-level JS patches.
 */

export function buildFastlyPatches(): string {
  return `
(() => {
  // --- Fetch/XHR header normalisation ---------------------------------------
  // Fastly inspects request headers for bot signatures. Ensure realistic headers.
  const origFetch = window.fetch
  window.fetch = function (input, init = {}) {
    const headers = new Headers(init.headers || {})
    // Ensure realistic Accept headers
    if (!headers.has('Accept')) {
      headers.set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8')
    }
    if (!headers.has('Accept-Language')) {
      headers.set('Accept-Language', 'en-US,en;q=0.9')
    }
    if (!headers.has('Accept-Encoding')) {
      headers.set('Accept-Encoding', 'gzip, deflate, br')
    }
    if (!headers.has('Cache-Control')) {
      headers.set('Cache-Control', 'no-cache')
    }
    return origFetch.call(this, input, { ...init, headers })
  }

  // --- XMLHttpRequest header normalisation ----------------------------------
  const origOpen = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._method = method
    this._url = url
    return origOpen.apply(this, [method, url, ...rest])
  }
  const origSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader
  XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    // Allow normal headers, block bot-signature headers
    const blocked = ['X-Powered-By', 'X-Generator', 'Via']
    if (blocked.includes(name)) return
    return origSetRequestHeader.apply(this, [name, value])
  }

  // --- Performance timing consistency ---------------------------------------
  // Fastly checks if timing data looks automated. Stabilise navigation timing.
  if (performance.mark) {
    const origMark = performance.mark.bind(performance)
    performance.mark = function (name, options) {
      // Normalise mark names to look human-timed
      if (name.startsWith('jsddos') || name.startsWith('hiccup')) {
        return
      }
      return origMark(name, options)
    }
  }

  // --- Resource timing entries sanitisation ---------------------------------
  // Remove entries that reveal automated loading patterns
  const origGetEntries = performance.getEntries.bind(performance)
  performance.getEntries = function () {
    const entries = origGetEntries.call(this)
    return entries.filter(e => {
      // Filter out entries with suspiciously fast timing (< 1ms for non-local)
      if (e.initiatorType === 'navigate' && e.duration < 100) return false
      return true
    })
  }

  // --- Error handler consistency --------------------------------------------
  // Fastly monitors uncaught exceptions as a signal. Ensure clean error handling.
  const origOnError = window.onerror
  window.onerror = function (msg, src, line, col, err) {
    // Suppress noise from stealth scripts themselves
    if (msg && msg.toString().includes('__stealth__')) return true
    return origOnError ? origOnError.call(this, msg, src, line, col, err) : false
  }

  // --- Console.log rate limiting simulation ---------------------------------
  // Automated browsers often have unnaturally fast console output.
  const origLog = console.log
  let logCount = 0
  console.log = function (...args) {
    logCount++
    if (logCount > 100) return // Suppress excessive logging
    return origLog.apply(console, args)
  }
})()
`
}
