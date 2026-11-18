/**
 * Baseline anti-detection script — shared across all WAF types.
 * This is the universal stealth layer that runs on every navigation regardless
 * of which WAF (if any) is detected behind it.
 */

export function buildBaselineScript(): string {
  return `
(() => {
  // --- navigator.webdriver removal -------------------------------------------
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined })

  // --- plugin length (looks like real Chrome) ---------------------------------
  Object.defineProperty(navigator, 'plugins', {
    get: () => [{}, {}, {}],
  })

  // --- languages (realistic English locale) ----------------------------------
  Object.defineProperty(navigator, 'languages', {
    get: () => ['en-US', 'en'],
  })

  // --- platform spoof --------------------------------------------------------
  const platform = typeof navigator.platform === 'string' ? navigator.platform : 'Linux x86_64'
  Object.defineProperty(navigator, 'platform', { get: () => platform })

  // --- hardware concurrency (randomised within realistic range) -------------
  const hc = Math.floor(Math.random() * 4) + 4 // 4–7 cores
  Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => hc })

  // --- permissions query override -------------------------------------------
  const origQuery = Permissions.prototype.query.bind(Permissions.prototype)
  Permissions.prototype.query = async (desc) => {
    if (desc.name === 'notifications') return { state: 'denied' }
    return origQuery(desc)
  }

  // --- sharedArrayBuffer disabled (prevents some fingerprinting techniques) --
  Object.defineProperty(globalThis, 'SharedArrayBuffer', { value: undefined })

  // --- chrome runtime shim (for non-Chrome envs) ----------------------------
  if (!(window).chrome) {
    (window).chrome = {
      runtime: { onMessage: { addListener: () => {}, removeListener: () => {} } },
    }
  }

  // --- webgl renderer neutralisation via prototype patch --------------------
  const originalGetParameter = WebGLRenderingContext.prototype.getParameter
  WebGLRenderingContext.prototype.getParameter = function (param) {
    if (param === 37445 || param === 37446) { // UNMASKED_VENDOR / UNMASKED_RENDERER
      return 'Google Inc. (Intel)'
    }
    return originalGetParameter.call(this, param)
  }
  if (typeof WebGL2RenderingContext !== 'undefined') {
    const orig2 = WebGL2RenderingContext.prototype.getParameter
    WebGL2RenderingContext.prototype.getParameter = function (param) {
      if (param === 37445 || param === 37446) return 'Google Inc. (Intel)'
      return orig2.call(this, param)
    }
  }
})()
`
}
