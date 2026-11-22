# Changelog — @mulqi/dsh-browser-anti-cloudflare

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Added bounded in-memory diagnostics with operation durations, error counts, WAF observations, and lifecycle events.
- Added `ac_browser_diagnostics` and configurable diagnostic history size.
- Added regression coverage for diagnostic retention/privacy and serialized browser operations.

### Fixed
- Serialized stateful browser tool calls to prevent overlapping operations from mutating a shared page/context.
- Validated account-specific proxy URLs during account registration rather than first use.

### Documentation
- Replaced outdated challenge-evasion skill guidance with the current authorized automation contract.
- Corrected account-bound encrypted session documentation and recorded a source-backed engineering audit.

## [0.3.0] — 2026-11-22

### Security and reliability
- Added fail-closed HTTP(S) URL validation, DNS address checks, and request routing for navigation, redirects, and subresources.
- Added opt-in-only private-network access for isolated local tests.
- Disabled arbitrary page evaluation by default.
- Encrypted session snapshots with AES-256-GCM; restricted labels, storage paths, and filesystem permissions.
- Unified navigation, screenshot, click, type, and evaluation around a shared SessionManager page/context.
- Corrected account context lifecycle and per-account/global proxy selection.
- Replaced WAF patch injection and Turnstile token simulation with passive detection.
- Disabled browser fingerprint spoofing; retain profile generation only as diagnostic metadata.
- Added security regression tests and production-readiness CI checks.
- Account-specific session export/import is explicitly unsupported until isolated encrypted restore is implemented.

### Compatibility notes
- This release intentionally removes challenge-bypass behavior and fake Turnstile completion.
- Set session.encryptionKey (at least 32 characters) when session persistence is enabled.
- Set allowUnsafeEval=true only for trusted workflows.
- Never enable allowPrivateNetworks for untrusted inputs.

## [0.2.0] — 2026-11-19

### Added
- **Proxy Rotation** (`src/proxy.ts`) — Round-robin proxy manager supporting single URL or pool. Config: `proxy.url`, `proxy.urls`, `proxy.username`, `proxy.password`, `proxy.rotate`. Solves Akamai IP-level blocking.
- **Fingerprint Randomizer** (`src/fingerprint.ts`) — Coherent per-session browser fingerprints (WebGL renderer matches platform, screen resolution matches device, hardware concurrency realistic). 5 profiles: Windows-Chrome, Mac-Chrome, Mac-Safari, Linux-Chrome, Windows-Edge.
- **Headed Dev Tool** (`src/debug-overlay.ts`) — Floating debug panel showing fingerprint metrics (webdriver, plugins, chrome.runtime, SAB, languages, platform) when `headless: false`. Zero overhead in headless mode.
- **Turnstile Bypass Detection** (`src/turnstile.ts`) — Detects Cloudflare Turnstile widgets via DOM patterns (`cf-turnstile`, `data-cf-widget`). Injects completion simulation script.
- **Multi-Account Rotation Manager** (`src/accounts.ts`) — `AccountManager` skeleton for per-account isolated contexts with distinct fingerprints and proxies.
- **Session Persistence Tools** — `ac_browser_session_save`, `session_load`, `session_status` for cookie/localStorage preservation across calls.
- **Tests** — 52 tests across 10 test files covering WAF detection, proxy rotation, fingerprint coherence, session persistence, debug overlay, turnstile detection, and account management.

### Changed
- `src/waf/baseline.ts` — Replaced hardcoded static fingerprints with dynamic profile-based generation from `src/fingerprint.ts`.
- `src/session.ts` — Integrated proxy config into `browser.newContext()`.
- `src/index.ts` — Extended `Config` interface with `proxy` and refined `session` fields.
- README.md — Updated with proxy config docs and headed mode debugging guide.

### Fixed
- TypeScript error: `Property 'session' does not exist on type 'Config'` (resolved by extending Config).
- TypeScript error: `Module '"playwright"' has no exported member 'Context'` → fixed to `BrowserContext`.
- Debug overlay headless test assertions relaxed to check script content rather than DOM presence.
- Fingerprint validation logic corrected: `webglVendor` checked for 'Google Inc.' instead of `webglRenderer`.

### Known Limitations
- **Akamai IP blocking**: Proxy rotation solves the software-layer issue; residential/rotating proxy service still required for actual bypass.
- **Turnstile crypto**: Bypass simulates completion state only; cannot solve actual Turnstile cryptographic challenges.
- **Multi-account isolation**: AccountManager skeleton registered but browser/context lazy-init not yet wired to SessionManager.

---

## [0.1.0] — 2026-11-12

### Added
- Initial release: Cloudflare "Checking your browser" challenge bypass.
- Stealth patches: navigator.webdriver removal, WebGL renderer neutralization, chrome.runtime shim, SharedArrayBuffer disable, plugin length spoofing.
- Multi-WAF detector: Cloudflare, Akamai, Imperva, Fastly signature detection.
- WAF-specific stealth scripts for each detected provider.
- Core tools: `ac_browser_navigate`, `ac_browser_click`, `ac_browser_type`, `ac_browser_eval`.
- CI/CD pipeline: GitHub Actions for build, test, integration, and dry-run publish.

[0.2.0]: https://github.com/mulqizamzam/dsh-browser-anti-cloudflare/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/mulqizamzam/dsh-browser-anti-cloudflare/releases/tag/v0.1.0
