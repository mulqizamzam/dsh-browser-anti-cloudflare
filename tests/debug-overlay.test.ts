/**
 * Debug overlay tests — verify the development panel script is correct
 * and integrates properly with the stealth module.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { chromium } from 'playwright'
import type { Browser } from 'playwright'
import { navigateWithStealth } from '../src/stealth.js'
import { buildDebugOverlayScript } from '../src/debug-overlay.js'

const PORT = 19881

async function startServer(): Promise<() => void> {
  const http = await import('node:http')
  const srv = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end('<html><body><h1>Debug Test</h1></body></html>')
  })
  await new Promise<void>((resolve) => srv.listen(PORT, '127.0.0.1', resolve))
  return () => new Promise<void>((resolve) => { srv.close(() => resolve()) })
}

describe('debug-overlay: script content', () => {
  it('buildDebugOverlayScript contains required elements', () => {
    const script = buildDebugOverlayScript()
    expect(script).toContain('__stealth-debug-panel')
    expect(script).toContain('webdriver')
    expect(script).toContain('chrome.runtime')
    expect(script).toContain('SharedArrayBuffer')
    expect(script).toContain('platform')
  })

  it('script is a valid IIFE', () => {
    const script = buildDebugOverlayScript()
    expect(script.trim()).toMatch(/^\(\(\) => \{/)
    expect(script.trim()).toMatch(/\}\)\(\)$/)
  })
})

describe('debug-overlay: integration', () => {
  let browser: Browser | null = null
  let closeServer: (() => void) | null = null

  beforeAll(async () => {
    closeServer = await startServer()
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  })
  afterAll(async () => {
    await browser?.close()
    await closeServer?.()
  })

  it('navigateWithStealth completes with debug option without errors', async () => {
    const page = await browser!.newPage()
    try {
      const resp = await navigateWithStealth(page, `http://127.0.0.1:${PORT}/`, 10000, { debug: true })
      expect(resp).toBeDefined()
      expect(resp!.status()).toBe(200)
    } finally {
      await page.close()
    }
  })

  it('navigateWithStealth completes without debug option', async () => {
    const page = await browser!.newPage()
    try {
      const resp = await navigateWithStealth(page, `http://127.0.0.1:${PORT}/`, 10000, { debug: false })
      expect(resp).toBeDefined()
      expect(resp!.status()).toBe(200)
    } finally {
      await page.close()
    }
  })

  it('overlay script does not break existing stealth patches', async () => {
    const page = await browser!.newPage()
    try {
      await navigateWithStealth(page, `http://127.0.0.1:${PORT}/`, 10000, { debug: true })
      const webdriver = await page.evaluate(() => (navigator as unknown as Record<string, unknown>).webdriver)
      expect(webdriver).toBeUndefined()
    } finally {
      await page.close()
    }
  })
})
