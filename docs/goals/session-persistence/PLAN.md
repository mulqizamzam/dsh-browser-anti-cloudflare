# Session Persistence Implementation Plan

**Intent:** Enable cookie/session persistence across multiple `ac_browser_*` tool calls by maintaining a long-lived browser instance instead of spawning/closing per operation. This allows multi-step workflows (navigate → login → click → eval) without re-authenticating on each call.

**Current Behavior:** Each `ac_browser_*` call in `src/tools.ts` launches a fresh Chromium via `launchStealthBrowser()`, performs one operation, then closes the browser in `finally`. State (cookies, localStorage, pages) is completely lost between calls. Multi-step flows require the agent to repeat navigation + auth on every tool call.

**Expected Outcome:** A `SessionManager` class that maintains a persistent browser+page pool. Subsequent calls to `ac_browser_navigate`/`click`/`type`/`eval` reuse the same browser context, preserving cookies and localStorage. New tools `ac_browser_session_save` and `ac_browser_session_load` allow explicit checkpoint/resume. Headless mode remains default; session lifetime is configurable.

**Target-Perspective Output:** An agent can perform a multi-step workflow:
1. `ac_browser_navigate(url="https://site.com/login")` → fills form
2. `ac_browser_click(selector="#submit")` → submits
3. `ac_browser_eval(expression="document.title")` → verifies logged-in state
4. All three calls share the same browser session (cookies preserved)
5. No challenge page appears on step 2-3 because the session is warm

**Truth Owner:** `src/session.ts` — new module hosting `SessionManager`. `src/tools.ts` consumes it. `src/index.ts` wires config into the manager.

**Contract Boundary:** `SessionManager` exposes:
- `navigate(url, timeoutMs)` → `{ url, title, status }`
- `getActivePage()` → Playwright Page (for internal use)
- `saveSession(label)` → `{ path, size }`
- `loadSession(path)` → `boolean`
- `close()` → cleanup
Tools call `navigate()` internally; the rest are optional advanced APIs.

**Cutover:** Backward compatible. Default behavior unchanged — if no session config is provided, each call still gets a fresh browser. Setting `session: { enabled: true, timeoutMs: 120000 }` in `cordis.patch.yml` activates persistence. Old profiles work identically.

**Displaced Path:** The `runOp()` function's `launchStealthBrowser()` + `browser.close()` per-call pattern in `src/tools.ts` lines 105-143 is replaced by a shared `SessionManager` instance. The old per-call pattern is deleted, not kept as fallback.

**Value Density:** High. Eliminates repeated auth flows, reduces latency (no browser spin-up per call), enables complex multi-page workflows. Directly solves the #1 user complaint from live tests.

**Evidence Gate:** Three scenarios must pass:
1. Single call: same as before (fresh browser, works)
2. Multi-call with session: navigate → click → eval all share cookies
3. Session save/load: persist cookies to disk, reload in new browser instance

**Acceptance Evidence:** Test output showing cookie value preserved across 3 sequential tool calls on the same domain, plus a saved session file that restores state in a fresh browser.

**Evidence Lane:** `tests/session-persistence.test.ts` — new test file with mock server simulating login flow. CI runs on every push.

**Kill Criteria:** If session reuse causes cross-contamination between different URLs/domains, or if the session manager fails to clean up on profile teardown, the feature is reverted. No partial deployment.

**Non-Goals:**
- Do NOT implement cross-profile session sharing (sessions are profile-scoped)
- Do NOT add automatic session expiration based on idle time (configurable only)
- Do NOT modify `src/index.ts` interface beyond adding `session` config option
- Do NOT persist sessions to remote storage (local disk only)

**Risk if Wrong:** Stale cookies cause authentication failures on subsequent requests. Memory leak from unclosed pages. Mitigated by explicit close() on teardown + domain-isolated page pools.

---

## Architecture Slice

**Files to create:**
- `src/session.ts` — SessionManager class with browser pool, cookie store, page lifecycle
- `tests/session-persistence.test.ts` — multi-call state preservation tests

**Files to modify:**
- `src/tools.ts` — replace per-call browser lifecycle with SessionManager; add session tool definitions
- `src/index.ts` — add `session` to Config interface; wire SessionManager into apply()
- `README.md` — document session config options

**Files to avoid:**
- `src/stealth.ts` — unchanged; stealth patches apply to each new page automatically
- `src/waf/*.ts` — unchanged
- `.github/workflows/*` — no changes needed

**Source of truth:** `src/session.ts` (SessionManager) + `src/tools.ts` (tool definitions using it)

**Read path:** Agent calls `ac_browser_navigate` → `tools.ts` → `SessionManager.navigate()` → reuse or spawn browser → `navigateWithStealth()` → return result

**Write path:** `SessionManager.saveSession()` writes cookies+storage to JSON file on disk

**Contract boundary:** `Config.session?: { enabled: boolean; timeoutMs?: number; maxPages?: number }` — new optional field

**Integration points:**
- `playwright` Browser + Context + Page objects
- Node.js `fs` for session serialization
- Existing `launchStealthBrowser()` and `navigateWithStealth()` from `stealth.ts`

**Migration/cutover:** Zero-config. Adding `"session": { "enabled": true }` to `cordis.patch.yml` activates. Default (`enabled: false`) preserves existing behavior exactly.

**Displaced path:** Per-call `launchStealthBrowser()` + `browser.close()` in `tools.ts:105-143` — fully removed when session is enabled.

**Acceptance evidence gate:** Session persistence test + all 19 existing tests must pass. `pnpm run test` exits 0.

---

## Task Breakdown

| # | Task | Files | Scope | Verification | Parallel? |
|---|------|-------|-------|--------------|-----------|
| 1 | Create `src/session.ts` — SessionManager class | `src/session.ts` | Browser pool, page management, cookie save/load | Unit tests pass | ✅ Yes |
| 2 | Integrate SessionManager into `src/tools.ts` | `src/tools.ts` | Replace per-call lifecycle, add session-aware tool routing | Existing tests pass | ❌ After #1 |
| 3 | Extend Config in `src/index.ts` | `src/index.ts` | Add `session` field, wire SessionManager into apply() | typecheck passes | ❌ After #1 |
| 4 | Add session tools (save/load/status) | `src/tools.ts` | New `ac_browser_session_save`, `ac_browser_session_load`, `ac_browser_session_status` | New tests pass | ✅ With #2 |
| 5 | Write session persistence tests | `tests/session-persistence.test.ts` | Mock login flow, verify cookie preservation across calls | `pnpm run test` all pass | ✅ With #4 |
| 6 | Update README.md | `README.md` | Document session config, usage examples | Docs render | ✅ Yes |
