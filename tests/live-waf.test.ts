/**
 * Live WAF bypass test — navigates to real-world sites and verifies
 * stealth patches are effective. Run with: pnpm run test live-waf
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { chromium } from 'playwright'
import type { Browser } from 'playwright'
import { writeFileSync } from 'fs'

describe('live-waf: real-world bypass', () => {
  let browser: Browser | null = null

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  })
  afterAll(async () => {
    await browser?.close()
  })

  async function navigateAndCheck(url: string, label: string) {
    const page = await browser!.newPage()
    
    // Full multi-WAF stealth script (matches what lib/index.js produces)
    await page.addInitScript(`
(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
  Object.defineProperty(navigator, 'plugins', { get: () => [{}, {}, {}] })
  Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] })
  const hc = Math.floor(Math.random() * 4) + 4
  Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => hc })
  if (!(window).chrome) {
    (window).chrome = { runtime: { onMessage: { addListener: () => {}, removeListener: () => {} } } }
  }
  const origGP = WebGLRenderingContext.prototype.getParameter
  WebGLRenderingContext.prototype.getParameter = function(p) {
    if (p === 37445 || p === 37446) return 'Google Inc. (Intel)'
    return origGP.call(this, p)
  }
  document.cookie = 'ak_bkmk_hash=simulated; path=/; max-age=31536000'
  document.cookie = 'ak_bdom=1; path=/; max-age=31536000'
  if (!navigator.mediaDevices) {
    Object.defineProperty(navigator, 'mediaDevices', {
      get() { return { enumerateDevices: async () => [], getUserMedia: async () => null } }
    })
  }
})()
    `)
    
    const start = Date.now()
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })
    const elapsed = Date.now() - start
    
    const status = resp!.status()
    const finalUrl = page.url()
    const title = await page.title().catch(() => '')
    const webdriver = await page.evaluate(() => navigator.webdriver).catch(() => 'err')
    const hasChallengeElement = await page.evaluate(() => {
      return document.querySelector('#cf-challenge, #challenge-error-text, .cf-browser-verification, .akamai-challenge') !== null
    }).catch(() => false)

    // For live tests: success = status 200 + valid title + no webdriver flag
    // We don't assert isBlocked because some legitimate sites mention "blocked" in security context
    console.log(`[live-waf] ${label}: status=${status} time=${elapsed}ms webdriver=${webdriver} challenge_elem=${hasChallengeElement}`)
    console.log(`[live-waf]   Title: ${title.substring(0, 80)}`)
    console.log(`[live-waf]   URL: ${finalUrl}`)
    
    const buf = await page.screenshot({ type: 'png' }).catch(() => null)
    if (buf) {
      const fname = `/tmp/live-waf-${label.toLowerCase().replace(/[^a-z]/g, '-')}.png`
      writeFileSync(fname, buf)
    }
    
    await page.close()
    
    return { label, url, status, elapsed, title: title.substring(0, 60), webdriver, finalUrl, hasChallengeElement }
  }

  it('Cloudflare: passes with stealth (status 200, no challenge element)', async () => {
    const r = await navigateAndCheck('https://www.cloudflare.com/', 'cloudflare')
    expect(r.status).toBe(200)
    expect(r.hasChallengeElement).toBe(false)
    expect(r.webdriver).toBeUndefined()
    expect(r.title).toContain('Cloudflare')
  }, 30000)

  it('HTTPBin: plain site works as baseline', async () => {
    const r = await navigateAndCheck('https://httpbin.org/get', 'httpbin')
    expect(r.status).toBe(200)
    expect(r.hasChallengeElement).toBe(false)
    expect(r.webdriver).toBeUndefined()
  }, 30000)
})
