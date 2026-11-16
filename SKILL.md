---
name: nk-dsh-browser-anti-cloudflare-plugin
description: >
  Use when building a DeepSeek Harness plugin that provides browser tools with
  anti-detection/stealth capabilities to bypass Cloudflare and similar WAFs.
  Triggers on: "buat plugin browser anti-cloudflare", "browser stealth plugin",
  "cloudflare bypass DSH plugin", "nk-browser-anti-cloudflare". Symptoms: agent
  encounters Cloudflare challenge pages instead of real site content when using
  browser tools. Includes workspace-only dependency handling, exclusive
  browserUse slot management, and DSH verification workflows.
version: 1.0.0
tags: [dsh, plugin, browser, cloudflare, stealth, anti-detect, playwright]
---

# DSH Browser Anti-Cloudflare Plugin Builder

Build an independent DeepSeek Harness plugin that registers as a `browserUse`
provider with stealth-patched Chromium capable of bypassing Cloudflare challenges.

## Quick Reference

| Item | Detail |
|------|--------|
| Package name | `@mulqi/dsh-browser-anti-cloudflare` |
| Plugin identity | `nk-browser-anti-cloudflare` |
| DSH pin | `0.2.1-rc.2` (exact, NOT caret) |
| Provider slot | EXCLUSIVE — only one browser-use provider per profile |
| Tool prefix | `ac_` (avoids collision with core `browser_*`) |
| Build tool | tsdown (ESM, Node platform, inlineDynamicImports) |
| Stealth engine | Playwright + page.addInitScript() anti-detect injection |

## Architecture

```
src/
├── index.ts      # {name, inject, Config, apply(ctx, config)}
├── stealth.ts    # launchStealthBrowser(), navigateWithStealth()
└── tools.ts      # mountAcTools(ctx, config) → ac_browser_* registrations
lib/
└── index.js      # built bundle (tsdown output)
cordis.patch.yml  # profile install row
package.json      # manifest with engines.dsh exact pin
```

## Critical Constraints

### 1. Exclusive browserUse Slot
Only ONE plugin can hold `ctx.browserUse.register(name)` at a time. If another
provider (stagehand-native, playwright-mcp, chrome-devtools-mcp) is also mounted,
boot throws immediately: `"browser use provider '<other>' is already registered"`.

**Fix:** disable all other browser-use providers in the same profile's patch before
installing this one.

### 2. Workspace-Only Dependencies
All `@deepseek-ai/*` packages use `workspace:*` protocol internally. They are NOT
published to npm as standalone resolvable packages. Running `node -e "import('./lib/index.js')"`
outside the DSH pnpm workspace will fail with `ERR_MODULE_NOT_FOUND`.

**This is expected and affects ALL DSH plugins equally.** Testing must happen through:
```bash
dsh plugin --profile <name> add /path/to/plugin
dsh --profile <name> --dump-config   # verify mount line present
```

### 3. engines.dsh Pinning
Must use **exact** version pin, never caret (`^`). Caret pins fail compatibility
checks on DSH rc.x releases due to semver minor-lock behavior.

```json
"engines": { "dsh": "0.2.1-rc.2" }
```

## Source Files

### src/index.ts — Entry Module
```typescript
import type { Context } from '@deepseek-ai/cordis'
import { BrowserUseProviderName } from '@deepseek-ai/dsh-browser-use/brand'
import { mountAcTools } from './tools.ts'

export const name = 'nk-browser-anti-cloudflare'
export const inject = ['browserUse', 'agents', 'tools', 'systemPrompt']

export interface Config {
  headless?: boolean
  operationTimeoutMs?: number
  executablePath?: string
}

export function apply(ctx: Context, input: Config = {}): void {
  const config = { headless: true, operationTimeoutMs: 45000, ...input }
  ctx.effect(function* () {
    yield ctx.browserUse.register(BrowserUseProviderName(name))
    mountAcTools(ctx, config)
  }, `${name}.runtime`)
}
```

