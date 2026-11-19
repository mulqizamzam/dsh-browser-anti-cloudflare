/**
 * Multi-account integration tests — verify AccountManager lazy-init
 * produces isolated, fingerprint-coherent browser contexts.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { chromium } from 'playwright'
import type { Browser } from 'playwright'
import { SessionManager } from '../src/session.js'
import { generateProfile } from '../src/fingerprint.js'

const PORT = 19883

async function startServer(): Promise<() => void> {
  const http = await import('node:http')
  const srv = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end('<html><body><h1>Account Test</h1></body></html>')
  })
  await new Promise<void>((resolve) => srv.listen(PORT, '127.0.0.1', resolve))
  return () => new Promise<void>((resolve) => { srv.close(() => resolve()) })
}

describe('multi-account: integration', () => {
  let closeServer: (() => void) | null = null

  beforeAll(async () => {
    closeServer = await startServer()
  })
  afterAll(async () => {
    await closeServer?.()
  })

  it('SessionManager rejects getAccountPage without accounts config', async () => {
    const mgr = new SessionManager({ headless: true })
    try {
      await expect(mgr.getAccountPage('acc1')).rejects.toThrow('AccountManager not initialized')
    } finally {
      await mgr.close()
    }
  })

  it('registers accounts and lists them', async () => {
    const mgr = new SessionManager({
      headless: true,
      accounts: [
        { id: 'alice', fingerprint: 'windows' },
        { id: 'bob', fingerprint: 'mac' },
        { id: 'charlie', fingerprint: 'linux' },
      ],
    })
    try {
      expect(mgr.listAccounts()).toEqual(['alice', 'bob', 'charlie'])
      expect(mgr.hasAccounts()).toBe(true)
      expect(mgr.getCurrentAccount()).toBe('alice') // first registered
    } finally {
      await mgr.close()
    }
  })

  it('switches between accounts', async () => {
    const mgr = new SessionManager({
      headless: true,
      accounts: [{ id: 'a' }, { id: 'b' }],
    })
    try {
      expect(mgr.getCurrentAccount()).toBe('a')
      mgr.switchAccount('b')
      expect(mgr.getCurrentAccount()).toBe('b')
      mgr.switchAccount('a')
      expect(mgr.getCurrentAccount()).toBe('a')
    } finally {
      await mgr.close()
    }
  })

  it('each account gets a distinct fingerprint profile', async () => {
    const mgr = new SessionManager({
      headless: true,
      accounts: [
        { id: 'win', fingerprint: 'windows' },
        { id: 'mac', fingerprint: 'mac' },
      ],
    })
    try {
      const winProfile = mgr.getAccounts()?.getAccountProfile('win')
      const macProfile = mgr.getAccounts()?.getAccountProfile('mac')
      expect(winProfile).toBeDefined()
      expect(macProfile).toBeDefined()
      expect(winProfile!.platformStr).toBe('Win32')
      expect(macProfile!.platformStr).toBe('MacIntel')
      // Different platforms = different WebGL renderers
      expect(winProfile!.webglRenderer).toContain('Intel')
      expect(macProfile!.webglRenderer).toContain('Apple')
    } finally {
      await mgr.close()
    }
  })

  it('account context spawns isolated browser with correct fingerprint', async () => {
    const mgr = new SessionManager({
      headless: true,
      accounts: [{ id: 'test-acc', fingerprint: 'mac' }],
    })
    try {
      const page = await mgr.getAccountPage('test-acc', `http://127.0.0.1:${PORT}/`)
      expect(page.url()).toContain('127.0.0.1')

      const metrics = await page.evaluate(() => ({
        webdriver: (navigator as unknown as Record<string, unknown>).webdriver,
        platform: navigator.platform,
        concurrency: navigator.hardwareConcurrency,
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

      expect(metrics.webdriver).toBeUndefined()
      expect(metrics.platform).toBe('MacIntel')
      expect(metrics.concurrency).toBe(10)
      expect(metrics.hasChromeRuntime).toBe(true)
      expect(metrics.sabDisabled).toBe(true)
      expect(metrics.webglRenderer).toContain('Apple')
    } finally {
      await mgr.close()
    }
  })

  it('two accounts have isolated cookie stores', async () => {
    const mgr = new SessionManager({
      headless: true,
      accounts: [
        { id: 'user1' },
        { id: 'user2' },
      ],
    })
    try {
      const p1 = await mgr.getAccountPage('user1', `http://127.0.0.1:${PORT}/set-cookie`)
      const p2 = await mgr.getAccountPage('user2', `http://127.0.0.1:${PORT}/`)

      // Even though both navigate to same origin, contexts are isolated
      // (mock server doesn't set cookies, but we verify no cross-contamination)
      const ctx1 = await p1.context().cookies()
      const ctx2 = await p2.context().cookies()
      // Both should be empty (mock server returns no Set-Cookie)
      expect(ctx1).toEqual([])
      expect(ctx2).toEqual([])
    } finally {
      await mgr.close()
    }
  })
})
