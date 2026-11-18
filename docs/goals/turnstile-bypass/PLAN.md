# Cloudflare Turnstile Bypass Implementation Plan

**Intent:** Extend stealth patches to handle Cloudflare Turnstile CAPTCHA challenges — the modern replacement for reCAPTCHA used by Cloudflare. Current plugin handles "Checking your browser" JS challenges but not Turnstile's widget-based verification flow.

**Current Behavior:** Plugin passes Cloudflare's basic bot detection (navigator.webdriver, WebGL fingerprinting). However, when Cloudflare escalates to Turnstile (interactive widget requiring human interaction), the plugin has no handling — the page shows an uncloseable widget that blocks automation.

**Expected Outcome:** Auto-detection of Turnstile challenge pages and injection of simulated completion scripts. The plugin detects Turnstile's `cf-turnstile` DOM elements and responds with valid token simulation, allowing navigation to complete without human interaction.

**Target-Perspective Output:** When navigating to a URL protected by Cloudflare Turnstile, the page loads successfully (status 200) without showing the Turnstile widget, and the agent can interact with the page normally.

**Truth Owner:** `src/turnstile.ts` — new module handling Turnstile detection and response simulation.

**Contract Boundary:** No new tool names or config options. Feature is always-on when enabled (part of baseline stealth). Detection is passive — only activates when Turnstile DOM is detected.

**Cutover:** Backward compatible. Pure addition to the stealth script. Existing behavior unchanged for non-Turnstile sites.

**Displaced Path:** None. This extends existing stealth rather than replacing anything.

**Value Density:** High. Turnstile is increasingly common as Cloudflare's primary CAPTCHA solution. Directly addresses the gap between "basic bot detection" and "full CAPTCHA bypass."

**Evidence Gate:** Test against Cloudflare's Turnstile test page (`https://developers.cloudflare.com/turnstile/get-started/test-page/`) in both headless and headed modes. Verify widget is either bypassed or completed successfully.

**Acceptance Evidence:** Screenshot/log showing successful page load past Turnstile challenge. Headed mode visual proof of widget being handled.

**Evidence Lane:** `tests/turnstile-bypass.test.ts` — mock Turnstile challenge + real CF test page test (skipped if no network).

**Kill Criteria:** If Turnstile detection causes false positives on legitimate pages with `cf-turnstile` classes (rare but possible), the feature is disabled by default and requires explicit opt-in.

**Non-Goals:**
- Do NOT solve actual Turnstile cryptographic verification (impossible without Cloudflare secrets)
- Do NOT implement ML-based widget solving
- Do NOT add human-in-the-loop CAPTCHA solving
- Do NOT modify Cloudflare's actual challenge flow

**Risk if Wrong:** False positive on pages that legitimately use Turnstile-class widgets for other purposes. Mitigated by conservative detection heuristics.

---

## Architecture Slice

**Files to create:**
- `src/turnstile.ts` — Turnstile detector + response simulator
- `tests/turnstile-bypass.test.ts` — mock + live tests

**Files to modify:**
- `src/waf/baseline.ts` — integrate Turnstile handling into baseline script
- `README.md` — document Turnstile support and limitations

**Files to avoid:**
- `src/tools.ts` — no changes (transparent to tools)
- `src/index.ts` — no interface changes
- `src/session.ts` — no changes
- `src/waf/{akamai,imperva,fastly,detector}.ts` — no changes

**Source of truth:** `src/turnstile.ts`

**Read path:** Baseline script → detects cf-turnstile DOM → injects completion handler → page continues loading

**Write path:** N/A (pure injection, no state persistence)

**Contract boundary:** Internal implementation detail. No public API surface change.

**Integration points:**
- Playwright Page evaluate() for DOM manipulation
- Existing baseline stealth script in `src/waf/baseline.ts`
- Cloudflare Turnstile test page for validation

**Migration/cutover:** Pure addition. Always active as part of baseline. No config needed.

**Acceptance evidence gate:** Turnstile bypass test passes + all existing tests still pass.

---

## Task Breakdown

| # | Task | Files | Scope | Verification | Parallel? |
|---|------|-------|-------|--------------|-----------|
| 1 | Create `src/turnstile.ts` — detector + simulator | `src/turnstile.ts` | DOM detection, token simulation, completion handler | Unit tests pass | ✅ Yes |
| 2 | Integrate into baseline.ts | `src/waf/baseline.ts` | Add Turnstile handling to injection script | typecheck passes | ❌ After #1 |
| 3 | Write Turnstile bypass tests | `tests/turnstile-bypass.test.ts` | Mock challenge + optional live test | Tests pass | ✅ With #1 |
| 4 | Update README.md | `README.md` | Document Turnstile support & limitations | Docs render | ✅ Yes |
