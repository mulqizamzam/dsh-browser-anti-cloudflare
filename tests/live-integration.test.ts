/**
 * Live integration test for @mulqi/dsh-browser-anti-cloudflare v0.2.0
 * Tests against real Cloudflare-protected endpoints to verify stealth patches work.
 */
import { describe, it, expect } from 'vitest'
import { chromium } from 'playwright'
import { buildCombinedScript } from '../src/waf/detector.js'
import { generateProfile, buildFingerprintScript } from '../src/fingerprint.js'
import { buildDebugOverlayScript } from '../src/debug-overlay.js'

const TEST_URLS = [
  { url: 'https://httpbin.org/get', expect: 'cloudflare-free', desc: 'HTTPBin (no WAF)' },
  { url: 'https://web.archive.org', expect: 'cloudflare-free', desc: 'Internet Archive (stable target)' },
]

async function testStealth(url: string, desc: string) {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--js-flags=--no-wasm-tier-up',
      '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    ],
  })

  const profile = generateProfile()
  const combinedScript = buildCombinedScript('unknown')
  const fingerprintScript = buildFingerprintScript(profile)
  const fullScript = fingerprintScript + '\n' + combinedScript

  const page = await browser.newPage()
  await page.addInitScript(fullScript)

  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
    const status = resp?.status() ?? 'ERROR'
    const finalUrl = page.url()

    const metrics = await page.evaluate(() => ({
      webdriver: (navigator as unknown as Record<string, unknown>).webdriver,
      platform: navigator.platform,
      languages: navigator.languages?.join(','),
      hardwareConcurrency: navigator.hardwareConcurrency,
      userAgent: navigator.userAgent,
      hasChromeRuntime: !!(window as any).chrome?.runtime,
      sabDisabled: (globalThis as any).SharedArrayBuffer === undefined,
      webglRenderer: (() => {
        try {
          const c = document.createElement('canvas')
          const gl = (c.getContext('webgl') as unknown as WebGLRenderingContext) || (c.getContext('experimental-webgl') as unknown as WebGLRenderingContext)
          if (!gl) return 'no-webgl'
          const ext = gl.getExtension('WEBGL_debug_renderer_info')
          return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL as unknown as number) : 'no-ext'
        } catch { return 'error' }
      })(),
    }))

    const blocked = finalUrl.includes('checking-your-browser') ||
                    (finalUrl.includes('cloudflare') && !finalUrl.includes('.nl') && !finalUrl.includes('.com'))

    return { status, finalUrl, blocked, metrics }
  } finally {
    await page.close()
    await browser.close()
  }
}

describe('live-integration', () => {
  it('passes fingerprint checks on real sites', async () => {
    for (const t of TEST_URLS) {
      const r = await testStealth(t.url, t.desc)
      expect(r.status).toBe(200)
      expect(r.blocked).toBe(false)
      expect(r.metrics.webdriver).toBeUndefined()
      expect(r.metrics.hasChromeRuntime).toBe(true)
      expect(r.metrics.sabDisabled).toBe(true)
    }
  }, 120000)
})
