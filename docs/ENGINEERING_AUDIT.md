# Engineering Audit — Browser Automation Provider

**Audit date:** 2026-11-22  
**Audited ref:** `main` at `85ef9ab573a99d6458dbbfac3484d73e46a898b8`  
**Package version:** `0.3.0`  
**Scope:** source, package metadata, documentation, tests, and CI configuration.  
**Method:** static repository inspection. No build or test command was executed during this audit.

## Executive summary

The repository is materially more developed than the earlier quick review suggested. It contains Vitest tests, browser integration tests, security regression tests, and GitHub Actions CI. The current implementation is an authorized Playwright automation provider with passive WAF classification, account-isolated browser contexts, encrypted session persistence, proxy configuration, and URL/network safeguards. It does not implement Cloudflare, CAPTCHA, or Turnstile challenge bypass.

## Confirmed strengths

- `src/security.ts` validates HTTP(S) URLs, blocks local/internal names, resolves public DNS answers, and rejects DNS answer drift.
- `src/stealth.ts` applies request routing to navigation, redirects, and subresource requests, then records passive WAF classification.
- `src/session.ts` centralizes browser/context/page lifecycle, enforces page limits, supports idle expiry, and encrypts persisted storage state with AES-256-GCM.
- Session files carry an account identifier; restore rejects a session when the selected account does not match.
- `src/accounts.ts` creates separate browser/context pairs per account and supports account-specific proxy URLs.
- `src/proxy.ts` validates explicit HTTP(S)/SOCKS5 proxy endpoints and supports round-robin selection.
- Tests exist under `tests/`, including integration, security, session lifecycle, key rotation, proxy, and WAF coverage.
- `.github/workflows/ci.yml` runs typecheck, build, tests, Chromium integration, and deployment-policy checks.

## Findings

### P1 — Documentation describes removed challenge-evasion behavior

`SKILL.md` still describes stealth-patched Chromium, anti-detection injection, Turnstile/challenge bypass, five tools, and a fresh browser per tool call. The current source instead leaves `STEALTH_SCRIPT`, fingerprint injection, and Turnstile bypass scripts empty; browser state is managed by `SessionManager`; and the tool surface includes browser operations plus session operations.

**Impact:** users and coding agents can implement against behavior that no longer exists.

**Action:** replace the stale skill instructions with the actual authorized automation contract and list current source boundaries.

### P1 — Agent guidance contradicts account-session implementation

`AGENTS.md` says per-account encrypted session import/export is not implemented. Current `src/session.ts` writes the active account ID into encrypted session payloads and restores through `AccountManager.restoreAccountStorageState()`, with account-match checks.

**Impact:** incorrect maintenance decisions and duplicated work.

**Action:** correct the guidance and document the account-binding invariant.

### P1 — Shared page/context operations are not serialized

`SessionManager` intentionally reuses one context/page across tool calls. The tool dispatcher can receive overlapping calls, while navigation reconfigures context-wide routing and mutates the shared page. There is no operation mutex in the inspected dispatcher/session manager.

**Impact:** concurrent calls can interfere with page state, routing, screenshots, or form actions.

**Action:** serialize stateful tool operations through a manager-owned exclusive queue and cover queue behavior with tests.

### P2 — Account proxy configuration is validated lazily

Global proxy configuration is validated when its manager is constructed. An account-specific `proxyUrl` is only parsed when that account context is first created.

**Impact:** invalid account proxy configuration can allow plugin startup and fail later during a user operation.

**Action:** validate account proxy endpoints at account registration time.

### P2 — Fingerprint configuration is retained but not applied

Account configuration still accepts a `fingerprint` property, and `src/fingerprint.ts` retains profile metadata. However, `buildFingerprintScript()` deliberately returns an empty string and `AccountManager.getAccountProfile()` returns `null`.

**Impact:** configuration may imply browser identity changes that do not occur.

**Action:** document fingerprint fields as non-operative diagnostic metadata or remove them in a separately versioned compatibility change. Do not reintroduce identity spoofing as part of reliability work.

### P2 — WAF classification is best-effort and coarse

`detectWAF()` uses response headers and a bounded body sample. It does not use the status field, and some signatures (for example generic cache headers) may be shared by multiple delivery stacks.

**Impact:** a provider label can be a false positive and must not be interpreted as proof of a challenge or permission state.

**Action:** expose the result as an observation, retain an `unknown` state, and avoid access-control decisions based solely on classification.

### P3 — Legacy debug overlay has persistent page-side observers

`src/debug-overlay.ts` creates a MutationObserver for each metric and a recurring interval. The inspected code does not register cleanup when the panel is removed.

**Impact:** repeated injection/removal in a long-lived page may leave unnecessary page-side work.

**Action:** if the overlay is used in a future diagnostic workflow, add a single observer and explicit cleanup; do not inject it into production pages by default.

## Test and CI inventory

The repository contains test files for advanced features, debug overlay, fingerprint metadata, browser integration, live integration, live WAF, multi-account behavior, proxy configuration/rotation, URL security, session key rotation, session lifecycle, session persistence/security, smoke behavior, stealth navigation, WAF integration, and the release-audit generator.

The CI workflow runs Python release-audit tests, TypeScript typecheck, build, Chromium installation, the Vitest suite, security-default checks, deployment egress shell syntax checks, and a separate browser-integration job.

**Important:** existence of tests and CI is confirmed by repository files; their current passing status was not established by this static audit.

## Recommended implementation sequence

1. Preserve this audit as the baseline and correct stale documentation.
2. Align README, agent guidance, and skill instructions with the current source.
3. Serialize stateful browser operations and add concurrency regression coverage.
4. Validate account-specific proxy settings at registration and strengthen account/proxy regression coverage.
5. Add privacy-safe structured diagnostics, bounded event history, and a diagnostics tool.
6. Run typecheck, build, unit/security tests, and browser integration in CI; record exact outcomes.
