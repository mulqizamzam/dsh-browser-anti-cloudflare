# Browser Automation Provider — Agent Quick Start

Purpose: maintain a Playwright browser-use provider for authorized public-web automation. The provider enforces URL/network policy, supports isolated account contexts, encrypted account-bound session snapshots, proxy configuration, and passive WAF observations.

This package does not bypass Cloudflare, CAPTCHA, Turnstile, or other access controls. Use the site's approved verification flow or an authorized API.

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
- `allowPrivateNetworks` is restricted to isolated local development/testing.
- Browser eval is disabled unless `allowUnsafeEval=true` is explicitly configured.
- Session persistence requires a 32+ character encryption key and AES-256-GCM.
- Saved session payloads include the account ID; restoring requires the matching account to be selected.
- Account contexts are isolated from one another.
- Proxy credentials must be supplied through secret-backed username/password fields, not embedded in proxy URLs.
- WAF detection is passive and must not be treated as an authorization decision.
- Fingerprint profile generation is metadata only; no browser identity spoofing is applied.

## Architecture notes
- `SessionManager` owns the shared browser runtime, page lifecycle, idle timeout, session encryption, and tool operations.
- `AccountManager` owns one browser/context pair per configured account.
- `ProxyManager` validates explicit HTTP(S)/SOCKS5 endpoints and can rotate a configured pool.
- `src/tools.ts` is the source of truth for the registered tool surface.
- Keep stateful browser operations serialized to prevent concurrent calls from mutating the same page/context.

## Install
```bash
dsh plugin --profile <name> add "github:mulqizamzam/dsh-browser-anti-cloudflare#main"
```

The package claims the exclusive browserUse slot. Disable competing browser-use providers before loading it.
