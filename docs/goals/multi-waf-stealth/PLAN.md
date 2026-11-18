# Multi-WAF Stealth Support Implementation Plan

**Intent:** Extend `@mulqi/dsh-browser-anti-cloudflare` beyond Cloudflare-only detection to cover Akamai, Imperva, and Fastly WAF challenges — so the same plugin instance passes all four major bot-protection providers without requiring separate configurations.

**Current Behavior:** The plugin currently applies a single hardcoded `STEALTH_SCRIPT` targeting Cloudflare-specific signals (`navigator.webdriver`, WebGL UNMASKED_RENDERER). It launches Chromium with `--disable-blink-features=AutomationControlled` and a Chrome 131 UA string. Known gap: Akamai detects via `kcookies`/K2 cookies, Imperva checks `HIG/HCAP` JS environment, Fastly inspects `X-Custom-IP-Authorization` and timing heuristics. None of these are patched.

**Expected Outcome:** A modular stealth injection system where each WAF type has its own patch module. At runtime, the plugin auto-detects which WAF is present (via response headers/body signatures) and applies the appropriate patches plus baseline anti-detect scripts. The provider remains a single `browserUse` slot; no config changes needed from the user.

**Target-Perspective Output:** When an agent calls `ac_browser_navigate` on any URL behind Cloudflare, Akamai, Imperva, or Fastly, the page loads normally (no challenge page, no captcha, no "Checking your browser" spinner). The returned `{ url, title, status }` reflects a successful human-like session.

**Truth Owner:** `src/stealth.ts` — this is the single source of truth for all WAF-specific and baseline injection logic. Changes must be made here; `tools.ts` and `index.ts` consume through `navigateWithStealth`.

**Contract Boundary:** `navigateWithStealth(page, url, timeoutMs)` → `Promise<Response | null>`. Signature unchanged. Internally it now routes through a WAF dispatcher that selects patches before calling `page.addInitScript()` + `page.goto()`.

**Cutover:** Immediate. No configuration migration needed. Old `cordis.patch.yml` rows remain valid. The new code path is opt-in by default — every navigation goes through the WAF detector. No rollback switch required because the old Cloudflare-only behavior is a strict subset of the new behavior.

**Displaced Path:** The monolithic `STEALTH_SCRIPT` constant in `src/stealth.ts` is replaced by `WAF_PATCHES` registry + `detectWAF(resp)` + `buildCombinedScript(baseline, wafSpecific)`. The old constant is deleted, not kept as fallback.

**Value Density:** High. One plugin covers four WAFs instead of one. Users don't need to choose or configure per-target. Directly solves the most common real-world failure mode (Cloudflare works, Akamai still blocks).

**Evidence Gate:** Three integration tests must pass — one per WAF — using mock servers that simulate each provider's challenge response. Each test verifies: (a) challenge page is NOT rendered, (b) `navigator.webdriver === undefined`, (c) required WAF-specific props are present.

**Acceptance Evidence:** Snapshot logs from each mock-server test showing 200 OK with human-like fingerprints, plus a manual smoke test against a live Akamai-protected endpoint (recorded as video or base64 screenshot in EVIDENCE.md).

**Evidence Lane:** `tests/integration.test.ts` — new test cases added under a `waf-akamai`, `waf-imperva`, `waf-fastly` describe block. CI runs them on every push.

**Kill Criteria:** If any WAF module fails to prevent its respective challenge within 30s timeout, or if baseline stealth regressions cause Cloudflare tests to fail, the feature is reverted to pre-change state and the PR is closed. No partial deployment.

**Non-Goals:**
- Do NOT implement actual CAPTCHA solving (Turnstile, hCaptcha, reCAPTCHA) — out of scope.
- Do NOT add support for Cloudflare Turnstile specifically — handled separately in future v2.
- Do NOT modify `tools.ts` or `index.ts` interfaces — only `stealth.ts` changes.
- Do NOT add network-dependent probes — all WAF detection is header/body-based on the initial response.

**Risk if Wrong:** Users hit false positives (challenge pages on benign sites) or false negatives (undetected blocking). Worst case: silent failure where the agent thinks navigation succeeded but got a challenge page stripped of content. Mitigated by comprehensive mock-server tests + explicit error logging when WAF is detected but patching fails.

