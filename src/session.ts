/**
 * Session Manager — maintains a persistent browser instance across tool calls.
 *
 * When sessions are enabled, subsequent ac_browser_* calls reuse the same
 * Chromium process and page context, preserving cookies, localStorage, and
 * navigation state. This enables multi-step workflows (navigate → login →
 * interact) without re-authenticating on every call.
 *
 * When sessions are disabled (default), behavior is identical to before:
 * each call spawns a fresh browser.
 */

import { chromium } from 'playwright'
import type { Browser, Page, BrowserContext, Cookie } from 'playwright'
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { Config } from './index.js'
import { navigateWithStealth } from './stealth.js'
import { createProxyManager } from './proxy.js'
import type { ProxyManager } from './proxy.js'
import { AccountManager } from './accounts.js'
import type { AccountConfig } from './accounts.js'

/** Simple deterministic hash for seeding profile selection. */
function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

/** Serialized session data saved to disk. */
interface SerializedSession {
  cookies: Cookie[]
  localStorage: Record<string, string>
  createdAt: number
}

/** Active page entry in the session pool. */
interface PageEntry {
  page: Page
  url: string
  createdAt: number
}

export interface SessionConfig {
  /** Enable persistent browser sessions (default: false) */
  enabled: boolean
  /** Per-session timeout in milliseconds (default: 120000) */
  timeoutMs?: number
  /** Max concurrent pages per session (default: 5) */
  maxPages?: number
  /** Directory to save session files (default: ~/.cache/browser-anti-cloudflare/sessions) */
  sessionDir?: string
}

export class SessionManager {
  private browser: Browser | null = null
  private context: BrowserContext | null = null
  private pages: Map<string, PageEntry> = new Map()
  private config: Required<SessionConfig>
  private sessionId: string
  private proxyMgr: ProxyManager | undefined
  private accountMgr: AccountManager | null = null

  constructor(config: Config) {
    this.config = {
      enabled: config.session?.enabled ?? false,
      timeoutMs: config.session?.timeoutMs ?? 120000,
      maxPages: config.session?.maxPages ?? 5,
      sessionDir: config.session?.sessionDir ?? join(process.env.HOME || '/tmp', '.cache', 'browser-anti-cloudflare', 'sessions'),
    }
    this.sessionId = Date.now().toString(36) + Math.random().toString(36).substring(2)
    this.proxyMgr = createProxyManager(config.proxy)

    // Initialize AccountManager if multi-account config provided
    if (config.accounts && config.accounts.length > 0) {
      this.accountMgr = new AccountManager('auto', hashString(this.sessionId))
      for (const acc of config.accounts) {
        this.accountMgr.register(acc)
      }
      // Default to first account
      if (this.accountMgr.count > 0) {
        this.accountMgr.setCurrent(this.accountMgr.listAccounts()[0])
      }
    }
  }

  /** Get the active page for a URL, or create one if needed. */
  async getOrCreatePage(url: string): Promise<Page> {
    if (!this.config.enabled) {
      // Fallback: fresh page per call
      const b = await this.ensureBrowser()
      return b.newPage()
    }

    // Reuse existing page for same URL
    for (const [key, entry] of this.pages) {
      if (entry.url === url) {
        return entry.page
      }
    }

    // Create new page if under limit
    if (this.pages.size >= this.config.maxPages!) {
      // Evict oldest page
      let oldestKey = ''
      let oldestTime = Infinity
      for (const [key, entry] of this.pages) {
        if (entry.createdAt < oldestTime) {
          oldestTime = entry.createdAt
          oldestKey = key
        }
      }
      if (oldestKey) {
        const old = this.pages.get(oldestKey)!
        await old.page.close().catch(() => {})
        this.pages.delete(oldestKey)
      }
    }

    const ctx = await this.ensureContext()
    const page = await ctx.newPage()
    const key = `${url}:${Date.now()}`
    this.pages.set(key, { page, url, createdAt: Date.now() })
    return page
  }

  /** Navigate with stealth patches, reusing the session page. */
  async navigate(url: string, timeoutMs: number): Promise<import('playwright').Response | null> {
    const page = await this.getOrCreatePage(url)
    return navigateWithStealth(page, url, timeoutMs)
  }

  /** Get or create an isolated context for a specific account. */
  async getAccountPage(accountId: string, url?: string): Promise<Page> {
    if (!this.accountMgr) {
      throw new Error('AccountManager not initialized — no accounts configured')
    }
    const ctx = await this.accountMgr.getAccountContext(accountId)
    let page = this.accountMgr.getAccountState(accountId)?.currentPage
    if (!page || page.isClosed()) {
      page = await ctx.newPage()
      const state = this.accountMgr.getAccountState(accountId)!
      state.currentPage = page
    }
    if (url) {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    }
    return page
  }