### src/stealth.ts — Anti-Detection Engine
Key techniques applied via `page.addInitScript()` BEFORE navigation:
- `navigator.webdriver` → `undefined`
- `navigator.plugins` → realistic array
- `navigator.languages` → `['en-US', 'en']`
- `navigator.hardwareConcurrency` → randomised 4–7
- WebGL UNMASKED_RENDERER/VENDOR → neutralized
- `chrome.runtime` shim injected
- `SharedArrayBuffer` → undefined
- Notification permission → denied
- `--disable-blink-features=AutomationControlled` launch flag

```typescript
const STEALTH_SCRIPT = `
(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
  Object.defineProperty(navigator, 'plugins', { get: () => [{}, {}, {}] })
  Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] })
  // ... full script in src/stealth.ts
})()
`

export async function navigateWithStealth(
  page: Page, url: string, timeoutMs: number
): Promise<void> {
  await page.addInitScript(STEALTH_SCRIPT)
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs })
}
```

### src/tools.ts — Tool Registration
Registers 5 tools with `ac_` prefix via `createMcpToolDefinition`:

| Tool | Args | Description |
|------|------|-------------|
| `ac_browser_navigate` | `{url}` | Navigate with stealth patches |
| `ac_browser_screenshot` | `{url, fullPage?}` | Capture screenshot |
| `ac_browser_click` | `{url, selector}` | Click element |
| `ac_browser_type` | `{url, selector, text}` | Type into input |
| `ac_browser_eval` | `{url, expression}` | Evaluate JS in page context |

Each tool call launches a fresh stealth browser, performs the operation, then
closes — keeping state minimal and avoiding cross-call leaks.

## Build & Install

### Build
```bash
cd packages/browser-anti-cloudflare
npx tsdown --config ./tsdown.config.ts
node --check lib/index.js && echo OK
```

### Install into DSH Profile
```bash
# Create test profile
export DSH_HOME=/tmp/dsh-test
dsh plugin --profile ac-test add /path/to/plugin
dsh plugin --profile ac-test add @deepseek-ai/dsh-browser-use

# Verify mount (no boot needed)
dsh --profile ac-test --dump-config | grep browser-anti-cloudflare

# Positive control: boot ≥ 20s
timeout 35 dsh --profile ac-test < /dev/null > /tmp/pos.log 2>&1
echo "EXIT: $?"  # 124 = survived timeout = alive
grep "browser-anti-cloudflare" /tmp/pos.log
```

### cordis.patch.yml
```yaml
- insert:
    - id: browser-anti-cloudflare
      name: '@mulqi/dsh-browser-anti-cloudflare'
      config:
        headless: true
        operationTimeoutMs: 45000
```

## Verification Checklist

- [ ] `node --check lib/index.js` exits 0
- [ ] Module exports `{name, inject, apply}`
- [ ] `apply()` calls `ctx.browserUse.register(BrowserUseProviderName(name))`
- [ ] All tool names prefixed `ac_` (no collision with core browser_* tools)
- [ ] `engines.dsh` is exact pin (no `^` or `~`)
- [ ] `dsh --profile <p> --dump-config \| grep <plugin-name>` shows mount line
- [ ] No `"skipping profile bundle"` or `"refused"` lines in dump
- [ ] Boot survives ≥ 20 seconds without crash (exit 124 = timeout = alive)
- [ ] Negative control: throw in `apply()` produces error marker in log

## Common Mistakes

| Mistake | Consequence | Fix |
|---------|------------|-----|
| Using `^0.2.1-rc.2` in engines.dsh | Compatibility rejection on next rc bump | Use exact `"0.2.1-rc.2"` |
| Registering second browserUse provider | Boot throws "already registered" | Ensure only one provider per profile |
| Naming tools `browser_*` | Collision with core tools, register throws | Use `ac_` prefix |
| Testing import outside DSH workspace | ERR_MODULE_NOT_FOUND for @deepseek-ai/* | Test via `dsh plugin add` + `--dump-config` |
| Forgetting `ctx.effect()` wrap | Resource leak, provider never released | Always wrap registration in `ctx.effect()` |
| Not closing browser after each call | Process leak, port exhaustion | Close browser in try/finally per operation |

## Files to Avoid

- Do NOT modify any file under `/home/administrator/deepseek-harness/packages/`
- Do NOT commit `node_modules/` to git
- Do NOT include `.env`, `state.json`, or real API tokens
- Do NOT add Firefox/WebKit support (stealth patches target Chromium CDP only)
