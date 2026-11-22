# Browser Automation Provider — Agent Quick Start

Purpose: register a Playwright browser-use provider for authorized public-web automation. The provider enforces URL/network policy, supports isolated account contexts, provides encrypted session snapshots, and reports passive WAF signals.

This package does not bypass Cloudflare, CAPTCHA, Turnstile, or other access controls. Use the site's approved verification flow or authorized API.

## Build
```bash
pnpm run build
pnpm run typecheck
```

## Tests
```bash
pnpm run test
pnpm run test:integration
pnpm run test:security
```

## Security defaults
- Only HTTP(S) URLs are accepted.
- Private, loopback, link-local, reserved, and internal destinations are blocked by default.
- allowPrivateNetworks is restricted to isolated local development/testing.
- Browser eval is disabled unless allowUnsafeEval=true is explicitly configured.
- Session persistence requires a 32+ character encryption key and AES-256-GCM.
- Per-account encrypted session import/export is not currently implemented.

## Install
```bash
dsh plugin --profile <name> add "github:mulqizamzam/dsh-browser-anti-cloudflare#main"
```

The package claims the exclusive browserUse slot. Disable competing browser-use providers before loading it.
