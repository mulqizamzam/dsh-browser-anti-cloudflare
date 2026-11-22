---
name: browser-automation-provider-maintainer
description: >
  Maintain an authorized Playwright browser automation provider with URL policy,
  isolated account contexts, encrypted session persistence, proxy configuration,
  passive WAF classification, and runtime diagnostics. Use when inspecting,
  testing, documenting, or extending this repository's browser provider.
version: 1.1.0
tags: [browser-automation, playwright, typescript, sessions, proxy, diagnostics, security]
---

# Browser Automation Provider Maintainer

Maintain a Playwright-based browser automation provider for authorized public-web workflows. The implementation must preserve URL/network safeguards, account isolation, encrypted session persistence, and passive-only WAF classification.

## Safety and behavior contract

- This project does not bypass Cloudflare, CAPTCHA, Turnstile, or other access controls.
- Do not forge challenge tokens, simulate challenge completion, or manipulate access-control flows.
- Use approved site verification or authorized APIs when a site requires additional verification.
- Only HTTP(S) destinations are accepted by default; private and internal destinations remain blocked unless an isolated local test explicitly enables them.
- Browser JavaScript evaluation remains disabled unless a trusted workflow explicitly opts in.
- Treat WAF classification as best-effort observation, not proof of access permission.

## Current architecture

```text
src/
├── index.ts          # provider registration and configuration validation
├── tools.ts          # browser/session tool registration
├── session.ts        # shared browser lifecycle and encrypted storage state
├── accounts.ts       # isolated browser/context per configured account
├── proxy.ts          # validated HTTP(S)/SOCKS5 proxy selection
├── security.ts       # URL, DNS, selector, and text validation
├── lifecycle.ts      # page-count enforcement
├── stealth.ts        # safe navigation routing and passive WAF observation
├── fingerprint.ts    # legacy profile metadata; no fingerprint injection
├── turnstile.ts      # passive widget detection only
├── debug-overlay.ts  # development-only diagnostic overlay utility
└── waf/
    └── detector.ts   # passive response signal classification
tests/                # unit, security, session, proxy, and browser integration tests
docs/                 # installation, usage, audit, and feature records
```

## Important implementation facts

- Browser contexts and pages are reused by `SessionManager`; stateful tool operations must not race.
- Account contexts are separate browser/context pairs.
- Session files use AES-256-GCM and are bound to the account ID in the encrypted payload.
- Session encryption accepts a legacy key or a versioned key ring with an active key ID.
- Account-specific proxy URLs are supported; validate them before creating browser contexts.
- Proxy credentials belong in separate secret-backed fields, never embedded in proxy URLs.
- Fingerprint profile generation is metadata only. `buildFingerprintScript()` intentionally returns an empty string.
- Turnstile detection is passive. No challenge token is generated or forged.
- The current tool surface is defined by `src/tools.ts`; consult that file rather than relying on old tool-count assumptions.

## Runtime diagnostics

- Use `observability.enabled` to enable/disable in-memory event collection.
- `observability.maxEvents` controls the bounded history (1–1000; default 100).
- `ac_browser_diagnostics` returns event counts, error counts, and recent events.
- Keep diagnostic attributes allowlisted and privacy-safe; never add URLs, selectors, form values, page content, session paths, account identifiers, or credentials.
- The event history is process-local and does not imply external telemetry delivery.

## Development workflow

1. Inspect the current source, tests, and docs before editing.
2. Keep changes narrow and preserve existing security defaults.
3. Add regression tests for lifecycle, concurrency, account isolation, proxy validation, and diagnostics changes.
4. Run:
   ```bash
   pnpm install --frozen-lockfile
   pnpm run typecheck
   pnpm run build
   pnpm run test
   pnpm run test:integration
   pnpm run test:security
   ```
5. Report only checks that were actually executed and their actual results.

## Change checklist

- [ ] Documentation matches current source behavior.
- [ ] No challenge bypass, token forgery, or identity spoofing is introduced.
- [ ] URL and DNS safeguards remain fail-closed.
- [ ] Stateful operations are concurrency-safe.
- [ ] Session files remain encrypted and account-bound.
- [ ] Proxy URLs and credentials are validated and handled safely.
- [ ] Diagnostic events exclude URLs, selectors, form values, page content, session paths, and secrets by default.
- [ ] Tests cover success, failure, and lifecycle cleanup paths.
