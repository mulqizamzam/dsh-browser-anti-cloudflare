import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { chromium } from 'playwright'
import type { Browser } from 'playwright'
import { navigateWithStealth } from '../src/stealth.js'
import { detectWAF, buildCombinedScript } from '../src/waf/detector.js'
const PORT = 19878
const MOCKS = [
  { label: 'akamai', waf: 'akamai', headers: { 'set-cookie': 'ak_bkmk_hash=simulated; path=/', server: 'AkamaiGHost' } },
  { label: 'imperva', waf: 'imperva', headers: { 'x-incap-info': 'simulated', server: 'Incapsula' } },
  { label: 'fastly', waf: 'fastly', headers: { 'x-cache': 'HIT', 'x-served-by': 'cache-iad-test', server: 'Fastly' } },
  { label: 'cloudflare', waf: 'cloudflare', headers: { 'cf-ray': 'simulated-ray', server: 'cloudflare' } },
] as const
describe('passive WAF classification and browser reporting', () => {
  let browser: Browser | null = null
  beforeAll(async () => { browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] }) })
  afterAll(async () => { await browser?.close() })
  for (const mock of MOCKS) {
    it(`classifies ${mock.label} response metadata`, () => {
      expect(detectWAF({ status: 403, headers: mock.headers, body: '' })).toBe(mock.waf)
    })
    it(`reports ${mock.label} on a local authorized fixture`, async () => {
      const http = await import('node:http')
      const server = http.createServer((_req, res) => {
        res.writeHead(200, { 'content-type': 'text/html', ...mock.headers })
        res.end(`<html><body><h1>${mock.label} fixture</h1></body></html>`)
      })
      await new Promise<void>(resolve => server.listen(PORT, '127.0.0.1', resolve))
      const page = await browser!.newPage()
      try {
        const response = await navigateWithStealth(page, `http://127.0.0.1:${PORT}/`, 10000, { allowPrivateNetworks: true })
        expect(response?.status()).toBe(200)
        expect(await page.evaluate(() => (window as Window & { __browserWaf?: string }).__browserWaf)).toBe(mock.waf)
      } finally {
        await page.close()
        await new Promise<void>(resolve => server.close(() => resolve()))
      }
    })
  }
  it('does not inject WAF-specific scripts or browser fingerprint spoofing', () => {
    for (const waf of ['akamai', 'imperva', 'fastly', 'cloudflare', 'unknown'] as const)
      expect(buildCombinedScript(waf)).toBe('')
  })
})