---

## Architecture Slice

**Files to create:**
- `src/waf/akamai.ts` — Akamai K2 cookie + knsec header patches
- `src/waf/imperva.ts` — Imperva HIG/HCAP JS environment patches
- `src/waf/fastly.ts` — Fastly timing + header anomaly patches
- `src/waf/detector.ts` — auto-detection logic based on response signatures
- `src/waf/baseline.ts` — shared baseline stealth (extracted from old STEALTH_SCRIPT)
- `tests/waf-akamai.test.ts` — mock Akamai challenge test
- `tests/waf-imperva.test.ts` — mock Imperva challenge test
- `tests/waf-fastly.test.ts` — mock Fastly challenge test

**Files to modify:**
- `src/stealth.ts` — replace monolithic `STEALTH_SCRIPT` with dispatcher calling detector + WAF modules; keep `launchStealthBrowser` and `navigateWithStealth` signatures intact
- `package.json` — no changes needed
- `README.md` — update Compatibility section to list Akamai/Imperva/Fastly support

**Files to avoid:**
- `src/tools.ts` — do not touch; contract boundary
- `src/index.ts` — do not touch; contract boundary
- `.github/workflows/*` — already committed; no changes needed

**Source of truth:** `src/stealth.ts` (dispatcher) + `src/waf/*.ts` (patch modules)

**Read path:** Agent calls `ac_browser_navigate` → `tools.ts` → `navigateWithStealth()` → detector → apply patches → `page.addInitScript(combo)` → `page.goto()`

**Write path:** N/A (pure read/inject; no state written to disk)

**Contract boundary:** `navigateWithStealth(page, url, timeoutMs): Promise<Response | null>` — unchanged signature

**Integration points:**
- `playwright` Page object (existing dependency)
- Node.js `http` server (for mock tests, already used in existing tests)

**Migration/cutover:** Zero-config. Deploy the updated package; existing profiles work immediately. No `cordis.patch.yml` changes required.

**Displaced path:** Monolithic `const STEALTH_SCRIPT = ...` in `src/stealth.ts` line 13 — fully removed and replaced by dynamic composition.

**Acceptance evidence gate:** All 3 WAF integration tests + 3 existing stealth tests must pass. `pnpm run test` exits 0.

---

## Task Breakdown

| # | Task | Files | Scope | Verification | Parallel? |
|---|------|-------|-------|--------------|-----------|
| 1 | Extract baseline stealth into `src/waf/baseline.ts` | `src/stealth.ts`, `src/waf/baseline.ts` | Move old STEALTH_SCRIPT body to new file, export as function | `pnpm run test` still passes | ✅ Yes |
| 2 | Create Akamai WAF module | `src/waf/akamai.ts` | Patch K2 cookies, knsec headers, navigator.plugins spoof | New test passes | ✅ Yes (with #3, #4) |
| 3 | Create Imperva WAF module | `src/waf/imperva.ts` | Patch HIG/HCAP detection, jsddos check, WebGL double-render | New test passes | ✅ Yes (with #2, #4) |
| 4 | Create Fastly WAF module | `src/waf/fastly.ts` | Patch timing side-channels, X-Cache header anomalies | New test passes | ✅ Yes (with #2, #3) |
| 5 | Create WAF detector | `src/waf/detector.ts` | Match Set-Cookie patterns, response headers, HTML body signatures | Returns correct WAF id or `'unknown'` | ❌ After #1 |
| 6 | Refactor `navigateWithStealth` in `src/stealth.ts` | `src/stealth.ts` | Call detector → compose baseline + WAF script → inject | All existing + new tests pass | ❌ After #1–#5 |
| 7 | Write WAF integration tests | `tests/waf-*.test.ts` | Mock servers simulating each WAF challenge | `pnpm run test:integration` passes | ✅ Yes |
| 8 | Update README.md | `README.md` | Add Akamai/Imperva/Fastly to Compatibility table | Docs render correctly | ✅ Yes |

---

## Plan Review Gate

This plan requires PRE review before execution. Blockers to resolve:
- [ ] Confirm mock-server approach is sufficient (no live WAF endpoints needed for CI)
- [ ] Verify Imperva HIG detection signature is stable across versions
- [ ] Confirm Akamai K2 cookie name is consistent (may vary by config)