  /** Switch current account. */
  switchAccount(accountId: string): void {
    if (!this.accountMgr) {
      throw new Error('AccountManager not initialized')
    }
    this.accountMgr.setCurrent(accountId)
  }

  /** List all registered accounts. */
  listAccounts(): string[] {
    return this.accountMgr?.listAccounts() ?? []
  }

  /** Get current account ID. */
  getCurrentAccount(): string | null {
    return this.accountMgr?.getCurrentId() ?? null
  }

  /** Check if multi-account mode is active. */
  hasAccounts(): boolean {
    return !!this.accountMgr && this.accountMgr.count > 0
  }

  /** Save current session state to disk. */
  async saveSession(label: string = 'default'): Promise<{ path: string; size: number }> {
    if (!this.config.enabled) {
      throw new Error('Session persistence is disabled')
    }

    // Collect cookies from all page contexts
    const allCookies: Cookie[] = []
    const seenContexts = new Set<object>()
    for (const entry of this.pages.values()) {
      const ctx = entry.page.context()
      if (seenContexts.has(ctx)) continue
      seenContexts.add(ctx)
      try {
        const urls = entry.page.url()
        if (urls) {
          const cookies = await entry.page.context().cookies(urls)
          allCookies.push(...cookies)
        }
      } catch (_) { /* ignore */ }
    }

    // Also get cookies from the main context if no pages exist
    if (allCookies.length === 0) {
      const ctx = await this.ensureContext()
      try {
        allCookies.push(...await ctx.cookies())
      } catch (_) { /* ignore empty context */ }
    }

    // Collect localStorage from all pages
    const savedStorage: Record<string, string> = {}
    for (const entry of this.pages.values()) {
      try {
        const storage = await entry.page.evaluate(() => {
          const result: Record<string, string> = {}
          const ls = window.localStorage
          for (let i = 0; i < ls.length; i++) {
            const key = ls.key(i)
            if (key) result[key] = ls.getItem(key) || ''
          }
          return result
        })
        Object.assign(savedStorage, storage)
      } catch (_) { /* ignore insecure pages */ }
    }

    const data: SerializedSession = {
      cookies: allCookies,
      localStorage: savedStorage,
      createdAt: Date.now(),
    }

    const dir = this.config.sessionDir!
    mkdirSync(dir, { recursive: true })
    const filename = `${label}-${this.sessionId}.json`
    const filepath = join(dir, filename)

    const content = JSON.stringify(data, null, 2)
    writeFileSync(filepath, content, 'utf-8')

    return { path: filepath, size: content.length }
  }

  /** Load a previously saved session from disk. */
  async loadSession(path: string): Promise<boolean> {
    if (!existsSync(path)) {
      return false
    }

    const content = readFileSync(path, 'utf-8')
    const data: SerializedSession = JSON.parse(content)

    const ctx = await this.ensureContext()

    // Restore cookies
    if (data.cookies.length > 0) {
      try {
        await ctx.addCookies(data.cookies)
      } catch (_) {
        // Some cookies may be domain-restricted; ignore failures
      }
    }

    // Restore localStorage on existing pages
    for (const entry of this.pages.values()) {
      try {
        await entry.page.evaluate((storage: Record<string, string>) => {
          const ls = window.localStorage
          for (const [key, value] of Object.entries(storage)) {
            ls.setItem(key, value as string)
          }
        }, data.localStorage)
      } catch (_) { /* ignore insecure pages */ }
    }

    return true
  }

  /** Get session info. */
  getInfo() {
    return {
      enabled: this.config.enabled,
      sessionId: this.sessionId,
      pageCount: this.pages.size,
      maxPages: this.config.maxPages,
    }
  }

  /** Close the browser and clean up. */
  async close(): Promise<void> {
    for (const entry of this.pages.values()) {
      await entry.page.close().catch(() => {})
    }
    this.pages.clear()
    await this.accountMgr?.closeAll().catch(() => {})
    await this.browser?.close().catch(() => {})
    this.browser = null
    this.context = null
    this.accountMgr = null
  }

  /** Get AccountManager instance (for external access). */
  getAccounts(): AccountManager | null {
    return this.accountMgr
  }

  private async ensureBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--js-flags=--no-wasm-tier-up',
          '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        ],
      })
    }
    return this.browser
  }

  private async ensureContext(): Promise<BrowserContext> {
    if (!this.context) {
      const browser = await this.ensureBrowser()
      const proxyOpts = this.proxyMgr?.getPlaywrightProxy()
      this.context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        deviceScaleFactor: 1,
        hasTouch: false,
        isMobile: false,
        ...(proxyOpts ? { proxy: proxyOpts } : {}),
      })
    }
    return this.context
  }
}
