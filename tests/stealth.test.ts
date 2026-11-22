import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { chromium } from 'playwright'
import type { Browser } from 'playwright'
import { navigateWithStealth, STEALTH_SCRIPT } from '../src/stealth.js'
const PORT = 18923
async function startServer(): Promise<() => void> {
  const http = await import('node:http')
  const server = http.createServer((_req, res) => { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<html><body><h1>Authorized test page</h1></body></html>') })
  await new Promise<void>(resolve => server.listen(PORT, '127.0.0.1', resolve))
  return () => new Promise<void>(resolve => server.close(() => resolve()))
}
describe('safe browser navigation', () => {
  let browser: Browser | null = null
  let closeServer: (() => void) | null = null
  beforeAll(async () => { closeServer = await startServer(); browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] }) })
  afterAll(async () => { await browser?.close(); await closeServer?.() })
  it('does not inject browser fingerprint spoofing scripts', () => { expect(STEALTH_SCRIPT).toBe('') })
  it('navigates to an explicitly allowed local test endpoint', async () => {
    const page = await browser!.newPage()
    try {
      const response = await navigateWithStealth(page, `http://127.0.0.1:${PORT}/`, 10000, { allowPrivateNetworks: true })
      expect(response?.status()).toBe(200)
      expect(await page.locator('h1').textContent()).toBe('Authorized test page')
    } finally { await page.close() }
  })
  it('blocks local destinations by default', async () => {
    const page = await browser!.newPage()
    try { await expect(navigateWithStealth(page, `http://127.0.0.1:${PORT}/`, 10000)).rejects.toThrow() }
    finally { await page.close() }
  })
})
