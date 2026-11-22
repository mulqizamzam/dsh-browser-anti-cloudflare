/** Browser-use provider for authorized browser automation with network and session safeguards. */
/// <reference types="@deepseek-ai/dsh-browser-use" />
import type { Context } from '@deepseek-ai/cordis'
import { BrowserUseProviderName } from '@deepseek-ai/dsh-browser-use/brand'
import { mountAcTools } from './tools.js'
export const name = 'dsh-browser-anti-cloudflare'
export const inject = ['browserUse', 'agents', 'tools', 'systemPrompt']
export interface Config {
  headless?: boolean
  operationTimeoutMs?: number
  executablePath?: string
  allowUnsafeEval?: boolean
  allowPrivateNetworks?: boolean
  session?: {
    enabled?: boolean
    /** Idle inactivity timeout in milliseconds; 0 disables automatic expiry. */
    timeoutMs?: number
    /** Maximum number of live pages per browser context. */
    maxPages?: number
    sessionDir?: string
    /** Legacy single key; retained to decrypt BAS1 sessions during migration. */
    encryptionKey?: string
    /** Versioned key ring. Keep old keys until sessions using them are re-saved. */
    encryptionKeys?: Record<string, string>
    /** Key ID used for newly saved sessions. */
    activeEncryptionKeyId?: string
  }
  accounts?: Array<{ id: string; fingerprint?: 'auto' | 'windows' | 'mac' | 'linux'; proxyUrl?: string }>
  proxy?: { url?: string; urls?: string[]; username?: string; password?: string; rotate?: boolean }
  observability?: { enabled?: boolean; maxEvents?: number }
}
export function apply(ctx: Context, input: Config = {}): void {
  const config: Config = { headless: true, operationTimeoutMs: 45000, ...input }
  if (config.session?.enabled) {
    const ring = config.session.encryptionKeys
    const activeId = config.session.activeEncryptionKeyId
    if (ring) {
      if (!activeId || !/^[a-zA-Z0-9_-]{1,32}$/.test(activeId) || !ring[activeId]) throw new Error('session.activeEncryptionKeyId must identify a key in session.encryptionKeys')
      if (Object.entries(ring).some(([id, key]) => !/^[a-zA-Z0-9_-]{1,32}$/.test(id) || typeof key !== 'string' || key.length < 32)) throw new Error('Every session.encryptionKeys entry requires a safe key ID and at least 32 characters')
    } else if (!config.session.encryptionKey || config.session.encryptionKey.length < 32) throw new Error('session.encryptionKey (minimum 32 characters) is required when session persistence is enabled')
  }
  if (ctx.browserUse.providerName !== undefined)
    throw new Error(`[${name}] browserUse slot is already taken by: ${ctx.browserUse.providerName}`)
  ctx.effect(function* () {
    yield ctx.browserUse.register(BrowserUseProviderName(name))
    yield mountAcTools(ctx, config)
  }, `${name}.runtime`)
}
export function hello(): string { return 'ok' }
