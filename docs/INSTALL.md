# Installation Guide — @mulqi/dsh-browser-anti-cloudflare

## Prerequisites

- DeepSeek Harness (`dsh`) installed and a profile active
- Node.js ≥ 18 (for ESM imports)
- Playwright Chromium available (`npx playwright install chromium`)

## One-Time Setup

### 1. Clone / place the package

```bash
git clone https://github.com/mulqizamzam/dsh-browser-anti-cloudflare.git
cd dsh-browser-anti-cloudflare
npm install        # installs dependencies + devDependencies (vitest, tsdown)
```

### 2. Build the bundle

```bash
npx tsdown
# Produces lib/index.js  and  lib/types/index.d.ts
```

Verify syntax without executing:

```bash
node --check lib/index.js && echo "syntax OK"
```

### 3. Run typecheck (optional but recommended)

```bash
npx tsc --noEmit
```

### 4. Run tests (requires local Chromium)

```bash
npx vitest run
# 3 tests: navigator.webdriver cleared · WebGL neutralised · navigate returns title+status
```

## Install into a DSH Profile

The plugin ships a **`cordis.patch.yml`** file. It must be merged into your profile's
Cordis configuration so that the provider mounts at boot.

### Step A — Open (or create) your profile patch file

```bash
# Locate your profile directory (default: ~/.config/dsh/profiles/<name>/)
# Edit the cordis.patch.yml inside it, or create it if absent.
```

### Step B — Copy-paste the install row

Append the following block verbatim under the top-level `- insert:` key:

```yaml
- insert:
    - id: browser-anti-cloudflare
      name: '@mulqi/dsh-browser-anti-cloudflare'
      config:
        headless: true
        operationTimeoutMs: 45000
```

> **Source:** this is the full content of the package's `cordis.patch.yml`.  
> Paste it unchanged; do not modify `id`, `name`, or config keys.

### Step C — Ensure no conflicting browser-use provider exists

This plugin claims the **single exclusive `browserUse` slot**. Before installing,
verify that no other provider (e.g. `stagehand-native`, `playwright-mcp`,
`chrome-devtools-mcp`) is also registered in the same profile:

```bash
dsh --profile <name> --dump-config | grep browserUse
```

If another provider appears, **disable or remove it first**:

```yaml
# In your profile's cordis.patch.yml, comment out or delete the competing entry:
# - insert:
#     - id: stagehand-native
#       name: '@deepseek-ai/dsh-stagehand-native'
```

Only one `browserUse` provider may be active per profile. Conflicting registrations
cause an immediate boot-time error.

### Step D — Reload the profile

```bash
dsh plugin --profile <name> reload
```

Or restart the session entirely:

```bash
dsh --profile <name> --dump-config | grep browser-anti-cloudflare
# Should print the mount line confirming successful registration
```

### Step E — Verify at runtime (positive control)

Boot the profile for at least 20 seconds to confirm it survives initialisation:

```bash
timeout 35 dsh --profile <name> < /dev/null > /tmp/ac-boot.log 2>&1
echo "EXIT: $?"         # 124 = timeout killed it = survived 35 s = alive
grep "browser-anti-cloudflare" /tmp/ac-boot.log
```

## Uninstall

Remove the insert row from your profile's `cordis.patch.yml` and reload:

```bash
dsh plugin --profile <name> reload
```

## Configuration Reference

| Key | Default | Description |
|-----|---------|-------------|
| `headless` | `true` | Run Chromium without a visible window |
| `operationTimeoutMs` | `45000` | Per-operation navigation timeout in ms |
| `executablePath` | *(auto)* | Optional absolute path to a custom Chromium binary |

Pass overrides via the `config:` section in `cordis.patch.yml`:

```yaml
- insert:
    - id: browser-anti-cloudflare
      name: '@mulqi/dsh-browser-anti-cloudflare'
      config:
        headless: false              # show the browser window
        operationTimeoutMs: 60000    # longer timeout for slow sites
        executablePath: /usr/bin/chromium-browser
```
