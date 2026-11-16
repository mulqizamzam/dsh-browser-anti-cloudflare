/**
 * ac_browser_* tool registrations for the anti-cloudflare provider.
 * Follows the pattern from stagehand-native: createMcpToolDefinition + systemPrompt section.
 * @module tools
 */

import type { Context } from '@deepseek-ai/cordis'
import { createMcpToolDefinition } from '@deepseek-ai/dsh-mcp-client'
import type { Browser, Page, Response } from 'playwright'
import { navigateWithStealth } from './stealth.js'
import type { Config } from './index.js'

/** All supported operation names. */
export type AcOperation = 'navigate' | 'screenshot' | 'click' | 'type' | 'eval'

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
}

const DESCRIPTIONS: Record<AcOperation, string> = {
  navigate: 'Navigate the stealth browser to a URL, bypassing Cloudflare challenges.',
  screenshot: 'Capture a screenshot of the current page or a URL (anti-detect mode).',
  click: 'Click an element by CSS selector after navigating to the given URL.',
  type: 'Type text into an input element identified by CSS selector on the given URL.',
  eval: 'Evaluate a JavaScript expression in the page context and return the result.',
}

const GUIDANCE = `You have access to anti-cloudflare browser tools (ac_browser_*). They use a stealth-patched Chromium that strips navigator.webdriver, randomises WebGL/renderer fingerprints, and injects anti-detection scripts before every navigation — designed to pass Cloudflare "Checking your browser" challenges. Use these tools when browsing sites protected by Cloudflare or similar WAFs. Navigate first, then screenshot/click/type/eval as needed. Always verify the page content after navigation.`

interface BrowserResource {
  browser: Browser
  pages: Map<string, Page>
}

/** Register all ac_browser_* tools on the given context. */
export function mountAcTools(ctx: Context, config: Config): void {
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
        required: ['url'],
      },
      async call(args: Record<string, unknown>) {
        return runOp(op, args as Record<string, string | boolean>, config)
      },
    }))
  }

  ctx.systemPrompt.section({
    name: 'browser-use:anti-cloudflare',
    text: GUIDANCE,
    order: ctx.systemPrompt.getSectionOrder('TOOL_COMPUTER_USE'),
  })

  // Intercept ac_browser_* calls so each gets a fresh stealth page.
  ctx.on('tools/execute', async (exec, next) => {
    if (!toolNames.has(exec.name)) return next()
    return next()
  })
}

/**
 * Execute one ac_browser operation. Each call launches a fresh stealth browser+page,
 * performs the operation, then closes. This keeps state minimal and avoids cross-call leaks.
 */
async function runOp(
  op: AcOperation,
  args: Record<string, string | boolean>,
  config: Config,
): Promise<unknown> {
  const { launchStealthBrowser } = await import('./stealth.js')
  const timeoutMs = (config.operationTimeoutMs ?? 45000)

  const browser = await launchStealthBrowser(config)
  try {
    const page = await browser.newPage()
    const url = String(args.url ?? '')
    switch (op) {
      case 'navigate': {
        const resp = await navigateWithStealth(page, url, timeoutMs)
        return { url: page.url(), title: await page.title(), status: resp?.status() ?? 0 }
      }
      case 'screenshot': {
        const fullPage = args.fullPage === true
        await navigateWithStealth(page, url, timeoutMs)
        const buf = await page.screenshot({ fullPage, type: 'png' })
        return { data: buf.toString('base64'), mimeType: 'image/png', width: page.viewportSize()?.width ?? 1280, height: page.viewportSize()?.height ?? 800 }
      }
      case 'click': {
        await navigateWithStealth(page, url, timeoutMs)
        const sel = String(args.selector ?? '')
        await page.waitForSelector(sel, { timeout: timeoutMs }).catch(() => {})
        await page.click(sel).catch((e: unknown) => { throw new Error(`click failed: ${String(e)}`) })
        return { success: true, url: page.url() }
      }
      case 'type': {
        await navigateWithStealth(page, url, timeoutMs)
        const sel = String(args.selector ?? '')
        const txt = String(args.text ?? '')
        await page.waitForSelector(sel, { timeout: timeoutMs }).catch(() => {})
        await page.fill(sel, txt).catch((e: unknown) => { throw new Error(`type failed: ${String(e)}`) })
        return { success: true, url: page.url() }
      }
      case 'eval': {
        await navigateWithStealth(page, url, timeoutMs)
        const expr = String(args.expression ?? 'true')
        const result = await page.evaluate(expr)
        return { result }
      }
    }
  } finally {
    await browser.close()
  }
}
