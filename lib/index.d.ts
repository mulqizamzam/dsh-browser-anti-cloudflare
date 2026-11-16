
import { Context } from "@deepseek-ai/cordis";
/** Cordis identity for this provider. Must be unique across all browser-use providers. */
declare const name = "nk-browser-anti-cloudflare";
/** Services required before activation. Matches stagehand-native pattern. */
declare const inject: string[];
/** Plugin configuration schema. Defaults are conservative for headless stealth browsing. */
interface Config {
  /** Run Chromium without a visible window (recommended for agents). */
  headless?: boolean;
  /** Per-operation timeout in milliseconds. */
  operationTimeoutMs?: number;
  /** Optional absolute path to a custom Chromium/Chrome executable. */
  executablePath?: string;
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
