# Multi-Account Rotation Implementation Plan

**Intent:** Enable rotating browser sessions with distinct fingerprints per account, allowing agents to operate multiple accounts simultaneously without cross-contamination. Each account gets its own browser context with unique cookies, localStorage, and fingerprint profile.

**Current Behavior:** Single browser session per profile. All tool calls share the same context. No account isolation or rotation mechanism.

**Expected Outcome:** Configurable `accounts` array in session config, each with independent fingerprint, proxy, and cookie storage. Tool calls can target specific accounts via optional `accountId` parameter. Automatic rotation when rate limits detected.

**Target-Perspective Output:** Agent sets up 3 accounts with different fingerprints + proxies, then alternates between them seamlessly. Each account appears as a unique user to target sites.

**Truth Owner:** `src/accounts.ts` — AccountManager class handling isolation, rotation, and lifecycle.

**Contract Boundary:** `Config.accounts?: AccountConfig[]` where AccountConfig = `{ id: string; fingerprint?: 'auto'|'windows'|'mac'; proxy?: string; cookies?: string }`. Optional, backward compatible.

**Cutover:** Zero-config. Default single-account mode preserves existing behavior exactly.

**Displaced Path:** None. Pure addition alongside existing session system.

**Value Density:** High. Enables scale operations (multi-account scraping, automation) — directly addresses production use case.

**Evidence Gate:** Test 3 concurrent accounts with isolated state. Verify no cookie/fingerprint leakage between accounts.

**Acceptance Evidence:** Log showing 3 accounts with distinct fingerprints and isolated cookies across sequential operations.

**Evidence Lane:** `tests/multi-account.test.ts` — multi-account isolation tests.

**Kill Criteria:** If account isolation fails (cookie leak between accounts), feature is reverted. Data integrity is non-negotiable.

**Non-Goals:**
- Do NOT implement automatic account creation
- Do NOT add account marketplace integration
- Do NOT handle CAPTCHA solving per-account
- Do NOT persist accounts across DSH restarts (in-memory only)

**Risk if Wrong:** Cross-contamination between accounts could flag all accounts. Mitigated by strict isolation tests.
