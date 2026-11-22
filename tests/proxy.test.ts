import { describe, it, expect } from 'vitest'
import { ProxyManager, createProxyManager } from '../src/proxy.js'
describe('proxy configuration', () => {
  it('rotates across configured proxies', () => {
    const manager = new ProxyManager({ proxies: [{ url: 'http://proxy-a.example:8080' }, { url: 'http://proxy-b.example:8080' }] })
    expect(manager.getCurrent().url).toBe('http://proxy-a.example:8080')
    expect(manager.getCurrent().url).toBe('http://proxy-b.example:8080')
    expect(manager.getCurrent().url).toBe('http://proxy-a.example:8080')
  })
  it('rejects malformed proxy endpoints and embedded credentials', () => {
    expect(() => createProxyManager({ url: 'file:///tmp/proxy' })).toThrow()
    expect(() => createProxyManager({ url: 'http://user:pass@proxy.example:8080' })).toThrow()
  })
})
