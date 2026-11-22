import { describe, it, expect } from 'vitest'
import { chromium } from 'playwright'
import { enforcePageLimit } from '../src/lifecycle.js'
import { SessionManager } from '../src/session.js'

describe('session lifecycle limits', () => {
  it('evicts the least recently used page when the context ceiling is exceeded', async () => {
    const browser = await chromium.launch({ headless: true })
    const context = await browser.newContext()
    try {
      enforcePageLimit(context, 1)
      const first = await context.newPage()
      const second = await context.newPage()
      await new Promise(resolve => setTimeout(resolve, 50))
      expect(context.pages()).toHaveLength(1)
      expect(first.isClosed() || second.isClosed()).toBe(true)
    } finally { await browser.close() }
  }, 30000)

  it('closes an inactive runtime after the configured idle timeout', async () => {
    const manager = new SessionManager({ headless: true, session: { timeoutMs: 80, maxPages: 1 } })
    try {
      await manager.getPage()
      expect(manager.getInfo().runtimeActive).toBe(true)
      await new Promise(resolve => setTimeout(resolve, 180))
      expect(manager.getInfo().runtimeActive).toBe(false)
    } finally { await manager.close() }
  }, 30000)

  it('rejects invalid lifecycle limits', () => {
    expect(() => new SessionManager({ session: { maxPages: 0 } })).toThrow(/maxPages/)
    expect(() => new SessionManager({ session: { timeoutMs: -1 } })).toThrow(/timeoutMs/)
  })
})
