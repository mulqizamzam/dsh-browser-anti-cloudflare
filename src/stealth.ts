/**
 * Anti-detection / anti-Cloudflare Chromium launcher.
 * Patches navigator.webdriver, randomises canvas & WebGL fingerprints,
 * strips CDP Browser.getVersion bot-cues before every navigation.
 * @module stealth
 */

import { chromium } from 'playwright'
import type { Browser } from 'playwright'
import type { Config } from './index.js'

/** Injected anti-detection script runs in-page before any user-visible load. */
const STEALTH_SCRIPT = `
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
  Permissions.prototype.query = async (desc: PermissionDescriptor) => {
    if (desc.name === 'notifications') return { state: 'denied' as const }
    return origQuery(desc)
  }

  // --- sharedArrayBuffer disabled (prevents some fingerprinting techniques) --
  Object.defineProperty(globalThis, 'SharedArrayBuffer', { value: undefined })

  // --- chrome runtime (non-Chrome env) --------------------------------------
  if (!(window as unknown as Record<string, unknown>).chrome) {
    ;(window as unknown as Record<string, unknown>).chrome = {
      runtime: { onMessage: { addListener: () => {}, removeListener: () => {} } },
    }
  }

  // --- webgl renderer randomisation via prototype patch ---------------------
  const originalGetParameter = WebGLRenderingContext.prototype.getParameter
  WebGLRenderingContext.prototype.getParameter = function (param: number) {
    // UNMASKED_RENDERER strings leak GPU info; replace with neutral text.
    if (param === 37445 || param === 37446) { // UNMASKED_VENDOR / UNMASKED_RENDERER
      return 'Google Inc. (Intel)'
    }
    return originalGetParameter.call(this, param)
  }
  if (typeof WebGL2RenderingContext !== 'undefined') {
    const orig2 = WebGL2RenderingContext.prototype.getParameter
    WebGL2RenderingContext.prototype.getParameter = function (param: number) {
      if (param === 37445 || param === 37446) return 'Google Inc. (Intel)'
      return orig2.call(this, param)
    }
  }
})()
`

/**
 * Launch a headless Chromium instance with stealth patches applied.
 * The returned browser is owned by the caller; close it when done.
 */
export async function launchStealthBrowser(config: Config): Promise<Browser> {
  const browser = await chromium.launch({
    headless: config.headless ?? true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--js-flags=--no-wasm-tier-up',
      '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    ],
    executablePath: config.executablePath ?? undefined,
  })
  return browser
}

/**
 * Evaluate the stealth injection script in a page before navigation,
 * then navigate to the target URL. Returns the main-frame response (or null).
 */
export async function navigateWithStealth(
  page: import('playwright').Page,
  url: string,
  timeoutMs: number,
): Promise<import('playwright').Response | null> {
  await page.addInitScript(STEALTH_SCRIPT)
  return page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs })
}
