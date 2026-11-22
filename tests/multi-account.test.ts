import { describe, it, expect } from 'vitest'
import { SessionManager } from '../src/session.js'
describe('account context isolation and lifecycle', () => {
  it('rejects account access when accounts are not configured', async () => {
    const manager = new SessionManager({ headless: true })
    try { await expect(manager.getAccountPage('missing')).rejects.toThrow(/No accounts configured/) }
    finally { await manager.close() }
  })
  it('registers accounts and selects the first by default', async () => {
    const manager = new SessionManager({ headless: true, accounts: [{ id: 'alice' }, { id: 'bob' }] })
    try { expect(manager.listAccounts()).toEqual(['alice', 'bob']); expect(manager.getCurrentAccount()).toBe('alice'); manager.switchAccount('bob'); expect(manager.getCurrentAccount()).toBe('bob') }
    finally { await manager.close() }
  })
  it('validates account proxy overrides during registration', async () => {
    const manager = new SessionManager({ headless: true })
    try {
      expect(() => manager.getAccounts()).toBeNull()
      const accounts = new (await import('../src/accounts.js')).AccountManager()
      expect(() => accounts.register({ id: 'bad-proxy', proxyUrl: 'file:///tmp/proxy' })).toThrow(/Proxy must be/)
      expect(() => accounts.register({ id: 'embedded-auth', proxyUrl: 'http://user:pass@proxy.example:8080' })).toThrow(/credentials/)
      expect(() => accounts.register({ id: 'socks-proxy', proxyUrl: 'socks5://proxy.example:1080' })).not.toThrow()
    } finally { await manager.close() }
  })
  it('closes accounts safely before lazy browser initialization', async () => {
    const manager = new SessionManager({ headless: true, accounts: [{ id: 'unused' }] })
    await expect(manager.close()).resolves.toBeUndefined()
  })
  it('rejects unsafe account identifiers and duplicates', async () => {
    const manager = new SessionManager({ headless: true, accounts: [{ id: 'safe' }] })
    try { expect(() => manager.getAccounts()!.register({ id: '../escape' })).toThrow(); expect(() => manager.getAccounts()!.register({ id: 'safe' })).toThrow(/already exists/) }
    finally { await manager.close() }
  })
})
