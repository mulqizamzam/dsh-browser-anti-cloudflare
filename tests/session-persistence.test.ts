/**
 * Session persistence tests — verify cookies/localStorage survive across calls.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { chromium } from 'playwright'
import type { Browser } from 'playwright'
import { readFileSync, existsSync } from 'fs'
import { rm } from 'node:fs/promises'
import { join } from 'path'
import { SessionManager } from '../src/session.js'

const PORT = 19879

async function startServer(): Promise<() => void> {
  const http = await import('node:http')
  const srv = http.createServer((req, res) => {
    if (req.url === '/set-cookie') {
      res.writeHead(200, {
        'Content-Type': 'text/html',
        'Set-Cookie': 'session_token=abc123; Path=/; Max-Age=3600',
      })
      res.end('<html><body><h1>Cookie Set</h1></body></html>')
    } else if (req.url === '/storage') {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(`
        <html><body>
          <script>
            localStorage.setItem('theme', 'dark');
            localStorage.setItem('user', 'testuser');
          </script>
          <p>Storage page</p>
        </body></html>
      `)
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('<html><body><h1>OK</h1></body></html>')
    }
  })
  await new Promise<void>((resolve) => srv.listen(PORT, '127.0.0.1', resolve))
  return () => new Promise<void>((resolve) => { srv.close(() => resolve()) })
}

describe('session-persistence: basic', () => {
  let browser: Browser | null = null
  let closeServer: (() => void) | null = null
  let sessionMgr: SessionManager | null = null
  const sessionDir = `/tmp/session-test-${Date.now()}`

  beforeAll(async () => {
    closeServer = await startServer()
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
    sessionMgr = new SessionManager({
      headless: true,
      allowPrivateNetworks: true,
      session: { enabled: true, sessionDir, encryptionKey: 'test-session-key-'.repeat(3) },
    })
  })

  afterAll(async () => {
    await sessionMgr?.close()
    await browser?.close()
    await closeServer?.()
    // Cleanup session dir
    await rm(sessionDir, { recursive: true, force: true })
  })

  it('preserves cookies across two navigate calls', async () => {
    // First call: set a cookie
    await sessionMgr!.navigate(`http://127.0.0.1:${PORT}/set-cookie`, 10000)

    // Second call: verify cookie is still there
    const page = await sessionMgr!.getOrCreatePage(`http://127.0.0.1:${PORT}/`)
    const cookies = await page.context().cookies()
    const sessionCookie = cookies.find(c => c.name === 'session_token')
    expect(sessionCookie).toBeDefined()
    expect(sessionCookie!.value).toBe('abc123')
    await page.close()
  }, 20000)

  it('session_save writes authenticated ciphertext', async () => {
    const result = await sessionMgr!.saveSession('test-save')
    expect(existsSync(result.path)).toBe(true)
    expect(typeof result.size).toBe('number')
    expect(result.size).toBeGreaterThan(0)

    // Session content is authenticated ciphertext, not plaintext JSON.
    const content = readFileSync(result.path, 'utf-8')
    expect(content.startsWith('BAS2:')).toBe(true)
    expect(content).not.toContain('cookies')
  })

  it('session_status returns correct info', async () => {
    const info = sessionMgr!.getInfo()
    expect(info.enabled).toBe(true)
    expect(typeof info.sessionId).toBe('string')
    expect(info.sessionId.length).toBeGreaterThan(0)
    expect(info.pageCount).toBeGreaterThanOrEqual(0)
  })

  it('disabled session falls back to fresh browser', async () => {
    const freshMgr = new SessionManager({ headless: true, allowPrivateNetworks: true })
    const resp = await freshMgr.navigate(`http://127.0.0.1:${PORT}/`, 10000)
    expect(resp).toBeDefined()
    expect(resp!.status()).toBe(200)
    await freshMgr.close()
  })
})
