# @mulqi/dsh-browser-anti-cloudflare — Agent Quick-Start

**Purpose:** Registers as an exclusive `browserUse` provider in a DSH profile. Launches
a stealth-patched Chromium that injects anti-detection scripts (clears `navigator.webdriver`,
neutralises WebGL renderer strings) before every navigation — designed to pass Cloudflare
"Checking your browser" challenges. Tool names are prefixed `ac_` to avoid collision with
core `browser_*` tools.

## Build

```bash
npx tsdown          # ESM bundle → lib/index.js (+ types)
```

## Typecheck

```bash
npx tsc --noEmit    # strict TypeScript check against src/
```

## Tests

```bash
npx vitest run      # 3 integration tests (local HTTP server + headless Chromium)
```

## Install from GitHub (one-command, recommended)

```bash
dsh plugin --profile <name> add "github:mulqizamzam/nk-browser-anti-cloudflare#main"
```

The CLI runs `pnpm add` in the profile directory and auto-registers the bundle into
`dsh.profile.bundles`. No manual manifest editing is needed.

## Install from local checkout

For development where source changes should take effect on next boot:

```bash
# Symlink (recommended for active dev)
dsh plugin --profile <name> add link:/path/to/nk-browser-anti-cloudflare

# Or copy the tree
dsh plugin --profile <name> add file:/path/to/nk-browser-anti-cloudflare
```

Before using `file:` or `link:`, run `pnpm install` in the repository so peer
deps (`@deepseek-ai/*`) are available.

## Manual install (copy-paste cordis patch)

1. Copy-paste the contents of **`cordis.patch.yml`** into your profile's patch list under `- insert:`.
2. Ensure **no other** browser-use provider (stagehand-native, playwright-mcp, chrome-devtools-mcp)
   is also mounted — this plugin claims the **exclusive** `browserUse` slot and will throw at boot
   if another provider is already registered.
3. Reload the profile:

    ```bash
    dsh plugin --profile <name> reload
    ```

4. Verify the mount line appears:

    ```bash
    dsh --profile <name> --dump-config | grep browser-anti-cloudflare
    ```

5. Remove when done:

    ```bash
    dsh plugin --profile <name> remove @mulqi/dsh-browser-anti-cloudflare
    ```

## Slot Exclusivity Warning

This plugin calls `ctx.browserUse.register(BrowserUseProviderName('nk-browser-anti-cloudflare'))`
inside `apply()`. If the same slot is already held by another provider, Cordis throws at
registration time and the profile fails to boot. Disable or remove any competing
`browserUse` provider before installing this one.
