
import { Context } from "@deepseek-ai/cordis";
/** Cordis identity for this provider. Must be unique across all browser-use providers. */
declare const name = "dsh-browser-anti-cloudflare";
/** Services required before activation. Matches stagehand-native pattern. */
declare const inject: string[];
/** Plugin configuration schema. Defaults are conservative for headless stealth browsing. */
interface Config {
  /** Run Chromium without a visible window (recommended for agents). */
  headless?: boolean;
  /** Per-operation timeout in milliseconds. */
  operationTimeoutMs?: number;
  /** Optional absolute path to a custom Chrome / Chromium binary. */
  executablePath?: string;
  /** Session persistence options. When enabled, navigate/click/type/eval calls
   *  share the same browser context, preserving cookies and localStorage. */
  session?: {
    /** Enable persistent sessions (default: false) */
    enabled?: boolean;
    /** Session timeout in ms (default: 120000) */
    timeoutMs?: number;
    /** Max concurrent pages (default: 5) */
    maxPages?: number;
    /** Directory for session files (default: ~/.cache/browser-anti-cloudflare/sessions) */
    sessionDir?: string;
  };
  /** Multi-account rotation config. When set, each account gets isolated browser context. */
  accounts?: Array<{
    /** Unique account identifier */
    id: string;
    /** Fingerprint profile: 'auto', 'windows', 'mac', or 'linux' */
    fingerprint?: 'auto' | 'windows' | 'mac' | 'linux';
    /** Optional proxy URL for this account */
    proxyUrl?: string;
  }>;
  proxy?: {
    /** Single proxy URL (http:// or socks5://) */
    url?: string;
    /** Multiple proxy URLs for rotation */
    urls?: string[];
    /** Optional auth username */
    username?: string;
    /** Optional auth password */
    password?: string;
    /** Enable round-robin rotation (default: true when multiple proxies) */
    rotate?: boolean;
  };
}
/**
 * Mount the anti-cloudflare browser-use provider.
 * Throws at boot if another browser-use provider already holds the slot.
 * @param ctx - Cordis context providing browserUse, tools, agents, systemPrompt.
 * @param input - optional profile configuration (merged with defaults).
 */
declare function apply(ctx: Context, input?: Config): void;
/**
 * Smoke-test hello-world export. Returns 'ok' to confirm the module loads correctly.
 */
declare function hello(): string;
export { Config, apply, hello, inject, name };
