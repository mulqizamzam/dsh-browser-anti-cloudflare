/**
 * Proxy Manager — handles HTTP/SOCKS5 proxy configuration and round-robin rotation.
 *
 * When a proxy is configured, all browser contexts are created with the specified
 * proxy. If multiple proxies are provided, they are rotated via round-robin across
 * sessions to distribute load and reduce IP flagging risk.
 */

export interface ProxyConfig {
  /** Proxy URL: http://user:pass@host:port or socks5://host:port */
  url: string
  /** Optional username for auth */
  username?: string
  /** Optional password for auth */
  password?: string
}

export interface ProxyManagerConfig {
  proxies: ProxyConfig[]
  /** Enable round-robin rotation (default: true when multiple proxies) */
  rotate?: boolean
}

export class ProxyManager {
  private readonly config: Required<ProxyManagerConfig>
  private currentIndex = 0

  constructor(config: ProxyManagerConfig) {
    if (!config.proxies || config.proxies.length === 0) {
      throw new Error('ProxyManager requires at least one proxy URL')
    }
    this.config = {
      proxies: config.proxies,
      rotate: config.rotate ?? (config.proxies.length > 1),
    }
  }

  /** Get the current proxy config (respects rotation). */
  getCurrent(): ProxyConfig {
    if (!this.config.rotate || this.config.proxies.length === 1) {
      return this.config.proxies[0]
    }
    const proxy = this.config.proxies[this.currentIndex % this.config.proxies.length]
    this.currentIndex++
    return proxy
  }

  /** Reset rotation index (call between sessions). */
  reset(): void {
    this.currentIndex = 0
  }

  /** Number of configured proxies. */
  get count(): number {
    return this.config.proxies.length
  }

  /** Check if rotation is active. */
  get isRotating(): boolean {
    return this.config.rotate && this.config.proxies.length > 1
  }

  /** Format proxy string for Playwright (url with optional auth). */
  formatForPlaywright(): string | undefined {
    if (this.config.proxies.length === 0) return undefined
    const p = this.config.proxies[0]
    if (p.username && p.password) {
      const url = new URL(p.url)
      url.username = p.username
      url.password = p.password
      return url.toString()
    }
    return p.url
  }

  /** Get proxy object for Playwright Browser.newContext(). */
  getPlaywrightProxy(): { server: string; username?: string; password?: string } | undefined {
    if (this.config.proxies.length === 0) return undefined
    const p = this.config.proxies[0]
    return {
      server: p.url,
      ...(p.username ? { username: p.username } : {}),
      ...(p.password ? { password: p.password } : {}),
    }
  }
}

/** Parse proxy config from plugin Config. Returns undefined if no proxy configured. */
export function createProxyManager(proxyConfig?: {
  url?: string
  urls?: string[]
  username?: string
  password?: string
}): ProxyManager | undefined {
  if (!proxyConfig) return undefined

  // Single URL format: { url: 'http://...' }
  if (proxyConfig.url) {
    return new ProxyManager({
      proxies: [{ url: proxyConfig.url, username: proxyConfig.username, password: proxyConfig.password }],
    })
  }

  // Multiple URLs format: { urls: ['http://...', 'http://...'] }
  if (proxyConfig.urls && proxyConfig.urls.length > 0) {
    return new ProxyManager({
      proxies: proxyConfig.urls.map(u => ({
        url: u,
        username: proxyConfig.username,
        password: proxyConfig.password,
      })),
    })
  }

  return undefined
}
