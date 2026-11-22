export interface ProxyConfig { url: string; username?: string; password?: string }
export interface ProxyManagerConfig { proxies: ProxyConfig[]; rotate?: boolean }

export class ProxyManager {
  private index = 0
  private readonly rotate: boolean
  private readonly proxies: ProxyConfig[]
  constructor(config: ProxyManagerConfig) {
    if (!config.proxies?.length) throw new Error('At least one proxy is required')
    this.proxies = config.proxies.map(p => {
      const parsed = new URL(p.url)
      if (!['http:', 'https:', 'socks5:'].includes(parsed.protocol) || !parsed.hostname || !parsed.port)
        throw new Error('Proxy must be an explicit HTTP(S) or SOCKS5 URL with host and port')
      if (parsed.username || parsed.password) throw new Error('Put proxy credentials in username/password fields')
      return { ...p, url: parsed.origin }
    })
    this.rotate = config.rotate ?? this.proxies.length > 1
  }
  getCurrent(): ProxyConfig {
    const item = this.proxies[this.rotate ? this.index++ % this.proxies.length : 0]
    return { ...item }
  }
  reset(): void { this.index = 0 }
  get count(): number { return this.proxies.length }
  get isRotating(): boolean { return this.rotate && this.proxies.length > 1 }
  getPlaywrightProxy(): { server: string; username?: string; password?: string } | undefined {
    const p = this.getCurrent()
    return { server: p.url, ...(p.username ? { username: p.username } : {}), ...(p.password ? { password: p.password } : {}) }
  }
}

export function createProxyManager(config?: { url?: string; urls?: string[]; username?: string; password?: string; rotate?: boolean }): ProxyManager | undefined {
  if (!config) return undefined
  const urls = config.url ? [config.url] : config.urls ?? []
  if (!urls.length) return undefined
  return new ProxyManager({ proxies: urls.map(url => ({ url, username: config.username, password: config.password })), rotate: config.rotate })
}
