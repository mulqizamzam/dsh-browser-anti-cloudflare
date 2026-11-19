/**
 * Account Manager — maintains isolated browser contexts per account.
 * Each account has its own fingerprint, proxy, cookies, and localStorage.
 * Integrated with SessionManager for seamless multi-account support.
 */

import { chromium } from 'playwright'
import type { Browser, BrowserContext, Page } from 'playwright'
import { generateProfile, buildFingerprintScript } from './fingerprint.js'
import { createProxyManager } from './proxy.js'
import type { ProxyManager } from './proxy.js'
import type { FingerprintProfile } from './fingerprint.js'

export interface AccountConfig {
  /** Unique account identifier */
  id: string
  /** Fingerprint profile name or 'auto' */
  fingerprint?: 'auto' | 'windows' | 'mac' | 'linux'
  /** Optional proxy URL for this account */
  proxyUrl?: string
  /** Optional session file path */
  sessionFile?: string
}

interface AccountState {
  config: AccountConfig
  browser: Browser
  context: BrowserContext
  currentPage?: Page
  profile: FingerprintProfile
}

export class AccountManager {
  private accounts: Map<string, AccountState> = new Map()
  private currentAccountId: string | null = null
  private readonly seedOffset: number

  constructor(
    private readonly defaultFingerprint: 'auto' | 'windows' | 'mac' | 'linux' = 'auto',
    seed?: number,
  ) {
    this.seedOffset = seed ?? Date.now()
  }

  /** Register a new account. */
  register(config: AccountConfig): void {
    if (this.accounts.has(config.id)) {
      throw new Error(`Account ${config.id} already exists`)
    }
    // Profile is resolved lazily on first context creation
    this.accounts.set(config.id, {
      config,
      // browser/context set on first use
      browser: null as unknown as Browser,
      context: null as unknown as BrowserContext,
      profile: this._resolveProfile(config.fingerprint),
    })
  }

  /** Get or create browser context for an account (lazy init). */
  async getAccountContext(accountId: string): Promise<BrowserContext> {
    let state = this.accounts.get(accountId)
    if (!state) {
      throw new Error(`Account ${accountId} not found`)
    }
    if (state.context) return state.context

    // Lazy init: spawn browser + context with account-specific settings
    const profile = state.profile
    const proxyMgr = state.config.proxyUrl
      ? createProxyManager({ url: state.config.proxyUrl })
      : undefined
    const proxyOpts = proxyMgr?.getPlaywrightProxy()

    state.browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--js-flags=--no-wasm-tier-up',
        `--user-agent=${profile.userAgent}`,
      ],
    })

    state.context = await state.browser.newContext({
      viewport: { width: profile.screenWidth, height: profile.screenHeight },
      userAgent: profile.userAgent,
      deviceScaleFactor: 1,
      hasTouch: false,
      isMobile: false,
      locale: profile.languages[0],
      ...(proxyOpts ? { proxy: proxyOpts } : {}),
    })

    // Inject stealth + fingerprint scripts
    const fpScript = buildFingerprintScript(profile)
    await state.context.addInitScript(fpScript)

    return state.context
  }

  /** Get the fingerprint profile for an account. */
  getAccountProfile(accountId: string): FingerprintProfile | null {
    return this.accounts.get(accountId)?.profile ?? null
  }

  /** Get internal account state (for SessionManager integration). */
  getAccountState(accountId: string): AccountState | null {
    return this.accounts.get(accountId) ?? null
  }

  /** Switch to an account (sets it as current). */
  setCurrent(accountId: string): void {
    if (!this.accounts.has(accountId)) {
      throw new Error(`Account ${accountId} not found`)
    }
    this.currentAccountId = accountId
  }

  /** Get current account ID. */
  getCurrentId(): string | null {
    return this.currentAccountId
  }

  /** List all registered account IDs. */
  listAccounts(): string[] {
    return Array.from(this.accounts.keys())
  }

  /** Number of registered accounts. */
  get count(): number {
    return this.accounts.size
  }

  /** Close all browsers and clean up. */
  async closeAll(): Promise<void> {
    for (const state of this.accounts.values()) {
      await state.context.close().catch(() => {})
      await state.browser.close().catch(() => {})
    }
    this.accounts.clear()
    this.currentAccountId = null
  }

  /** Resolve fingerprint profile from config or default. */
  private _resolveProfile(
    override?: 'auto' | 'windows' | 'mac' | 'linux',
  ): FingerprintProfile {
    const mode = override ?? this.defaultFingerprint
    if (mode === 'auto') {
      return generateProfile(this.seedOffset)
    }
    // Map named profiles to seed indices
    const keyMap: Record<string, number> = { windows: 0, mac: 1, linux: 3 }
    return generateProfile(keyMap[mode] ?? 0)
  }
}
