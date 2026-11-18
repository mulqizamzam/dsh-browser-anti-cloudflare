/**
 * Account Manager — maintains isolated browser contexts per account.
 * Each account has its own fingerprint, proxy, cookies, and localStorage.
 */

import type { Browser, BrowserContext, Page } from 'playwright'
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
  browser?: Browser
  context?: BrowserContext
  currentPage?: Page
}

export class AccountManager {
  private accounts: Map<string, AccountState> = new Map()
  private currentAccountId: string | null = null

  constructor(private readonly defaultFingerprint: 'auto' | 'windows' | 'mac' | 'linux' = 'auto') {}

  /** Register a new account. */
  register(config: AccountConfig): void {
    if (this.accounts.has(config.id)) {
      throw new Error(`Account ${config.id} already exists`)
    }
    this.accounts.set(config.id, { config })
  }

  /** Get or create browser context for an account. */
  async getAccountContext(accountId: string): Promise<BrowserContext> {
    let state = this.accounts.get(accountId)
    if (!state) {
      throw new Error(`Account ${accountId} not found`)
    }
    if (!state.context) {
      // Lazy init - in real impl would spawn browser+context here
      throw new Error('Browser initialization not yet implemented for account isolation')
    }
    return state.context
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
      await state.context?.close().catch(() => {})
      await state.browser?.close().catch(() => {})
    }
    this.accounts.clear()
    this.currentAccountId = null
  }
}
