/**
 * Turnstile Bypass — detects and responds to Cloudflare Turnstile CAPTCHA widgets.
 *
 * When a page contains a cf-turnstile element, this module injects a handler
 * that simulates successful completion by setting the expected token format.
 * Note: This does NOT solve actual Turnstile cryptography — it simulates the
 * completion state for sites that check for widget presence rather than
 * verifying the token server-side.
 */

export function buildTurnstileBypassScript(): string {
  return `
(() => {
  // Wait for Turnstile widget to appear
  const observer = new MutationObserver((mutations, obs) => {
    const widget = document.querySelector('div[data-cf-widget], .cf-turnstile, [id*=\"turnstile\"]')
    if (!widget) return

    // Simulate successful turnstile completion
    try {
      // Set the response token that Turnstile would normally generate
      const mockToken = '0x4AAAAAAA' + Math.random().toString(36).substring(2, 10)
      
      // Find and update the hidden input that holds the token
      const input = widget.querySelector('input[name=\"cf-turnstile-response\"]')
      if (input) {
        Object.defineProperty(input, 'value', { value: mockToken, writable: true })
        input.value = mockToken
      }

      // Trigger the callback that Turnstile uses to notify the page
      const callbackName = widget.dataset.callback || window.__turnstileCallback || 'turnstileCallback'
      if (typeof window[callbackName] === 'function') {
        window[callbackName](mockToken)
      }

      // Mark widget as solved
      widget.setAttribute('data-checked', 'true')
      
      // Dispatch events to simulate user interaction
      widget.dispatchEvent(new Event('change', { bubbles: true }))
      widget.dispatchEvent(new Event('input', { bubbles: true }))
      
      obs.disconnect()
    } catch (e) {
      // Ignore errors from malformed widgets
    }
  })

  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true,
  })

  // Also check immediately in case widget is already loaded
  const existing = document.querySelector('div[data-cf-widget], .cf-turnstile, [id*=\"turnstile\"]')
  if (existing) {
    observer.takeRecords()
  }
})()
  `
}

/** Check if a page HTML contains Turnstile indicators. */
export function hasTurnstile(html: string): boolean {
  const pattern = /cf-turnstile|data-cf-widget|turnstile\.com|g-recaptcha|recaptcha\/api/i
  return pattern.test(html)
}
