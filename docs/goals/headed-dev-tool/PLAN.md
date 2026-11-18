# Headed Dev Tool Implementation Plan

**Intent:** Add a headed (visible window) mode for developing and debugging anti-detect scripts, with an overlay panel showing real-time fingerprint metrics (webdriver, plugins, WebGL renderer, etc.) so developers can visually confirm stealth patches are working before deploying headless.

**Current Behavior:** All browsing is headless by default (`headless: true`). Debugging requires adding `console.log` statements, checking return values, or running separate test scripts. No visual feedback during development.

**Expected Outcome:** When `headless: false` is set in config, Chromium opens with a visible window PLUS a floating debug overlay panel showing live fingerprint data. The overlay updates on every navigation and can be toggled closed. In headless mode, the overlay is absent (zero overhead).

**Target-Perspective Output:** A developer sets `headless: false` in `cordis.patch.yml`, runs the plugin, and sees a Chromium window with a small floating panel in the corner showing:
```
┌─────────────────────────────┐
│ 🔍 Stealth Debug            │
│ webdriver: undefined ✓      │
│ plugins: 3 ✓                │
│ WebGL: Google Inc. (Intel)✓ │
│ chrome.runtime: ✓           │
│ SA Buffer: undefined ✓      │
└─────────────────────────────┘
```
Each metric has a green checkmark when passing, red X when failing.

**Truth Owner:** `src/debug-overlay.ts` — new module responsible for injecting the debug panel into pages when headed mode is active.

**Contract Boundary:** No new tool names. The overlay is injected automatically when `headless: false`. No API surface change for agents — purely a dev-time feature.

**Cutover:** Zero-config activation. Setting `headless: false` in profile config automatically enables the overlay. No migration needed. Feature is completely opt-in.

**Displaced Path:** None. This is a pure addition — no existing behavior is removed or changed.

**Value Density:** Medium-High. Dramatically reduces debug time for stealth script development. Makes it obvious at a glance whether patches are applied correctly.

**Evidence Gate:** Screenshot proof showing the overlay panel rendering correctly in a headed browser with accurate fingerprint values.

**Acceptance Evidence:** Side-by-side screenshots: (a) headed mode with overlay showing all green checks, (b) headless mode with no overlay. Plus automated test verifying overlay HTML structure.

**Evidence Lane:** `tests/debug-overlay.test.ts` — headless test that captures the overlay HTML content; manual screenshot in headed mode for visual proof.

**Kill Criteria:** If the overlay causes any navigation failure, increases load time by >500ms, or leaks memory across page navigations, the feature is disabled by default and requires explicit opt-in.

**Non-Goals:**
- Do NOT add network inspector or request monitoring
- Do NOT add element highlighting or click tracing
- Do NOT make the overlay interactive (read-only display)
- Do NOT persist overlay state across browser restarts
- Do NOT add overlay in production/headless mode (zero overhead guarantee)

**Risk if Wrong:** Overlay injection could interfere with WAF detection if it modifies DOM unexpectedly. Mitigated by injecting after page load completes and using a shadow DOM container.

---

## Architecture Slice

**Files to create:**
- `src/debug-overlay.ts` — overlay injection logic, fingerprint reading, HTML template
- `tests/debug-overlay.test.ts` — headless test verifying overlay content

**Files to modify:**
- `src/stealth.ts` — import and conditionally inject overlay when headed mode is active
- `README.md` — document headed mode usage for development

**Files to avoid:**
- `src/tools.ts` — no changes needed (overlay is transparent to tools)
- `src/index.ts` — no interface changes
- `src/waf/*.ts` — no changes

**Source of truth:** `src/debug-overlay.ts`

**Read path:** Developer sets `headless: false` → `launchStealthBrowser()` passes `headless: false` → `navigateWithStealth()` detects headed mode → injects overlay script via `addInitScript()` → overlay renders in page

**Write path:** N/A (pure injection, no state written)

**Contract boundary:** None exposed to agents. Internal implementation detail only.

**Integration points:**
- `playwright` Page.addInitScript()
- Existing `launchStealthBrowser()` in `stealth.ts`
- Shadow DOM API for isolated overlay rendering

**Migration/cutover:** Pure addition. No breaking changes.

**Displaced path:** N/A

**Acceptance evidence gate:** Debug overlay test passes + screenshot proof in headed mode. All 19 existing tests still pass.

---

## Task Breakdown

| # | Task | Files | Scope | Verification | Parallel? |
|---|------|-------|-------|--------------|-----------|
| 1 | Create `src/debug-overlay.ts` — overlay HTML + fingerprint reader | `src/debug-overlay.ts` | Shadow DOM overlay, metric readers, CSS styling | Import compiles | ✅ Yes |
| 2 | Wire overlay injection into `src/stealth.ts` | `src/stealth.ts` | Conditionally addInitScript when headed mode | typecheck passes | ❌ After #1 |
| 3 | Write debug overlay tests | `tests/debug-overlay.test.ts` | Verify overlay HTML structure + metric accuracy | Tests pass | ✅ With #1 |
| 4 | Update README.md | `README.md` | Document headed mode for development | Docs render | ✅ Yes |
