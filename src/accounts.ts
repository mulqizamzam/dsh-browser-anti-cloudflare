import { chromium } from 'playwright'
import type { Browser, BrowserContext, Page } from 'playwright'
import type { Config } from './index.js'
import { createProxyManager } from './proxy.js'
import type { ProxyManager } from './proxy.js'
import { enforcePageLimit } from './lifecycle.js'

export interface AccountConfig {
  id: string
  /** Legacy metadata only; browser identity is not modified. */
  fingerprint?: 'auto' | 'windows' | 'mac' | 'linux'
  proxyUrl?: string
  sessionFile?: string
}
type StorageState = Awaited<ReturnType<BrowserContext['storageState']>>
interface AccountState { config: AccountConfig; browser: Browser | null; context: BrowserContext | null; currentPage?: Page }
export class AccountManager {
  private proxyManager: ProxyManager | undefined
  private accounts = new Map<string, AccountState>()
  private currentAccountId: string | null = null
  constructor(private readonly config: Pick<Config, 'headless' | 'executablePath' | 'proxy' | 'allowPrivateNetworks' | 'session'> = {}) {
    this.proxyManager = createProxyManager(config.proxy)
  }
  register(config: AccountConfig): void {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(config.id)) throw new Error('Account id must contain 1–64 letters, numbers, _ or -')
    if (this.accounts.has(config.id)) throw new Error(`Account ${config.id} already exists`)
    // Validate account overrides at startup, not on the first browser operation.
    if (config.proxyUrl) createProxyManager({ url: config.proxyUrl })
    this.accounts.set(config.id, { config, browser: null, context: null })
  }
  private async createContext(id: string, state: AccountState, storageState?: StorageState): Promise<BrowserContext> {
    const browser = await chromium.launch({ headless: this.config.headless ?? true, executablePath: this.config.executablePath ?? undefined, args: ['--disable-dev-shm-usage', '--disable-gpu'] })
    const proxy = state.config.proxyUrl
      ? createProxyManager({ url: state.config.proxyUrl })?.getPlaywrightProxy()
      : this.proxyManager?.getPlaywrightProxy()
    try {
      const context = await browser.newContext({ ...(storageState ? { storageState } : {}), serviceWorkers: 'block', ...(proxy ? { proxy } : {}) })
      enforcePageLimit(context, this.config.session?.maxPages ?? 5)
      state.browser = browser; state.context = context; state.currentPage = undefined
      return context
    } catch (error) { await browser.close(); throw error }
  }
  async getAccountContext(id: string): Promise<BrowserContext> {
    const state = this.accounts.get(id)
    if (!state) throw new Error(`Account ${id} not found`)
    if (state.context && state.browser?.isConnected()) return state.context
    return this.createContext(id, state)
  }
  async restoreAccountStorageState(id: string, storageState: StorageState): Promise<void> {
    const state = this.accounts.get(id)
    if (!state) throw new Error(`Account ${id} not found`)
    await state.context?.close().catch(() => {})
    await state.browser?.close().catch(() => {})
    state.context = null; state.browser = null; state.currentPage = undefined
    await this.createContext(id, state, storageState)
  }
  async getAccountPage(id: string, url?: string): Promise<Page> {
    const context = await this.getAccountContext(id)
    const state = this.accounts.get(id)!
    if (!state.currentPage || state.currentPage.isClosed()) state.currentPage = await context.newPage()
    if (url) { const { navigateWithStealth } = await import('./stealth.js'); await navigateWithStealth(state.currentPage, url, 30000, { allowPrivateNetworks: this.config.allowPrivateNetworks }) }
    return state.currentPage
  }
  getAccountProfile(_id: string): null { return null }
  getAccountState(id: string): AccountState | null { return this.accounts.get(id) ?? null }
  setCurrent(id: string): void { if (!this.accounts.has(id)) throw new Error(`Account ${id} not found`); this.currentAccountId = id }
  getCurrentId(): string | null { return this.currentAccountId }
  listAccounts(): string[] { return [...this.accounts.keys()] }
  get count(): number { return this.accounts.size }
  getPageCount(): number { return [...this.accounts.values()].reduce((sum, state) => sum + (state.context?.pages().length ?? 0), 0) }
  async closeContexts(): Promise<void> {
    const resources = [...this.accounts.values()].map(state => {
      const context = state.context
      const browser = state.browser
      state.context = null; state.browser = null; state.currentPage = undefined
      return Promise.all([context?.close().catch(() => {}), browser?.close().catch(() => {})])
    })
    await Promise.all(resources)
  }
  async closeAll(): Promise<void> {
    await this.closeContexts()
    this.accounts.clear(); this.currentAccountId = null
  }
}
