/**
 * Anti-cloudflare browser-use provider for DeepSeek Harness.
 * Registers as a single `browserUse` provider with stealth-patched Chromium.
 * @module @mulqi/dsh-browser-anti-cloudflare
 */

/// <reference types="@deepseek-ai/dsh-browser-use" />
import type { Context } from '@deepseek-ai/cordis'
import { BrowserUseProviderName } from '@deepseek-ai/dsh-browser-use/brand'
import { mountAcTools } from './tools.js'

/** Cordis identity for this provider. Must be unique across all browser-use providers. */
export const name = 'dsh-browser-anti-cloudflare'

/** Services required before activation. Matches stagehand-native pattern. */
export const inject = ['browserUse', 'agents', 'tools', 'systemPrompt']

/** Plugin configuration schema. Defaults are conservative for headless stealth browsing. */
export interface Config {
  /** Run Chromium without a visible window (recommended for agents). */
  headless?: boolean
  /** Per-operation timeout in milliseconds. */
  operationTimeoutMs?: number
  /** Optional absolute path to a custom Chrome / Chromium binary. */
  executablePath?: string
  /** Session persistence options. When enabled, navigate/click/type/eval calls
   *  share the same browser context, preserving cookies and localStorage. */
  session?: {
    /** Enable persistent sessions (default: false) */
    enabled?: boolean
    /** Session timeout in ms (default: 120000) */
    timeoutMs?: number
    /** Max concurrent pages (default: 5) */
    maxPages?: number
    /** Directory for session files (default: ~/.cache/browser-anti-cloudflare/sessions) */
    sessionDir?: string
  }
  /** Multi-account rotation config. When set, each account gets isolated browser context. */
  accounts?: Array<{
    /** Unique account identifier */
    id: string
    /** Fingerprint profile: 'auto', 'windows', 'mac', or 'linux' */
    fingerprint?: 'auto' | 'windows' | 'mac' | 'linux'
    /** Optional proxy URL for this account */
    proxyUrl?: string
  }>
  proxy?: {
    /** Single proxy URL (http:// or socks5://) */
    url?: string
    /** Multiple proxy URLs for rotation */
    urls?: string[]
    /** Optional auth username */
    username?: string
    /** Optional auth password */
    password?: string
    /** Enable round-robin rotation (default: true when multiple proxies) */
    rotate?: boolean
  }
}

/** Default config values resolved at apply()-time. */
type ResolvedConfig = Required<Pick<Config, 'headless' | 'operationTimeoutMs'>> & Omit<Config, 'headless' | 'operationTimeoutMs'>
const DEFAULTS: ResolvedConfig = { headless: true, operationTimeoutMs: 45000 }

/**
 * Mount the anti-cloudflare browser-use provider.
 * Throws at boot if another browser-use provider already holds the slot.
 * @param ctx - Cordis context providing browserUse, tools, agents, systemPrompt.
 * @param input - optional profile configuration (merged with defaults).
 */
export function apply(ctx: Context, input: Config = {}): void {
  const config: ResolvedConfig = { ...DEFAULTS, ...input }

  // Precondition: verify no other browser-use provider has claimed the slot.
  if (ctx.browserUse.providerName !== undefined) {
    throw new Error(
      `[${name}] browserUse slot is already taken by: ${ctx.browserUse.providerName}. ` +
        `Disable or remove the competing provider(s) in your profile's cordis.patch.yml — ` +
        `only one browser-use provider may be active per DSH profile.`,
    )
  }

  ctx.effect(function* () {
    yield ctx.browserUse.register(BrowserUseProviderName(name))
    mountAcTools(ctx, config)
  }, `${name}.runtime`)
}

/**
 * Smoke-test hello-world export. Returns 'ok' to confirm the module loads correctly.
 */
export function hello(): string {
  return 'ok'
}
