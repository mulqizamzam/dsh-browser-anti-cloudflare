/**
 * ac_browser_* tool registrations for the anti-cloudflare provider.
 * Follows the pattern from stagehand-native: createMcpToolDefinition + systemPrompt section.
 * @module tools
 */

import type { Context } from '@deepseek-ai/cordis'
import { createMcpToolDefinition } from '@deepseek-ai/dsh-mcp-client'
import type { Browser, Page, Response } from 'playwright'
import { navigateWithStealth } from './stealth.js'
import { SessionManager } from './session.js'
import type { Config } from './index.js'

/** All supported operation names. */
export type AcOperation = 'navigate' | 'screenshot' | 'click' | 'type' | 'eval' | 'session_save' | 'session_load' | 'session_status'

/** Input schemas per operation — kept simple; full Playwright types not re-exported. */
const OP_SCHEMAS: Record<AcOperation, Record<string, { type: string; description: string }>> = {
  navigate: {
    url: { type: 'string', description: 'The target URL to navigate to.' },
  },
  screenshot: {
    url: { type: 'string', description: 'URL to capture a screenshot of.' },
    fullPage: { type: 'boolean', description: 'Capture full scrollable page (default false).' },
  },
  click: {
    url: { type: 'string', description: 'URL of the page to interact with.' },
    selector: { type: 'string', description: 'CSS selector of the element to click.' },
  },
  type: {
    url: { type: 'string', description: 'URL of the page containing the input.' },
    selector: { type: 'string', description: 'CSS selector of the input element.' },
    text: { type: 'string', description: 'Text to type into the element.' },
  },
  eval: {
    url: { type: 'string', description: 'URL of the page to evaluate on.' },
    expression: { type: 'string', description: 'JavaScript expression to evaluate in page context.' },
  },
  session_save: {
    label: { type: 'string', description: 'Label for the saved session (default: "default").' },
  },
  session_load: {
    path: { type: 'string', description: 'Path to the session JSON file to load.' },
  },
  session_status: {},
}

const DESCRIPTIONS: Record<AcOperation, string> = {
  navigate: 'Navigate the stealth browser to a URL, bypassing Cloudflare challenges.',
  screenshot: 'Capture a screenshot of the current page or a URL (anti-detect mode).',
  click: 'Click an element by CSS selector after navigating to the given URL.',
  type: 'Type text into an input element identified by CSS selector on the given URL.',
  eval: 'Evaluate a JavaScript expression in the page context and return the result.',
  session_save: 'Save the current browser session (cookies + localStorage) to disk for later restoration.',
  session_load: 'Load a previously saved browser session from a JSON file.',
  session_status: 'Return the current session state: enabled flag, active page count, and session ID.',
}

const GUIDANCE = `You have access to anti-cloudflare browser tools (ac_browser_*). They use a stealth-patched Chromium that strips navigator.webdriver, randomises WebGL/renderer fingerprints, and injects anti-detection scripts before every navigation — designed to pass Cloudflare "Checking your browser" challenges. Use these tools when browsing sites protected by Cloudflare or similar WAFs. Navigate first, then screenshot/click/type/eval as needed. For multi-step workflows, enable session persistence in your profile config to retain cookies across calls.`

interface BrowserResource {
  browser: Browser
  pages: Map<string, Page>
}

/** Register all ac_browser_* tools on the given context. */
export function mountAcTools(ctx: Context, config: Config): void {
  // Create a single SessionManager shared across all tool calls
  const sessionMgr = new SessionManager(config)

  const toolNames = new Set<string>()

  for (const op of Object.keys(OP_SCHEMAS) as AcOperation[]) {
    const toolName = `ac_browser_${op}`
    toolNames.add(toolName)
    ctx.tools.register(createMcpToolDefinition(ctx, {
      name: toolName,
      rawName: op,
      description: DESCRIPTIONS[op],
      inputSchema: {
        type: 'object',
        properties: Object.entries(OP_SCHEMAS[op]).reduce(
          (acc, [key, v]) => { acc[key] = { type: v.type, description: v.description }; return acc },
          {} as Record<string, unknown>,
        ),
        required: ['url'].filter(k => op === 'navigate' || op === 'screenshot' || op === 'click' || op === 'type' || op === 'eval'),
      },
      async call(args: Record<string, unknown>) {
        return runOp(op, args as Record<string, string | boolean>, config, sessionMgr)
      },
    }))
  }

  ctx.systemPrompt.section({
    name: 'browser-use:anti-cloudflare',
    text: GUIDANCE,
    order: ctx.systemPrompt.getSectionOrder('TOOL_COMPUTER_USE'),
  })

  // Session cleanup is handled by the process exiting; no explicit teardown hook needed
}

/**
 * Execute one ac_browser operation.
 * When session is enabled, reuses the persistent browser context.
 * When disabled, spawns a fresh browser per call (backward compatible).
 */
async function runOp(
  op: AcOperation,
  args: Record<string, string | boolean>,
  config: Config,
  sessionMgr: SessionManager,
): Promise<unknown> {
  const timeoutMs = (config.operationTimeoutMs ?? 45000)

  switch (op) {
    case 'navigate': {
      const url = String(args.url ?? '')
      const resp = await sessionMgr.navigate(url, timeoutMs)
      return { url: url, title: '(see status)', status: resp?.status() ?? 0 }
    }
    case 'session_save': {
      const label = String(args.label ?? 'default')
      const result = await sessionMgr.saveSession(label)
      return result
    }
    case 'session_load': {
      const path = String(args.path ?? '')
      const ok = await sessionMgr.loadSession(path)
      return { success: ok }
    }
    case 'session_status': {
      return sessionMgr.getInfo()
    }
    default: {
      // For screenshot/click/type/eval: use fresh browser per call (simpler, backward compatible)
      // These operations don't benefit much from session reuse since they navigate fresh each time
      const { launchStealthBrowser } = await import('./stealth.js')
      const debugMode = config.headless === false
      const browser = await launchStealthBrowser(config)
      try {
        const page = await browser.newPage()
        const url = String(args.url ?? '')
        switch (op) {
          case 'screenshot': {
            const fullPage = args.fullPage === true
            await navigateWithStealth(page, url, timeoutMs, { debug: debugMode })
            const buf = await page.screenshot({ fullPage, type: 'png' })
            return { data: buf.toString('base64'), mimeType: 'image/png', width: page.viewportSize()?.width ?? 1280, height: page.viewportSize()?.height ?? 800 }
          }
          case 'click': {
            await navigateWithStealth(page, url, timeoutMs, { debug: debugMode })
            const sel = String(args.selector ?? '')
            await page.waitForSelector(sel, { timeout: timeoutMs }).catch(() => {})
            await page.click(sel).catch((e: unknown) => { throw new Error(`click failed: ${String(e)}`) })
            return { success: true, url: page.url() }
          }
          case 'type': {
            await navigateWithStealth(page, url, timeoutMs, { debug: debugMode })
            const sel = String(args.selector ?? '')
            const txt = String(args.text ?? '')
            await page.waitForSelector(sel, { timeout: timeoutMs }).catch(() => {})
            await page.fill(sel, txt).catch((e: unknown) => { throw new Error(`type failed: ${String(e)}`) })
            return { success: true, url: page.url() }
          }
          case 'eval': {
            await navigateWithStealth(page, url, timeoutMs, { debug: debugMode })
            const expr = String(args.expression ?? 'true')
            const result = await page.evaluate(expr)
            return { result }
          }
        }
      } finally {
        await browser.close()
      }
    }
  }
}
