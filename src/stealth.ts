import { chromium } from 'playwright'
import type { Browser, Page, Response } from 'playwright'
import type { Config } from './index.js'
import { assertSafeUrl } from './security.js'
import { detectWAF } from './waf/detector.js'

export async function launchStealthBrowser(config: Config): Promise<Browser> {
  return chromium.launch({
    headless: config.headless ?? true,
    executablePath: config.executablePath ?? undefined,
    args: ['--disable-dev-shm-usage', '--disable-gpu'],
  })
}

/** Navigate only to public HTTP(S) destinations; block private-network subrequests and redirects. */
export async function navigateWithStealth(page: Page, url: string, timeoutMs: number): Promise<Response | null> {
  await assertSafeUrl(url)
  await page.context().route('**/*', async route => {
    try { await assertSafeUrl(route.request().url()); await route.continue() }
    catch { await route.abort('blockedbyclient') }
  })
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs })
  if (response) {
    const headers = await response.allHeaders()
    const body = await page.content().catch(() => '')
    const waf = detectWAF({ status: response.status(), headers, body })
    await page.context().pages()[0]?.evaluate((value) => {
      (window as Window & { __browserWaf?: string }).__browserWaf = value
    }, waf).catch(() => {})
  }
  return response
}
export const STEALTH_SCRIPT = ''
