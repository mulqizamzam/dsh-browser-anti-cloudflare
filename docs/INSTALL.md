# Installation Guide

## Prerequisites
- DeepSeek Harness profile with no competing browser-use provider.
- Node.js 22 or newer and pnpm 9.15.5.
- Playwright Chromium installed.

## Install from GitHub
    dsh plugin --profile <name> add "github:mulqizamzam/dsh-browser-anti-cloudflare#main"

For a local checkout, run pnpm install --frozen-lockfile and pnpm run build, then install using the profile's supported file: or link: package source.

## Configure
Add the package to the profile's cordis.patch.yml:

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
              timeoutMs: 900000
              maxPages: 5
              encryptionKey: \${BROWSER_SESSION_KEY}
              sessionDir: ~/.cache/browser-automation/sessions

Inject BROWSER_SESSION_KEY from a secret manager. Use at least 32 characters. Do not commit the key.

## Security behavior
- Public HTTP(S) navigation only by default.
- Loopback/private/link-local/reserved destinations are blocked.
- DNS answers are pinned for the lifetime of the process; changed answers fail closed.
- For socket-level enforcement, deploy the browser in the restricted network namespace from docker-compose.egress.yml. It blocks private/reserved CIDRs, allows only TCP 80/443, uses a DNS cache with a 60-second minimum TTL, and filters AAAA records.
- allowPrivateNetworks is for isolated local tests only; never enable it for untrusted inputs.
- Arbitrary page JavaScript is disabled unless allowUnsafeEval is explicitly enabled.
- Session files are encrypted using AES-256-GCM. Account session payloads include their account ID and cannot be restored into a different account.
- session.timeoutMs expires idle browser contexts; session.maxPages applies an LRU page ceiling per context.
- WAF detection is passive. The plugin does not bypass challenges or simulate Turnstile completion.

## Build and validate
    pnpm install --frozen-lockfile
    pnpm run typecheck
    pnpm run build
    pnpm run test
    pnpm run test:integration

## Provider slot
This package claims the exclusive browserUse provider slot. Disable other browser-use providers in the same profile before loading it.
