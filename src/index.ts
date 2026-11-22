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
  /** Explicit opt-in for trusted JavaScript execution inside page context. */
  allowUnsafeEval?: boolean
  /** Explicit development-only opt-in for loopback/private destinations. Never enable for untrusted inputs. */
  allowPrivateNetworks?: boolean
  session?: {
    enabled?: boolean
    timeoutMs?: number
    maxPages?: number
    sessionDir?: string
    /** Required for save/load; use a secret manager and at least 32 characters. */
    encryptionKey?: string
  }
  accounts?: Array<{ id: string; fingerprint?: 'auto' | 'windows' | 'mac' | 'linux'; proxyUrl?: string }>
  proxy?: { url?: string; urls?: string[]; username?: string; password?: string; rotate?: boolean }
}
export function apply(ctx: Context, input: Config = {}): void {
  const config: Config = { headless: true, operationTimeoutMs: 45000, ...input }
  if (config.session?.enabled && (!config.session.encryptionKey || config.session.encryptionKey.length < 32))
    throw new Error('session.encryptionKey (minimum 32 characters) is required when session persistence is enabled')
  if (ctx.browserUse.providerName !== undefined)
    throw new Error(`[${name}] browserUse slot is already taken by: ${ctx.browserUse.providerName}`)
  ctx.effect(function* () {
    yield ctx.browserUse.register(BrowserUseProviderName(name))
    mountAcTools(ctx, config)
  }, `${name}.runtime`)
}
export function hello(): string { return 'ok' }
