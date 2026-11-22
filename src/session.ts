import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'
import { mkdir, readFile, writeFile, realpath, lstat, chmod } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import { chromium } from 'playwright'
import type { Browser, BrowserContext, Page } from 'playwright'
import type { Config } from './index.js'
import { navigateWithStealth } from './stealth.js'
import { createProxyManager } from './proxy.js'
import type { ProxyManager } from './proxy.js'
import { AccountManager } from './accounts.js'
import { assertSafeUrl } from './security.js'
import { enforcePageLimit } from './lifecycle.js'

const MAGIC = 'BAS1'
function encrypt(payload: string, secret: string): string {
  const salt = randomBytes(16), iv = randomBytes(12), key = scryptSync(secret, salt, 32)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const data = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()])
  return [MAGIC, salt.toString('base64'), iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':')
}
function decrypt(payload: string, secret: string): string {
  const [magic, salt, iv, tag, data] = payload.split(':')
  if (magic !== MAGIC || !salt || !iv || !tag || !data) throw new Error('Invalid or unsupported session file')
  const decipher = createDecipheriv('aes-256-gcm', scryptSync(secret, Buffer.from(salt, 'base64'), 32), Buffer.from(iv, 'base64'))
  decipher.setAuthTag(Buffer.from(tag, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8')
}

type StorageState = Awaited<ReturnType<BrowserContext['storageState']>>

export class SessionManager {
  private browser: Browser | null = null
  private context: BrowserContext | null = null
  private pages = new Map<string, Page>()
  private accountMgr: AccountManager | null = null
  private proxyMgr: ProxyManager | undefined
  private activeProxy: { server: string; username?: string; password?: string } | undefined
  private readonly sessionId = randomBytes(12).toString('hex')
  private readonly sessionDir: string
  private readonly idleTimeoutMs: number
  private readonly maxPages: number
  private lastActivityAt = Date.now()
  private idleTimer: ReturnType<typeof setTimeout> | undefined
  private closed = false

  constructor(private readonly config: Config) {
    this.sessionDir = resolve(config.session?.sessionDir ?? join(process.env.HOME || '/tmp', '.cache', 'browser-anti-cloudflare', 'sessions'))
    this.idleTimeoutMs = config.session?.timeoutMs ?? 0
    this.maxPages = config.session?.maxPages ?? 5
    if (this.idleTimeoutMs < 0) throw new Error('session.timeoutMs must be zero or greater')
    if (!Number.isInteger(this.maxPages) || this.maxPages < 1) throw new Error('session.maxPages must be a positive integer')
    this.proxyMgr = createProxyManager(config.proxy)
    if (config.accounts?.length) {
      this.accountMgr = new AccountManager(config)
      for (const account of config.accounts) this.accountMgr.register(account)
      this.accountMgr.setCurrent(config.accounts[0].id)
    }
  }

  private touch(): void {
    if (this.closed) return
    this.lastActivityAt = Date.now()
    if (this.idleTimeoutMs <= 0) return
    if (this.idleTimer) clearTimeout(this.idleTimer)
    this.idleTimer = setTimeout(() => { void this.expireIfIdle() }, this.idleTimeoutMs)
    this.idleTimer.unref?.()
  }

  private async expireIfIdle(): Promise<void> {
    if (this.closed || this.idleTimeoutMs <= 0) return
    const remaining = this.idleTimeoutMs - (Date.now() - this.lastActivityAt)
    if (remaining > 0) {
      this.idleTimer = setTimeout(() => { void this.expireIfIdle() }, remaining)
      this.idleTimer.unref?.()
      return
    }
    await this.closeRuntime()
  }

  private async closeRuntime(): Promise<void> {
    for (const page of this.pages.values()) await page.close().catch(() => {})
    this.pages.clear()
    await this.accountMgr?.closeContexts().catch(() => {})
    await this.context?.close().catch(() => {})
    await this.browser?.close().catch(() => {})
    this.context = null; this.browser = null
  }

  private async ensureContext(): Promise<BrowserContext> {
    if (this.context) return this.context
    this.browser = await chromium.launch({ headless: this.config.headless ?? true, executablePath: this.config.executablePath ?? undefined, args: ['--disable-dev-shm-usage', '--disable-gpu'] })
    this.activeProxy = this.proxyMgr?.getPlaywrightProxy()
    this.context = await this.browser.newContext({ serviceWorkers: 'block', ...(this.activeProxy ? { proxy: this.activeProxy } : {}) })
    enforcePageLimit(this.context, this.maxPages)
    return this.context
  }

  async getPage(url?: string): Promise<Page> {
    if (this.accountMgr && this.accountMgr.getCurrentId()) {
      const page = await this.accountMgr.getAccountPage(this.accountMgr.getCurrentId()!)
      if (url) await assertSafeUrl(url, this.config.allowPrivateNetworks)
      this.touch()
      return page
    }
    let page = this.pages.get('default')
    if (!page || page.isClosed()) { page = await (await this.ensureContext()).newPage(); this.pages.set('default', page) }
    if (url) await assertSafeUrl(url, this.config.allowPrivateNetworks)
    this.touch()
    return page
  }

  async getOrCreatePage(url?: string): Promise<Page> { return this.getPage(url) }

  async navigate(url: string, timeoutMs: number): Promise<import('playwright').Response | null> {
    const page = await this.getPage()
    const response = await navigateWithStealth(page, url, timeoutMs, { allowPrivateNetworks: this.config.allowPrivateNetworks })
    this.touch()
    return response
  }

  async screenshot(url: string, timeoutMs: number, fullPage = false): Promise<{ data: string; mimeType: string; width: number; height: number }> {
    const page = await this.getPage()
    await navigateWithStealth(page, url, timeoutMs, { allowPrivateNetworks: this.config.allowPrivateNetworks })
    const data = await page.screenshot({ fullPage, type: 'png' })
    this.touch()
    return { data: data.toString('base64'), mimeType: 'image/png', width: page.viewportSize()?.width ?? 1280, height: page.viewportSize()?.height ?? 800 }
  }

  async click(url: string, selector: string, timeoutMs: number): Promise<string> {
    const page = await this.getPage()
    await navigateWithStealth(page, url, timeoutMs, { allowPrivateNetworks: this.config.allowPrivateNetworks })
    await page.locator(selector).click({ timeout: timeoutMs })
    this.touch()
    return page.url()
  }

  async type(url: string, selector: string, value: string, timeoutMs: number): Promise<string> {
    const page = await this.getPage()
    await navigateWithStealth(page, url, timeoutMs, { allowPrivateNetworks: this.config.allowPrivateNetworks })
    await page.locator(selector).fill(value, { timeout: timeoutMs })
    this.touch()
    return page.url()
  }

  async evaluate(url: string, expression: string, timeoutMs: number): Promise<unknown> {
    if (!this.config.allowUnsafeEval) throw new Error('Browser eval is disabled. Set allowUnsafeEval=true only for trusted local workflows.')
    const page = await this.getPage()
    await navigateWithStealth(page, url, timeoutMs, { allowPrivateNetworks: this.config.allowPrivateNetworks })
    const result = await page.evaluate(expression)
    this.touch()
    return result
  }

  private assertPersistenceEnabled(): string {
    if (!this.config.session?.enabled) throw new Error('Session persistence is disabled')
    const secret = this.config.session.encryptionKey
    if (!secret || secret.length < 32) throw new Error('Session persistence requires session.encryptionKey with at least 32 characters')
    return secret
  }

  private async resolveSessionFile(path: string): Promise<string> {
    const requested = resolve(path)
    const root = await realpath(this.sessionDir).catch(async () => { await mkdir(this.sessionDir, { recursive: true, mode: 0o700 }); return realpath(this.sessionDir) })
    const requestedInfo = await lstat(requested)
    if (!requestedInfo.isFile() || requestedInfo.isSymbolicLink()) throw new Error('Session path must be a regular non-symlink file')
    const actual = await realpath(requested)
    if (actual !== root && !actual.startsWith(root + sep)) throw new Error('Session path must remain inside the configured session directory')
    const info = await lstat(actual)
    if (!info.isFile() || info.isSymbolicLink()) throw new Error('Session path must be a regular file')
    return actual
  }

  async saveSession(label = 'default'): Promise<{ path: string; size: number }> {
    const secret = this.assertPersistenceEnabled()
    if (!/^[a-zA-Z0-9_-]{1,48}$/.test(label)) throw new Error('Session label must contain 1–48 letters, numbers, _ or -')
    const accountId = this.accountMgr?.getCurrentId() ?? null
    const context = accountId ? await this.accountMgr!.getAccountContext(accountId) : await this.ensureContext()
    const state = await context.storageState()
    await mkdir(this.sessionDir, { recursive: true, mode: 0o700 })
    await chmod(this.sessionDir, 0o700)
    const prefix = accountId ? `${accountId}-` : ''
    const path = join(this.sessionDir, `${prefix}${label}-${this.sessionId}.session`)
    const content = encrypt(JSON.stringify({ version: 2, createdAt: Date.now(), accountId, state }), secret)
    await writeFile(path, content, { encoding: 'utf8', mode: 0o600 })
    this.touch()
    return { path, size: Buffer.byteLength(content) }
  }

  async loadSession(path: string): Promise<boolean> {
    const secret = this.assertPersistenceEnabled()
    const actual = await this.resolveSessionFile(path)
    const decoded = JSON.parse(decrypt(await readFile(actual, 'utf8'), secret)) as { version: number; accountId?: string | null; state?: StorageState }
    if (![1, 2].includes(decoded.version) || !decoded.state || !Array.isArray(decoded.state.cookies)) throw new Error('Invalid session payload')
    if (decoded.version === 1) {
      if (this.accountMgr) throw new Error('Legacy session files cannot be restored into an account context')
      await this.context?.close().catch(() => {})
      if (!this.activeProxy) this.activeProxy = this.proxyMgr?.getPlaywrightProxy()
      this.context = await (await this.ensureBrowser()).newContext({ storageState: decoded.state, serviceWorkers: 'block', ...(this.activeProxy ? { proxy: this.activeProxy } : {}) })
      enforcePageLimit(this.context, this.maxPages)
      for (const page of this.pages.values()) await page.close().catch(() => {})
      this.pages.clear()
      this.touch()
      return true
    }
    if (decoded.accountId) {
      const current = this.accountMgr?.getCurrentId()
      if (!current || current !== decoded.accountId) throw new Error('Encrypted session belongs to a different account')
      await this.accountMgr!.restoreAccountStorageState(current, decoded.state)
      this.touch()
      return true
    }
    if (this.accountMgr) throw new Error('A default-context session cannot be restored while account isolation is enabled')
    await this.context?.close().catch(() => {})
    if (!this.activeProxy) this.activeProxy = this.proxyMgr?.getPlaywrightProxy()
    this.context = await (await this.ensureBrowser()).newContext({ storageState: decoded.state, serviceWorkers: 'block', ...(this.activeProxy ? { proxy: this.activeProxy } : {}) })
    enforcePageLimit(this.context, this.maxPages)
    for (const page of this.pages.values()) await page.close().catch(() => {})
    this.pages.clear()
    this.touch()
    return true
  }

  private async ensureBrowser(): Promise<Browser> {
    if (!this.browser) this.browser = await chromium.launch({ headless: this.config.headless ?? true, executablePath: this.config.executablePath ?? undefined, args: ['--disable-dev-shm-usage', '--disable-gpu'] })
    return this.browser
  }

  async getAccountPage(id: string, url?: string): Promise<Page> {
    if (!this.accountMgr) throw new Error('No accounts configured')
    const page = await this.accountMgr.getAccountPage(id, url)
    this.touch()
    return page
  }

  switchAccount(id: string): void {
    this.touch()
    if (!this.accountMgr) throw new Error('No accounts configured')
    this.accountMgr.setCurrent(id)
  }

  listAccounts(): string[] { return this.accountMgr?.listAccounts() ?? [] }
  getCurrentAccount(): string | null { return this.accountMgr?.getCurrentId() ?? null }
  hasAccounts(): boolean { return !!this.accountMgr?.count }

  async getWaf(): Promise<string> {
    const page = await this.getPage()
    return await page.evaluate(() => (window as Window & { __browserWaf?: string }).__browserWaf ?? 'unknown').catch(() => 'unknown')
  }

  getInfo() {
    const pageCount = this.accountMgr ? this.accountMgr.getPageCount() : [...this.pages.values()].filter(p => !p.isClosed()).length
    return {
      enabled: this.config.session?.enabled ?? false,
      sessionId: this.sessionId,
      pageCount,
      maxPages: this.maxPages,
      timeoutMs: this.idleTimeoutMs,
      idleForMs: Date.now() - this.lastActivityAt,
      runtimeActive: !!this.context || !!this.browser || !!this.accountMgr?.getPageCount(),
      currentAccount: this.getCurrentAccount(),
    }
  }

  getAccounts(): AccountManager | null { return this.accountMgr }

  async close(): Promise<void> {
    this.closed = true
    if (this.idleTimer) clearTimeout(this.idleTimer)
    await this.closeRuntime()
    this.accountMgr = null
  }
}
