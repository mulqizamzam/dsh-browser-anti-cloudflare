import { describe, it, expect } from 'vitest'
import { hasTurnstile, buildTurnstileBypassScript } from '../src/turnstile.js'
import { AccountManager } from '../src/accounts.js'
describe('Turnstile detection', () => {
  it('detects widget markers without simulating completion', () => {
    expect(hasTurnstile('<div class="cf-turnstile"></div>')).toBe(true)
    expect(hasTurnstile('<div data-cf-widget="test"></div>')).toBe(true)
    expect(buildTurnstileBypassScript()).toBe('')
  })
  it('returns false for unrelated pages', () => { expect(hasTurnstile('<html>hello</html>')).toBe(false) })
})
describe('account manager validation', () => {
  it('registers and lists accounts', () => {
    const mgr = new AccountManager()
    mgr.register({ id: 'one' }); mgr.register({ id: 'two' })
    expect(mgr.listAccounts()).toEqual(['one', 'two'])
    expect(mgr.count).toBe(2)
  })
  it('rejects duplicates and unsafe identifiers', () => {
    const mgr = new AccountManager()
    mgr.register({ id: 'same' })
    expect(() => mgr.register({ id: 'same' })).toThrow(/already exists/)
    expect(() => mgr.register({ id: '../bad' })).toThrow()
  })
})
