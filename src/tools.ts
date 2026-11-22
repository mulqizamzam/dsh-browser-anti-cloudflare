import type { Context } from '@deepseek-ai/cordis'
import { createMcpToolDefinition } from '@deepseek-ai/dsh-mcp-client'
import type { Config } from './index.js'
import { SessionManager, } from './session.js'
import { validateSelector, validateTextInput } from './security.js'

export type AcOperation = 'navigate' | 'screenshot' | 'click' | 'type' | 'eval' | 'session_save' | 'session_load' | 'session_status' | 'diagnostics'
const SCHEMAS: Record<AcOperation, Record<string, { type: string; description: string }>> = {
  navigate: { url: { type: 'string', description: 'Public HTTP(S) URL to navigate to.' } },
  screenshot: { url: { type: 'string', description: 'Public HTTP(S) URL to capture.' }, fullPage: { type: 'boolean', description: 'Capture full page.' } },
  click: { url: { type: 'string', description: 'Public HTTP(S) URL.' }, selector: { type: 'string', description: 'CSS selector.' } },
  type: { url: { type: 'string', description: 'Public HTTP(S) URL.' }, selector: { type: 'string', description: 'CSS selector.' }, text: { type: 'string', description: 'Text to fill.' } },
  eval: { url: { type: 'string', description: 'Public HTTP(S) URL.' }, expression: { type: 'string', description: 'Trusted JavaScript expression; disabled unless allowUnsafeEval=true.' } },
  session_save: { label: { type: 'string', description: 'Safe filename label.' } },
  session_load: { path: { type: 'string', description: 'Path to an encrypted session file inside sessionDir.' } },
  session_status: {},
  diagnostics: {},
}
const DESCRIPTIONS: Record<AcOperation, string> = {
  navigate: 'Navigate to an authorized public HTTP(S) page. Internal/private network destinations are blocked.',
  screenshot: 'Capture a screenshot of a public HTTP(S) page.',
  click: 'Navigate to a public page and click a CSS selector.',
  type: 'Navigate to a public page and fill a CSS selector.',
  eval: 'Run trusted page JavaScript only when explicitly enabled in configuration.',
  session_save: 'Save encrypted browser storage state.',
  session_load: 'Restore an authenticated encrypted browser storage state.',
  session_status: 'Show browser session status.',
  diagnostics: 'Show bounded, privacy-safe runtime diagnostic events and counters.',
}
const GUIDANCE = `Browser tools only navigate to public HTTP(S) destinations. Private, loopback, link-local, and reserved network addresses are blocked, including subresource requests and redirects. WAF detection is passive: the browser reports observed protection/challenge signals and does not forge tokens, defeat CAPTCHA, or bypass access controls. Use site-authorized APIs or complete verification through the site's normal flow. Browser eval is disabled unless explicitly enabled for a trusted workflow. Session files require an encryption key. Runtime diagnostics retain a bounded in-memory event history and omit URLs, selectors, form values, page content, session paths, and credentials.`

export function mountAcTools(ctx: Context, config: Config): () => Promise<void> {
  const manager = new SessionManager(config)
  for (const op of Object.keys(SCHEMAS) as AcOperation[]) {
    ctx.tools.register(createMcpToolDefinition(ctx, {
      name: `ac_browser_${op}`, rawName: op, description: DESCRIPTIONS[op],
      inputSchema: {
        type: 'object',
        properties: Object.fromEntries(Object.entries(SCHEMAS[op]).map(([k,v]) => [k, { type: v.type, description: v.description }])),
        required: ['url'].filter(() => ['navigate','screenshot','click','type','eval'].includes(op)),
        additionalProperties: false,
      },
      async call(args: Record<string, unknown>) {
        return manager.runExclusive(async () => {
          const startedAt = Date.now()
          const timeout = config.operationTimeoutMs ?? 45000
          try {
            const result = await (async () => {
              switch (op) {
                case 'navigate': {
                  const response = await manager.navigate(String(args.url ?? ''), timeout)
                  return { url: String(args.url), status: response?.status() ?? 0, waf: await manager.getWaf() }
                }
                case 'screenshot': return manager.screenshot(String(args.url ?? ''), timeout, args.fullPage === true)
                case 'click': return { success: true, url: await manager.click(String(args.url ?? ''), validateSelector(String(args.selector ?? '')), timeout) }
                case 'type': return { success: true, url: await manager.type(String(args.url ?? ''), validateSelector(String(args.selector ?? '')), validateTextInput(String(args.text ?? '')), timeout) }
                case 'eval': return { result: await manager.evaluate(String(args.url ?? ''), String(args.expression ?? ''), timeout) }
                case 'session_save': return manager.saveSession(String(args.label ?? 'default'))
                case 'session_load': return { success: await manager.loadSession(String(args.path ?? '')) }
                case 'session_status': return manager.getInfo()
                case 'diagnostics': return manager.getDiagnostics()
              }
            })()
            manager.recordDiagnostic('tool.completed', 'info', { operation: op }, Date.now() - startedAt)
            return result
          } catch (error) {
            manager.recordDiagnostic('tool.failed', 'error', {
              operation: op,
              errorType: error instanceof Error ? error.name : 'UnknownError',
            }, Date.now() - startedAt)
            throw error
          }
        })
      },
    }))
  }
  ctx.systemPrompt.section({ name: 'browser-use:anti-cloudflare', text: GUIDANCE, order: ctx.systemPrompt.getSectionOrder('TOOL_COMPUTER_USE') })
  return () => manager.close()
}
