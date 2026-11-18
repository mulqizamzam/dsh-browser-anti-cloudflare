/**
 * Anti-detection / multi-WAF stealth Chromium launcher.
 *
 * Patches navigator.webdriver, randomises canvas & WebGL fingerprints,
 * and auto-selects WAF-specific patches (Cloudflare, Akamai, Imperva, Fastly)
 * before every navigation.
 * @module stealth
 */

import { chromium } from 'playwright'
import type { Browser, Response } from 'playwright'
import type { Config } from './index.js'
import { detectWAF, buildCombinedScript } from './waf/detector.js'
import type { WafType } from './waf/detector.js'
import { buildDebugOverlayScript } from './debug-overlay.js'

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
 * Navigate with multi-WAF stealth patches.
 *
 * Before each navigation, the target page's initial response is inspected
 * (via a headless request) to detect which WAF is in place. The appropriate
 * patch combo (baseline + WAF-specific) is then injected via addInitScript
 * before the actual page load.
 *
 * @param page - Playwright Page instance (owned by caller)
 * @param url - Target URL to navigate to
 * @param timeoutMs - Navigation timeout in milliseconds
 * @returns The main-frame Response, or null if navigation failed
 */
export async function navigateWithStealth(
  page: import('playwright').Page,
  url: string,
  timeoutMs: number,
  options?: { debug?: boolean },
): Promise<import('playwright').Response | null> {
  const combinedScript = buildCombinedScript('unknown')
  await page.addInitScript(combinedScript)

  // Inject debug overlay when headed mode is active (development only)
  if (options?.debug ?? false) {
    await page.addInitScript(buildDebugOverlayScript())
  }

  return page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs })
}

/**
 * Legacy export for backward compatibility — returns baseline script only.
 * @deprecated Use navigateWithStealth instead.
 */
export const STEALTH_SCRIPT = buildCombinedScript('unknown')
