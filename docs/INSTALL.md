# Installation Guide

## Prerequisites
- DeepSeek Harness (DSH) profile with no competing browser-use provider.
- Node.js 22 or newer.
- Playwright Chromium installed.

## Install from GitHub
```bash
dsh plugin --profile <name> add "github:mulqizamzam/dsh-browser-anti-cloudflare#main"
```

For a local checkout, run pnpm install and pnpm run build, then install using the profile's supported file: or link: package source.

## Configure
Add the package to the profile's cordis.patch.yml:

```yaml
- insert:
    - id: browser-anti-cloudflare
      name: '@mulqi/dsh-browser-anti-cloudflare'
      config:
        headless: true
        operationTimeoutMs: 45000
        allowUnsafeEval: false
        allowPrivateNetworks: false
        session:
          enabled: true
          encryptionKey: ${BROWSER_SESSION_KEY}
          sessionDir: ~/.cache/browser-automation/sessions
```

Inject BROWSER_SESSION_KEY from a secret manager. Use at least 32 characters. Do not commit the key.

## Security behavior
- Public HTTP(S) navigation only by default.
- Loopback/private/link-local/reserved destinations are blocked.
- allowPrivateNetworks is for isolated local tests only; never enable it for untrusted inputs.
- Arbitrary page JavaScript is disabled unless allowUnsafeEval is explicitly enabled.
- Session files are encrypted using AES-256-GCM.
- Account-specific session save/restore is not supported yet.
- WAF detection is passive. The plugin does not bypass challenges or simulate Turnstile completion.

## Build and validate
```bash
pnpm install
pnpm run typecheck
pnpm run build
pnpm run test
pnpm run test:integration
```

## Provider slot
This package claims the exclusive browserUse provider slot. Disable other browser-use providers in the same profile before installation.
