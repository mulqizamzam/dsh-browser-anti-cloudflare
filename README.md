# @mulqi/dsh-browser-anti-cloudflare

Anti-detection browser-use provider for DeepSeek Harness. Passes Cloudflare "Checking your browser" challenges by stripping `navigator.webdriver`, randomising WebGL/renderer fingerprints, and injecting anti-bot scripts before every navigation.

## Tools

| Tool | Description |
|------|-------------|
| `ac_browser_navigate` | Navigate to a URL with stealth patches applied. |
| `ac_browser_screenshot` | Capture a screenshot of the stealth page. |
| `ac_browser_click` | Click an element by CSS selector. |
| `ac_browser_type` | Type text into an input element. |
| `ac_browser_eval` | Evaluate JavaScript in page context. |

All tools accept a `url` argument. Screenshot supports `fullPage`. Click/type support `selector`. Eval supports `expression`.

## Installation

```bash
dsh plugin add github:mulqizamzam/nk-browser-anti-cloudflare
```

Or clone locally and install from path:

```bash
dsh plugin add /path/to/nk-browser-anti-cloudflare
```

## Configuration

Add to your profile's `cordis.patch.yml`:

```yaml
- insert:
    - id: browser-anti-cloudflare
      name: '@mulqi/dsh-browser-anti-cloudflare'
      config:
        headless: true
        operationTimeoutMs: 45000
```

### Options

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `headless` | boolean | `true` | Run Chromium without a visible window. |
| `operationTimeoutMs` | number | `45000` | Per-operation timeout. |
| `executablePath` | string | — | Custom Chrome/Chromium binary path. |

## Compatibility

- **DSH:** `0.2.1-rc.2` (exact pin via `engines.dsh`)
- **Playwright:** `^1.61.0`
- **Browser:** Chromium only (Firefox/WebKit not supported — stealth patches target Chromium CDP)

## Exclusive slot warning

This plugin holds the single `browserUse` provider slot. It **cannot coexist** with:

- `@deepseek-ai/dsh-experimental-browser-use-stagehand-native`
- `@deepseek-ai/dsh-experimental-browser-use-playwright-mcp`
- `@deepseek-ai/dsh-experimental-browser-use-chrome-devtools-mcp`

Disable any of those providers in your profile before installing this one.

## Anti-detection techniques

1. `navigator.webdriver` → redefined as `undefined`
2. `navigator.plugins` → returns realistic array
3. `navigator.languages` → `['en-US', 'en']`
4. `navigator.hardwareConcurrency` → randomised 4–7
5. WebGL renderer unmask strings → neutralised
6. `chrome.runtime` shim injected
7. `SharedArrayBuffer` → undefined
8. Permission queries for `notifications` → denied
9. Custom user-agent string (Chrome 131 on Windows)
10. `--disable-blink-features=AutomationControlled` launch flag

## License

MIT
