import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'
import { mkdir, readFile, writeFile, realpath, lstat } from 'node:fs/promises'
import { join, resolve, sep }
import { chromium } from 'playwright'
import type { Browser, BrowserContext, Page, StorageState } from 'playwright'
import type { Config } from './index.js'
import { navigateWithStealth } from './stealth.js'
import { createProxyManager } from './proxy.js'
import { AccountManager } from './accounts.js'
import { assertSafeUrl } from './security.js'

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
export class SessionManager {
  private browser: Browser | null = null
  private context: BrowserContext | null = null
  private pages = new Map<string, Page>()
  private accountMgr: AccountManager | null = null
  private proxyMgr
  private readonly sessionId = randomBytes(12).toString('hex')
  private readonly sessionDir: string
  constructor(private readonly config: Config) {
    this.sessionDir = resolve(config.session?.sessionDir ?? join(process.env.HOME || '/tmp', '.cache', 'browser-anti-cloudflare', 'sessions'))
    this.proxyMgr = createProxyManager(config.proxy)
    if (config.accounts?.length) {
      this.accountMgr = new AccountManager(config)
      for (const account of config.accounts) this.accountMgr.register(account)
      this.accountMgr.setCurrent(config.accounts[0].id)
    }
  }
  private async ensureContext(): Promise<BrowserContext> {
    if (this.context) return this.context
    this.browser = await chromium.launch({ headless: this.config.headless ?? true, executablePath: this.config.executablePath ?? undefined, args: ['--disable-dev-shm-usage', '--disable-gpu'] })
    const proxy = this.proxyMgr?.getPlaywrightProxy()
    this.context = await this.browser.newContext({ ...(proxy ? { proxy } : {}) })
    return this.context
  }
  async getPage(url?: string): Promise<Page> {
    if (this.accountMgr && this.accountMgr.getCurrentId()) {
      const page = await this.accountMgr.getAccountPage(this.accountMgr.getCurrentId()!)
      if (url) await assertSafeUrl(url)
      return page
    }
    let page = this.pages.get('default')
    if (!page || page.isClosed()) { page = await (await this.ensureContext()).newPage(); this.pages.set('default', page) }
    if (url) await assertSafeUrl(url)
    return page
  }
  async navigate(url: string, timeoutMs: number): Promise<import('playwright').Response | null> {
    const page = await this.getPage()
    return navigateWithStealth(page, url, timeoutMs)
  }
  async screenshot(url: string, timeoutMs: number, fullPage = false): Promise<{ data: string; mimeType: string; width: number; height: number }> {
    const page = await this.getPage()
    await navigateWithStealth(page, url, timeoutMs, { allowPrivateNetworks: this.config.allowPrivateNetworks })
    const data = await page.screenshot({ fullPage, type: 'png' })
    return { data: data.toString('base64'), mimeType: 'image/png', width: page.viewportSize()?.width ?? 1280, height: page.viewportSize()?.height ?? 800 }
  }
  async click(url: string, selector: string, timeoutMs: number): Promise<string> {
    const page = await this.getPage()
    await navigateWithStealth(page, url, timeoutMs)
    await page.locator(selector).click({ timeout: timeoutMs })
    return page.url()
  }
  async type(url: string, selector: string, value: string, timeoutMs: number): Promise<string> {
    const page = await this.getPage()
    await navigateWithStealth(page, url, timeoutMs)
    await page.locator(selector).fill(value, { timeout: timeoutMs })
    return page.url()
  }
  async evaluate(url: string, expression: string, timeoutMs: number): Promise<unknown> {
    if (!this.config.allowUnsafeEval) throw new Error('Browser eval is disabled. Set allowUnsafeEval=true only for trusted local workflows.')
    const page = await this.getPage()
    await navigateWithStealth(page, url, timeoutMs)
    return page.evaluate(expression)
  }
  async saveSession(label = 'default'): Promise<{ path: string; size: number }> {
    if (!this.config.session?.enabled) throw new Error('Session persistence is disabled')
    const secret = this.config.session.encryptionKey
    if (!secret || secret.length < 32) throw new Error('Session persistence requires session.encryptionKey with at least 32 characters')
    if (!/^[a-zA-Z0-9_-]{1,48}$/.test(label)) throw new Error('Session label must contain 1–48 letters, numbers, _ or -')
    if (this.accountMgr) throw new Error('Encrypted session save/load is currently supported only for the default isolated browser context; account-specific persistence is intentionally disabled')
    const context = await this.ensureContext()
    const state: StorageState = await context.storageState()
    await mkdir(this.sessionDir, { recursive: true, mode: 0o700 })
    const path = join(this.sessionDir, `${label}-${this.sessionId}.session`)
    const content = encrypt(JSON.stringify({ version: 1, createdAt: Date.now(), state }), secret)
    await writeFile(path, content, { encoding: 'utf8', mode: 0o600 })
    return { path, size: Buffer.byteLength(content) }
  }
  async loadSession(path: string): Promise<boolean> {
    if (!this.config.session?.enabled) throw new Error('Session persistence is disabled')
    const secret = this.config.session.encryptionKey
    if (!secret || secret.length < 32) throw new Error('Session persistence requires session.encryptionKey with at least 32 characters')
    if (this.accountMgr) throw new Error('Encrypted session save/load is currently supported only for the default isolated browser context; account-specific persistence is intentionally disabled')
    const requested = resolve(path)
    const root = await realpath(this.sessionDir).catch(async () => { await mkdir(this.sessionDir, { recursive: true, mode: 0o700 }); return realpath(this.sessionDir) })
    const actual = await realpath(requested)
    if (actual !== root && !actual.startsWith(root + sep)) throw new Error('Session path must remain inside the configured session directory')
    const info = await lstat(actual)
    if (!info.isFile() || info.isSymbolicLink()) throw new Error('Session path must be a regular file')
    const decoded = JSON.parse(decrypt(await readFile(actual, 'utf8'), secret))
    if (decoded.version !== 1 || !decoded.state || !Array.isArray(decoded.state.cookies)) throw new Error('Invalid session payload')
    await this.context?.close().catch(() => {})
    this.context = await (await this.ensureBrowser()).newContext({ storageState: decoded.state })
    for (const page of this.pages.values()) await page.close().catch(() => {})
    this.pages.clear()
    return true
  }
  private async ensureBrowser(): Promise<Browser> {
    if (!this.browser) this.browser = await chromium.launch({ headless: this.config.headless ?? true, executablePath: this.config.executablePath ?? undefined, args: ['--disable-dev-shm-usage', '--disable-gpu'] })
    return this.browser
  }
  switchAccount(id: string): void { if (!this.accountMgr) throw new Error('No accounts configured'); this.accountMgr.setCurrent(id) }
  listAccounts(): string[] { return this.accountMgr?.listAccounts() ?? [] }
  getCurrentAccount(): string | null { return this.accountMgr?.getCurrentId() ?? null }
  hasAccounts(): boolean { return !!this.accountMgr?.count }
  getInfo() { return { enabled: this.config.session?.enabled ?? false, sessionId: this.sessionId, pageCount: this.accountMgr ? 0 : [...this.pages.values()].filter(p => !p.isClosed()).length, maxPages: this.config.session?.maxPages ?? 5, currentAccount: this.getCurrentAccount() } }
  getAccounts(): AccountManager | null { return this.accountMgr }
  async close(): Promise<void> {
    for (const page of this.pages.values()) await page.close().catch(() => {})
    this.pages.clear()
    await this.accountMgr?.closeAll().catch(() => {})
    await this.context?.close().catch(() => {})
    await this.browser?.close().catch(() => {})
    this.context = null; this.browser = null; this.accountMgr = null
  }
}
