# @mulqi/dsh-browser-anti-cloudflare

Anti-detection browser-use provider for DeepSeek Harness. Passes Cloudflare "Checking your browser" challenges by stripping `navigator.webdriver`, randomising WebGL/renderer fingerprints, and injecting anti-bot scripts before every navigation.

## Tools

| Tool | Description |
|------|-------------|
| `ac_browser_navigate` | Navigate to a URL with stealth patches applied. Returns `{ url, title, status }`. |
| `ac_browser_screenshot` | Capture a screenshot of the stealth page. Returns base64 PNG data. Supports `fullPage`. |
| `ac_browser_click` | Click an element by CSS selector after navigating to the URL. |
| `ac_browser_type` | Type text into an input element identified by CSS selector. |
| `ac_browser_eval` | Evaluate JavaScript in page context and return the result. |

All tools require a `url` argument. Each call launches a fresh stealth Chromium instance, performs the operation, then tears it down — keeping state minimal and avoiding cross-call leaks.

## Installation

### From GitHub (recommended)

```bash
dsh plugin --profile <name> add "github:mulqizamzam/nk-browser-anti-cloudflare#main"
```

Replace `<name>` with your profile name (e.g., `web`). The CLI runs `pnpm add` in the profile directory and — because this package declares `dsh.bundle` → `./cordis.patch.yml` — registers the bundle into `dsh.profile.bundles` automatically. No manual manifest editing is needed.

**Important:** Because this package has a `prepare` script (`npm run build`), pnpm requires an explicit `allowBuilds` entry in your profile's `pnpm-workspace.yaml` the first time you install from GitHub. Add this block if it does not already exist:

```yaml
# In <profile-dir>/pnpm-workspace.yaml
allowBuilds:
  '@mulqi/dsh-browser-anti-cloudflare@git+https://github.com/mulqizamzam/nk-browser-anti-cloudflare.git': true
```

After adding the entry, re-run the `dsh plugin add` command. Subsequent installs do not require this step.

### From a local checkout

For development or when you want live changes reflected immediately:

```bash
# Copy the tree into node_modules
dsh plugin --profile <name> add file:/path/to/nk-browser-anti-cloudflare

# Or symlink (changes to src/ take effect on next boot without reinstall)
dsh plugin --profile <name> add link:/path/to/nk-browser-anti-cloudflare
```

Before installing via `file:` or `link:`, run `pnpm install` in the repository so that peer dependencies (`@deepseek-ai/*`) are present. Profile symlinks do not bootstrap deps of the linked package.

### Verify

Without booting the host, confirm the bundle mounted correctly:

```bash
dsh --profile <name> --dump-config | grep browser-anti-cloudflare
```

A healthy mount line appears with no `skipping profile bundle` entry. After a profile restart, the boot log prints the provider registration.

### Remove

```bash
dsh plugin --profile <name> remove @mulqi/dsh-browser-anti-cloudflare
```

### Host version pin

This plugin pins `engines.dsh` to `0.2.1-rc.2` exactly. On a newer or older Harness the bundle is refused at boot ("skipping profile bundle"). To stay on a different host version while accepting the risk:

```bash
dsh plugin --profile <name> allow-version \
  @mulqi/dsh-browser-anti-cloudflare@0.1.0 \
  --dsh-version <exact-host-version> \
  --accept-risk
```

## Configuration

The plugin reads its config from the profile's `cordis.patch.yml`. Add the following row under `- insert:`:

```yaml
- insert:
    - id: browser-anti-cloudflare
      name: '@mulqi/dsh-browser-anti-cloudflare'
      config:
        headless: true
        operationTimeoutMs: 45000
```

Then reload the profile:

```bash
dsh plugin --profile <name> reload
```

### Options

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `headless` | boolean | `true` | Run Chromium without a visible window. Set to `false` to see the browser during development. |
| `operationTimeoutMs` | number | `45000` | Per-operation timeout (navigate, click, type, eval). |
| `executablePath` | string | — | Absolute path to a custom Chrome / Chromium binary. Useful when the system Chromium is too old. |

## Compatibility

- **DSH:** `0.2.1-rc.2` (exact pin via `engines.dsh`)
- **Playwright:** `^1.65.1`
- **Browser:** Chromium only — Firefox and WebKit are not supported because stealth patches target Chromium CDP events.

## Exclusive slot warning

This plugin claims the single `browserUse` provider slot in a DSH profile. It **cannot coexist** with any of these providers:

- `@deepseek-ai/dsh-experimental-browser-use-stagehand-native`
- `@deepseek-ai/dsh-experimental-browser-use-playwright-mcp`
- `@deepseek-ai/dsh-experimental-browser-use-chrome-devtools-mcp`

If another provider is already registered, the profile fails to boot with:

```
[browser-anti-cloudflare] browserUse slot is already taken by: <provider-name>.
Disable or remove the competing provider(s) in your profile's cordis.patch.yml —
only one browser-use provider may be active per DSH profile.
```

Disable or remove the competing provider before installing this one.

## Anti-detection techniques

1. `navigator.webdriver` → redefined as `undefined`
2. `navigator.plugins` → returns a realistic array
3. `navigator.languages` → `['en-US', 'en']`
4. `navigator.hardwareConcurrency` → randomised between 4–7
5. WebGL renderer / UNMASK strings → neutralised to hide the GPU vendor
6. `chrome.runtime` shim injected for extension APIs
7. `SharedArrayBuffer` → set to `undefined`
8. Permission queries for `notifications` → always denied
9. Custom user-agent string (Chrome 131 on Windows)
10. `--disable-blink-features=AutomationControlled` launch flag

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Profile refuses to boot after install | Another `browserUse` provider is mounted. Check `--dump-config` and remove the conflicting row. |
| `skipping profile bundle` in dump-config | Running Harness version doesn't match the pinned `0.2.1-rc.2`. Grant an exemption with `allow-version`, or switch to rc.2. |
| `ERR_MODULE_NOT_FOUND` for `@deepseek-ai/*` peers | Missing dependency install. Run `pnpm install` in the repo, or use `file:` install from a built checkout. |
| Cloudflare challenge still appears | The page may use a challenge beyond simple webdriver detection. Check that `headless: true` is set and that no other browser provider is active. |
| Screenshot returns empty base64 | Navigation timed out. Increase `operationTimeoutMs` or check network/firewall. |

## License

MIT
