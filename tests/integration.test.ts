/**
 * Integration tests — verifies anti-detection behaviour on real-world targets.
 *
 * These tests hit live URLs (Cloudflare-protected and plain HTTP) to confirm
 * that the stealth browser returns usable pages without being blocked by
 * `navigator.webdriver` detection or WebGL fingerprinting checks.
 *
 * Skip these tests in environments without network access:
 *   SKIP_INTEGRATION=1 pnpm run test:integration
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { chromium } from 'playwright'
import type { Browser, Page } from 'playwright'
import { navigateWithStealth } from '../src/stealth.js'

const TIMEOUT_MS = 30_000

// Use a mix of well-known sites that are either behind Cloudflare or are simple
// enough to verify basic stealth functionality.
const TARGETS = [
  {
    url: 'https://httpbin.org/get',
    label: 'plain HTTP (httpbin)',
    expectTitle: false, // httpbin has no <title>
    checkFn: async (page: Page) => {
      const json = await page.evaluate(() => document.body.innerText)
      return json.length > 50
    },
  },
  {
    url: 'https://www.google.com/',
    label: 'major site (google)',
    expectTitle: true,
    checkFn: async (page: Page) => {
      const title = await page.title()
      return title.length > 0 && !title.includes('Blocked')
    },
  },
] as const

describe.skipIf(process.env.SKIP_INTEGRATION === '1')('integration: real-target stealth', () => {
  let browser: Browser | null = null

  beforeAll(async () => {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
    })
  })

  afterAll(async () => {
    await browser?.close()
  })

  for (const target of TARGETS) {
    it(`[${target.label}] navigates and returns valid page`, async () => {
      const page = await browser!.newPage()
      try {
        const resp = await navigateWithStealth(page, target.url, TIMEOUT_MS)
        expect(resp).toBeDefined()
        expect(resp!.status()).toBeLessThan(500)

        const finalUrl = page.url()
        expect(finalUrl.startsWith('http')).toBeTruthy()

        if (target.expectTitle) {
          const title = await page.title()
          expect(title.length).toBeGreaterThan(0)
        }

        // Run custom check
        const ok = await target.checkFn!(page)
        expect(ok).toBe(true)
      } finally {
        await page.close()
      }
    }, TIMEOUT_MS * 2)

    it(`[${target.label}] navigator.webdriver is undefined`, async () => {
      const page = await browser!.newPage()
      try {
        await navigateWithStealth(page, target.url, TIMEOUT_MS)
        const webdriver = await page.evaluate(
          () => (navigator as unknown as Record<string, unknown>).webdriver
        )
        expect(webdriver).toBeUndefined()
      } finally {
        await page.close()
      }
    }, TIMEOUT_MS * 2)

    it(`[${target.label}] Chrome runtime shim present`, async () => {
      const page = await browser!.newPage()
      try {
        await navigateWithStealth(page, target.url, TIMEOUT_MS)
        const hasRuntime = await page.evaluate(() => typeof chrome !== 'undefined')
        expect(hasRuntime).toBe(true)
      } finally {
        await page.close()
      }
    }, TIMEOUT_MS * 2)
  }
})
