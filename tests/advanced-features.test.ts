/**
 * Turnstile bypass and multi-account tests.
 */
import { describe, it, expect } from 'vitest'
import { hasTurnstile, buildTurnstileBypassScript } from '../src/turnstile.js'
import { AccountManager } from '../src/accounts.js'

describe('turnstile-bypass: detection', () => {
  it('detects Turnstile in HTML', () => {
    expect(hasTurnstile('<div class="cf-turnstile"></div>')).toBe(true)
    expect(hasTurnstile('<div data-cf-widget="test"></div>')).toBe(true)
  })

  it('returns false for non-turnstile pages', () => {
    expect(hasTurnstile('<html><body>Hello</body></html>')).toBe(false)
    expect(hasTurnstile('<div class="recaptcha">old captcha</div>')).toBe(false)
  })
})

describe('turnstile-bypass: script output', () => {
  it('builds valid bypass script', () => {
    const script = buildTurnstileBypassScript()
    expect(script).toContain('MutationObserver')
    expect(script).toContain('cf-turnstile')
    expect(script).toContain('data-checked')
  })
})

describe('multi-account-rotation: account manager', () => {
  it('registers and lists accounts', () => {
    const mgr = new AccountManager('auto')
    mgr.register({ id: 'acc1' })
    mgr.register({ id: 'acc2' })
    mgr.register({ id: 'acc3' })
    expect(mgr.listAccounts()).toEqual(['acc1', 'acc2', 'acc3'])
    expect(mgr.count).toBe(3)
  })

  it('throws on duplicate registration', () => {
    const mgr = new AccountManager()
    mgr.register({ id: 'same' })
    expect(() => mgr.register({ id: 'same' })).toThrow('already exists')
  })

  it('sets and gets current account', () => {
    const mgr = new AccountManager()
    mgr.register({ id: 'a' })
    mgr.register({ id: 'b' })
    mgr.setCurrent('b')
    expect(mgr.getCurrentId()).toBe('b')
  })

  it('throws on invalid current switch', () => {
    const mgr = new AccountManager()
    mgr.register({ id: 'a' })
    expect(() => mgr.setCurrent('nonexistent')).toThrow()
  })
})
