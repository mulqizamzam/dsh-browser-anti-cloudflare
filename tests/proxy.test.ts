import { describe, it, expect } from 'vitest'
import { ProxyManager, createProxyManager } from '../src/proxy.js'

describe('proxy configuration', () => {
  it('rotates across configured proxies', () => {
    const manager = new ProxyManager({ proxies: [{ url: 'http://proxy-a.example:8080' }, { url: 'http://proxy-b.example:8080' }] })
    expect(manager.getCurrent().url).toBe('http://proxy-a.example:8080')
    expect(manager.getCurrent().url).toBe('http://proxy-b.example:8080')
    expect(manager.getCurrent().url).toBe('http://proxy-a.example:8080')
  })

  it('preserves a valid SOCKS5 endpoint for Playwright', () => {
    const manager = createProxyManager({ url: 'socks5://proxy.example:1080' })
    expect(manager?.getPlaywrightProxy()?.server).toBe('socks5://proxy.example:1080')
  })

  it('rejects malformed endpoints, embedded credentials, and URL paths', () => {
    expect(() => createProxyManager({ url: 'file:///tmp/proxy' })).toThrow()
    expect(() => createProxyManager({ url: 'http://user:pass@proxy.example:8080' })).toThrow()
    expect(() => createProxyManager({ url: 'http://proxy.example:8080/proxy-path' })).toThrow(/only scheme, host, and port/)
  })
})
