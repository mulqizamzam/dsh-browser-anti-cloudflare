/**
 * Integration tests — end-to-end verification of the stealth module.
 * Uses a local HTTP server (no external network required).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { chromium } from 'playwright'
import type { Browser, Page } from 'playwright'
import { navigateWithStealth } from '../src/stealth.js'

const PORT = 19877

async function startServer(): Promise<() => void> {
  const http = await import('node:http')
  const srv = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(`<!DOCTYPE html><html><head><title>Test</title></head><body><h1>OK</h1></body></html>`)
  })
  await new Promise<void>((resolve) => srv.listen(PORT, '127.0.0.1', resolve))
  return () => new Promise<void>((resolve) => { srv.close(() => resolve()) })
}

describe('integration: navigateWithStealth', () => {
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

  it('returns response with status 200', async () => {
    const page = await browser!.newPage()
    try {
      const resp = await navigateWithStealth(page, `http://127.0.0.1:${PORT}/`, 10000, { allowPrivateNetworks: true })
      expect(resp).toBeDefined()
      expect(resp!.status()).toBe(200)
      expect(page.url()).toMatch(/^http:\/\/127\.0\.0\.1:\d+\//)
    } finally {
      await page.close()
    }
  })

  it('page contains expected content after navigation', async () => {
    const page = await browser!.newPage()
    try {
      await navigateWithStealth(page, `http://127.0.0.1:${PORT}/`, 10000)
      const h1 = await page.locator('h1').textContent()
      expect(h1).toBe('OK')
    } finally {
      await page.close()
    }
  })
})
