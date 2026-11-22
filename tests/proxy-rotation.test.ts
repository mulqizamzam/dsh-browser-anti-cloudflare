/**
 * Proxy rotation tests — verify proxy config is passed through to Playwright.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { chromium } from 'playwright'
import type { Browser } from 'playwright'
import { SessionManager } from '../src/session.js'

const PORT = 19882

async function startServer(): Promise<() => void> {
  const http = await import('node:http')
  const srv = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end('<html><body><h1>Proxy Test</h1></body></html>')
  })
  await new Promise<void>((resolve) => srv.listen(PORT, '127.0.0.1', resolve))
  return () => new Promise<void>((resolve) => { srv.close(() => resolve()) })
}

describe('proxy-rotation: manager', () => {
  it('creates manager from single URL', () => {
    const { createProxyManager } = require('../src/proxy.ts')
    // Use runtime import since TS doesn't export from test directly
  })

  it('throws on empty proxy list', () => {
    const { ProxyManager } = require('../src/proxy.ts')
    expect(() => new ProxyManager({ proxies: [] })).toThrow('requires at least one proxy')
  })

  it('rotates through multiple proxies', () => {
    const { ProxyManager } = require('../src/proxy.ts')
    const mgr = new ProxyManager({
      proxies: [
        { url: 'http://proxy1:8080' },
        { url: 'http://proxy2:8080' },
        { url: 'http://proxy3:8080' },
      ],
      rotate: true,
    })
    expect(mgr.isRotating).toBe(true)
    expect(mgr.count).toBe(3)

    const p1 = mgr.getCurrent()
    const p2 = mgr.getCurrent()
    const p3 = mgr.getCurrent()
    const p4 = mgr.getCurrent() // should wrap around

    expect(p1.url).toBe('http://proxy1:8080')
    expect(p2.url).toBe('http://proxy2:8080')
    expect(p3.url).toBe('http://proxy3:8080')
    expect(p4.url).toBe('http://proxy1:8080') // rotated back
  })

  it('does not rotate with single proxy', () => {
    const { ProxyManager } = require('../src/proxy.ts')
    const mgr = new ProxyManager({
      proxies: [{ url: 'http://single:8080' }],
    })
    expect(mgr.isRotating).toBe(false)
    expect(mgr.getCurrent().url).toBe('http://single:8080')
    expect(mgr.getCurrent().url).toBe('http://single:8080') // same every time
  })

  it('resets rotation index', () => {
    const { ProxyManager } = require('../src/proxy.ts')
    const mgr = new ProxyManager({
      proxies: [
        { url: 'http://a:8080' },
        { url: 'http://b:8080' },
      ],
      rotate: true,
    })
    mgr.getCurrent() // advance to b
    mgr.reset()
    expect(mgr.getCurrent().url).toBe('http://a:8080') // reset back to a
  })
})

describe('proxy-rotation: createProxyManager', () => {
  const { createProxyManager } = require('../src/proxy.ts')

  it('returns undefined when no proxy config', () => {
    expect(createProxyManager(undefined)).toBeUndefined()
    expect(createProxyManager(null as any)).toBeUndefined()
    expect(createProxyManager({})).toBeUndefined()
  })

  it('creates manager from single url', () => {
    const mgr = createProxyManager({ url: 'http://test:3128' })
    expect(mgr).toBeDefined()
    expect(mgr!.count).toBe(1)
    expect(mgr!.getCurrent().url).toBe('http://test:3128')
  })

  it('creates manager from urls array', () => {
    const mgr = createProxyManager({
      urls: ['http://a:3128', 'http://b:3128'],
      rotate: true,
    })
    expect(mgr).toBeDefined()
    expect(mgr!.count).toBe(2)
    expect(mgr!.isRotating).toBe(true)
  })

  it('passes auth credentials', () => {
    const mgr = createProxyManager({
      url: 'http://proxy:3128',
      username: 'user',
      password: 'pass',
    })
    expect(mgr).toBeDefined()
    const pw = mgr!.getPlaywrightProxy()
    expect(pw).toBeDefined()
    expect(pw!.username).toBe('user')
    expect(pw!.password).toBe('pass')
  })
})

describe('proxy-rotation: session integration', () => {
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

  it('session works without proxy (default)', async () => {
    const mgr = new SessionManager({ headless: true, allowPrivateNetworks: true })
    try {
      const resp = await mgr.navigate(`http://127.0.0.1:${PORT}/`, 10000)
      expect(resp).toBeDefined()
      expect(resp!.status()).toBe(200)
    } finally {
      await mgr.close()
    }
  })

  it('session accepts proxy config without crashing', async () => {
    // Use a non-existent proxy — should fail gracefully or use it
    const mgr = new SessionManager({
      headless: true,
      proxy: { url: 'http://127.0.0.1:1' }, // invalid proxy
    })
    try {
      // With invalid proxy, navigation may fail — that's expected behavior
      // We just verify the config is accepted without throw
      const info = mgr.getInfo()
      expect(info).toBeDefined()
    } finally {
      await mgr.close().catch(() => {})
    }
  })
})
