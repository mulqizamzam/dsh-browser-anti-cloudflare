/**
 * WAF-specific integration tests — each test simulates a different WAF's
 * challenge response via a mock server and verifies the stealth module
 * injects the correct patches and returns a clean page.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { chromium } from 'playwright'
import type { Browser } from 'playwright'
import { navigateWithStealth } from '../src/stealth.js'
import { detectWAF, buildCombinedScript } from '../src/waf/detector.js'

const PORT = 19878

type MockServerConfig = {
  label: string
  wafType: ReturnType<typeof detectWAF>
  setupResponse: (res: import('node:http').ServerResponse) => void
}

const MOCK_SERVERS: MockServerConfig[] = [
  {
    label: 'akamai',
    wafType: 'akamai',
    setupResponse: (res) => {
      res.writeHead(200, {
        'Content-Type': 'text/html',
        'Set-Cookie': 'ak_bkmk_hash=simulated; path=/',
        'Server': 'AkamaiGHost',
      })
      res.end('<html><body><h1>Akamai Test Page</h1></body></html>')
    },
  },
  {
    label: 'imperva',
    wafType: 'imperva',
    setupResponse: (res) => {
      res.writeHead(200, {
        'Content-Type': 'text/html',
        'X-Incap-Info': 'simulated',
        'Server': 'Incapsula',
      })
      res.end('<html><body><h1>Imperva Test Page</h1></body></html>')
    },
  },
  {
    label: 'fastly',
    wafType: 'fastly',
    setupResponse: (res) => {
      res.writeHead(200, {
        'Content-Type': 'text/html',
        'X-Cache': 'HIT',
        'X-Served-By': 'cache-iad-kiad4630138-IAD',
        'Server': 'Fastly',
      })
      res.end('<html><body><h1>Fastly Test Page</h1></body></html>')
    },
  },
  {
    label: 'cloudflare',
    wafType: 'cloudflare',
    setupResponse: (res) => {
      res.writeHead(200, {
        'Content-Type': 'text/html',
        'Set-Cookie': '__cfduid=simulated; path=/',
        'CF-Ray': 'simulated-ray',
        'Server': 'cloudflare',
      })
      res.end('<html><body><h1>Cloudflare Test Page</h1></body></html>')
    },
  },
]

describe('waf: detection & patching', () => {
  let browser: Browser | null = null

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  })
  afterAll(async () => {
    await browser?.close()
  })

  for (const cfg of MOCK_SERVERS) {
    it(`[${cfg.label}] detects correct WAF type`, async () => {
      const http = await import('node:http')
      const srv = http.createServer((_, res) => cfg.setupResponse(res))
      await new Promise<void>((resolve) => srv.listen(PORT + 1, '127.0.0.1', resolve))
      try {
        // Fetch the raw response to test detection
        const resp = await fetch(`http://127.0.0.1:${PORT + 1}/`)
        const headers: Record<string, string> = {}
        resp.headers.forEach((v, k) => { headers[k.toLowerCase()] = v })
        const body = await resp.text()

        const detected = detectWAF({ status: resp.status, headers, body })
        expect(detected).toBe(cfg.wafType)
      } finally {
        await new Promise<void>((resolve) => srv.close(() => resolve()))
      }
    })

    it(`[${cfg.label}] navigation succeeds with stealth patches`, async () => {
      const http = await import('node:http')
      const srv = http.createServer((_, res) => cfg.setupResponse(res))
      await new Promise<void>((resolve) => srv.listen(PORT + 2, '127.0.0.1', resolve))
      const page = await browser!.newPage()
      try {
        const resp = await navigateWithStealth(page, `http://127.0.0.1:${PORT + 2}/`, 10000)
        expect(resp).toBeDefined()
        expect(resp!.status()).toBe(200)
        expect(page.url()).toMatch(/^http:\/\/127\.0\.0\.1:\d+\//)

        // Verify baseline stealth is active
        const webdriver = await page.evaluate(
          () => (navigator as unknown as Record<string, unknown>).webdriver
        )
        expect(webdriver).toBeUndefined()

        // Verify chrome shim is present
        const hasChrome = await page.evaluate(
          () => typeof (window as unknown as Record<string, unknown>).chrome !== 'undefined'
        )
        expect(hasChrome).toBe(true)
      } finally {
        await page.close()
        await new Promise<void>((resolve) => srv.close(() => resolve()))
      }
    })
  }

  it('buildCombinedScript includes WAF-specific patches', () => {
    const akamaiScript = buildCombinedScript('akamai')
    const impervaScript = buildCombinedScript('imperva')
    const fastlyScript = buildCombinedScript('fastly')
    const cfScript = buildCombinedScript('cloudflare')
    const unknownScript = buildCombinedScript('unknown')

    // Each script should contain baseline content
    expect(akamaiScript).toContain('navigator.webdriver')
    expect(impervaScript).toContain('navigator.webdriver')
    expect(fastlyScript).toContain('navigator.webdriver')
    expect(cfScript).toContain('navigator.webdriver')
    expect(unknownScript).toContain('navigator.webdriver')

    // Akamai-specific content
    expect(akamaiScript).toContain('ak_bkmk_hash')
    expect(akamaiScript).not.toContain('jsddos')

    // Imperva-specific content
    expect(impervaScript).toContain('jsddos')
    expect(impervaScript).not.toContain('ak_bkmk_hash')

    // Fastly-specific content
    expect(fastlyScript).toContain('origFetch')
    expect(fastlyScript).not.toContain('ak_bkmk_hash')

    // Cloudflare and unknown use baseline only
    expect(cfScript).not.toContain('jsddos')
    expect(cfScript).not.toContain('ak_bkmk_hash')
    expect(unknownScript).not.toContain('jsddos')
  })
})
