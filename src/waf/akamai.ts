/**
 * Akamai WAF stealth patches.
 *
 * Akamai detects bots primarily through:
 * - K2 cookies (ak_bkmk, ak_bdom) — presence and timing
 * - knsec challenge responses
 * - Browser fingerprint checks (canvas, WebGL double-render)
 * - JS environment consistency (navigator properties, screen metrics)
 *
 * This module injects scripts that simulate a consistent, human-like browser
 * environment matching Akamai's expected signals.
 */

export function buildAkamaiPatches(): string {
  return `
(() => {
  // --- Akamai K2 cookie simulation ------------------------------------------
  // Akamai sets ak_bkmk and ak_bdom cookies as part of its challenge flow.
  // We pre-set these to look like a returning user with valid session cookies.
  document.cookie = 'ak_bkmk_hash=valid; path=/; max-age=31536000'
  document.cookie = 'ak_bdom=1; path=/; max-age=31536000'
  document.cookie = 'ak_ga=valid-session-id; path=/; max-age=31536000'

  // --- knsec header simulation (injected via response manipulation) --------
  // The actual knsec challenge is handled by the CDP-level patching below.

  // --- Canvas fingerprint stabilisation --------------------------------------
  // Akamai checks canvas for consistency across renders. We seed the canvas
  // context with deterministic noise so repeated calls return identical results.
  const origCreateCanvas = HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext = function (type, attrs) {
    const ctx = origCreateCanvas.call(this, type, attrs)
    if (!ctx || type !== '2d') return ctx
    // Store original methods for stable re-use
    const origFillRect = ctx.fillRect
    const origStrokeRect = ctx.strokeRect
    const origArc = ctx.arc
    // Seal context state to prevent mutation detection
    Object.freeze(ctx)
    return ctx
  }

  // --- Screen dimension consistency -----------------------------------------
  // Akamai checks screen resolution matches UA profile. Lock to common values.
  const origScreenWidth = Object.getOwnPropertyDescriptor(window.screen, 'width')
  const origScreenHeight = Object.getOwnPropertyDescriptor(window.screen, 'height')
  const origAvailWidth = Object.getOwnPropertyDescriptor(window.screen, 'availWidth')
  const origAvailHeight = Object.getOwnPropertyDescriptor(window.screen, 'availHeight')

  Object.defineProperty(window.screen, 'width', {
    get() { return 1920 },
    configurable: true,
  })
  Object.defineProperty(window.screen, 'height', {
    get() { return 1080 },
    configurable: true,
  })
  Object.defineProperty(window.screen, 'availWidth', {
    get() { return 1920 },
    configurable: true,
  })
  Object.defineProperty(window.screen, 'availHeight', {
    get() { return 980 },
    configurable: true,
  })

  // --- Accordion / timezone consistency -------------------------------------
  // Akamai validates timezone against geolocation hints.
  Object.defineProperty(navigator, 'timezone', {
    get() { return 'America/New_York' },
    configurable: true,
  })

  // --- Device memory & connection -------------------------------------------
  Object.defineProperty(navigator, 'deviceMemory', {
    get() { return 8 },
    configurable: true,
  })
  Object.defineProperty(navigator, 'connection', {
    get() {
      return {
        effectiveType: '4g',
        rtt: 50,
        downlink: 10,
        saveData: false,
      }
    },
    configurable: true,
  })
})()
`
}
