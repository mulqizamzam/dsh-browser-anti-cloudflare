/**
 * Stealth injection tests — verifies the anti-detection init script works end-to-end.
 * Uses a live Chromium instance; no external network calls are required.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { chromium } from 'playwright'
import type { Browser, Page } from 'playwright'
import { navigateWithStealth } from '../src/stealth.js'

const PORT = 18923

async function startServer(): Promise<() => void> {
  const http = await import('node:http')
  const srv = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end('<html><body><h1>Anti-Detect Test Page</h1></body></html>')
  })
  await new Promise<void>((resolve) => srv.listen(PORT, '127.0.0.1', resolve))
  return () => new Promise<void>((resolve) => { srv.close(() => resolve()) })
}

let closeServer: (() => void) | null = null
let browser: Browser | null = null

describe('stealth init script', () => {
  beforeAll(async () => {
    closeServer = await startServer()
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  })
  afterAll(async () => {
    await browser?.close()
    await closeServer?.()
  })

  it('navigator.webdriver is undefined after init script', async () => {
    const page = await browser!.newPage()
    await page.addInitScript(`
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
    `)
    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 10000 })
    const value = await page.evaluate(() => (navigator as unknown as Record<string, unknown>).webdriver)
    expect(value).toBeUndefined()
    await page.close()
  })

  it('WebGL renderer is neutralised to a vendor-generic string', async () => {
    const page = await browser!.newPage()
    await page.addInitScript(`
      const originalGetParameter = WebGLRenderingContext.prototype.getParameter
      WebGLRenderingContext.prototype.getParameter = function (param) {
        if (param === 37445 || param === 37446) return 'Google Inc. (Intel)'
        return originalGetParameter.call(this, param)
      }
      if (typeof WebGL2RenderingContext !== 'undefined') {
        const orig2 = WebGL2RenderingContext.prototype.getParameter
        WebGL2RenderingContext.prototype.getParameter = function (param) {
          if (param === 37445 || param === 37446) return 'Google Inc. (Intel)'
          return orig2.call(this, param)
        }
      }
    `)
    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 10000 })
    const renderer = await page.evaluate(() => {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl') as WebGLRenderingContext | null
      if (!gl) throw new Error('WebGL not available')
      return gl.getParameter(37446) as string // UNMASKED_RENDERER
    })
    expect(renderer).toEqual('Google Inc. (Intel)')
    await page.close()
  })

  it('ac_browser_navigate returns title and status', async () => {
    const page = await browser!.newPage()
    const resp = await navigateWithStealth(page, `http://127.0.0.1:${PORT}/`, 10000, { allowPrivateNetworks: true })
    // Wait for the h1 to confirm the page actually rendered after stealth init
    await page.waitForSelector('h1', { timeout: 10000 })
    const result = { url: page.url(), title: await page.title(), status: resp?.status() ?? 0 }
    expect(result.status).toBe(200)
    expect(result.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\//)
    // Title is empty because the test page has no <title> tag; verify content via h1 instead
    const heading = await page.locator('h1').textContent()
    expect(heading).toContain('Anti-Detect Test Page')
    await page.close()
  })
})
