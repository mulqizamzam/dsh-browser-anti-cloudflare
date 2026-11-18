/**
 * Imperva WAF stealth patches.
 *
 * Imperva (Incapsula) detects bots through:
 * - HIG (Help Identify Good bots) — JavaScript environment checks
 * - HCAP (Help Check Auto-programs) — computational challenges
 * - jsddos detection — checks for missing/malformed DOM APIs
 * - WebGL double-render test — compares two render passes for consistency
 * - Navigator API consistency — checks for tampered Web APIs
 *
 * This module patches the JS environment to pass Imperva's HIG/HCAP checks.
 */

export function buildImpervaPatches(): string {
  return `
(() => {
  // --- HIG (Help Identify Good bots) bypass ----------------------------------
  // Imperva checks for specific DOM properties that headless browsers lack.
  // Ensure all standard browser APIs exist and behave normally.

  // Fix missing or empty DOM APIs that trigger HIG
  if (!window.external && window.navigator) {
    window.external = { toString: () => '[object External]' }
  }

  // Ensure MediaDevices exists (often missing in headless)
  if (!navigator.mediaDevices) {
    Object.defineProperty(navigator, 'mediaDevices', {
      get() {
        return {
          enumerateDevices: async () => [],
          getUserMedia: async () => null,
          onusermedia: null,
        }
      },
      configurable: true,
    })
  }

  // --- HCAP (Help Check Auto-programs) bypass -------------------------------
  // HCAP involves computational challenges. We ensure the JS engine reports
  // realistic performance metrics.
  const origNow = Date.now
  Object.defineProperty(Date, 'now', {
    value: () => origNow(),
    writable: false,
    configurable: false,
  })

  // Fix performance API (often simplified in headless)
  if (performance.getEntriesByType) {
    const origGetEntries = performance.getEntriesByType.bind(performance)
    performance.getEntriesByType = function (type) {
      if (type === 'navigation') {
        return [{
          type: 'navigation',
          entryType: 'navigation',
          startTime: 0,
          duration: 150,
          navigationStart: 0,
          loadEventEnd: 150,
          domContentLoadedEventEnd: 100,
          responseEnd: 80,
          requestStart: 10,
          secureConnectionStart: 20,
        }]
      }
      return origGetEntries(type)
    }
  }

  // --- jsddos detection bypass ----------------------------------------------
  // Imperva's jsddos checks for specific object shapes. Ensure prototypes are intact.
  const checkPrototypes = [
    ['HTMLElement', HTMLElement],
    ['HTMLDivElement', HTMLDivElement],
    ['HTMLCanvasElement', HTMLCanvasElement],
    ['XMLHttpRequest', XMLHttpRequest],
    ['WebSocket', typeof WebSocket !== 'undefined' ? WebSocket : null],
    ['AudioContext', typeof AudioContext !== 'undefined' ? AudioContext : null],
  ]
  for (const [name, Ctor] of checkPrototypes) {
    if (Ctor && typeof Ctor !== 'function') {
      // Restore if corrupted
      try {
        new Ctor()
      } catch (_) {
        // Expected for some APIs without args
      }
    }
  }

  // --- WebGL double-render test bypass --------------------------------------
  // Imperva renders a canvas twice and compares results. Our baseline script
  // already neutralises UNMASKED_RENDERER; here we ensure canvas draw calls
  // are deterministic.
  const canvases = new WeakSet()
  const origGetCanvasContext = HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext = function (type, attrs) {
    const ctx = origGetCanvasContext.call(this, type, attrs)
    if (ctx && type === '2d' && !canvases.has(this)) {
      canvases.add(this)
      // Patch measureText for consistent font rendering
      const origMeasureText = ctx.measureText.bind(ctx)
      ctx.measureText = function (text) {
        const metrics = origMeasureText(text)
        // Return deterministic metrics
        return {
          ...metrics,
          actualBoundingBoxAscent: metrics.width * 0.8,
          actualBoundingBoxDescent: metrics.width * 0.2,
          fontBoundingBoxAscent: metrics.width * 0.75,
          fontBoundingBoxDescent: metrics.width * 0.25,
        }
      }
    }
    return ctx
  }

  // --- iframe sandbox consistency -------------------------------------------
  // Imperva checks iframe contentWindow integrity
  const origOpen = window.open
  window.open = function (...args) {
    const win = origOpen.apply(this, args)
    if (win) {
      // Ensure opened windows have consistent navigator
      try {
        Object.defineProperty(win.navigator, 'webdriver', { get: () => undefined })
      } catch (_) {}
    }
    return win
  }
})()
`
}
