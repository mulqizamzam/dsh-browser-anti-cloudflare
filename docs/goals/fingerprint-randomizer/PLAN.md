# Fingerprint Randomizer Implementation Plan

**Intent:** Improve anti-detection quality by generating realistic, consistent fingerprints based on device/locale profile instead of static/hardcoded values. Each session gets a unique but coherent fingerprint (WebGL renderer, hardware concurrency, screen resolution, platform) that matches a realistic user profile.

**Current Behavior:** Fingerprints are partially randomized but inconsistent — WebGL always returns `'Google Inc. (Intel)'`, hardwareConcurrency is random 4-7 but not tied to a coherent profile. Screen resolution is hardcoded to 1920x1080. This creates statistical anomalies detectable by sophisticated WAFs.

**Expected Outcome:** A `FingerprintProfile` system where each session selects a profile (e.g., "Windows-Chrome-8core", "Mac-Safari-4core") and all fingerprint properties are internally consistent. WebGL renderer matches the platform, screen resolution matches typical devices, etc.

**Target-Perspective Output:** Developer sees different but coherent fingerprints across sessions. A "Windows user" has Intel GPU, 1920x1080 screen, Win64 platform. A "Mac user" has Apple GPU, 2880x1800 screen, MacIntel platform. No cross-contamination between profiles.

**Truth Owner:** `src/fingerprint.ts` — new module hosting `FingerprintProfile` type and `generateProfile()` function. Consumed by `src/waf/baseline.ts`.

**Contract Boundary:** `Config.fingerprint?: { profile?: 'auto' | 'windows' | 'mac' | 'linux'; seed?: number }`. New optional field. Default `auto` = random coherent profile per session.

**Cutover:** Backward compatible. Default `auto` generates random profiles. Existing behavior (static fingerprints) preserved if no config change.

**Displaced Path:** The static/hardcoded fingerprint values in `src/waf/baseline.ts` (lines 33, 57-58, platform line ~29) are replaced by dynamic profile-based generation. Old hardcoded values are deleted, not kept as fallback.

**Value Density:** Medium-High. Improves detection evasion quality significantly. Relatively small code change.

**Evidence Gate:** Generate 100 profiles, verify internal consistency (WebGL vendor matches platform, screen ratio is realistic, etc.). Statistical distribution analysis.

**Acceptance Evidence:** JSON output showing 5 sample profiles with all fields coherent. Consistency check passing 100% rate.

**Evidence Lane:** `tests/fingerprint-randomizer.test.ts` — profile generation + consistency validation tests.

**Kill Criteria:** If fingerprint inconsistency causes WAF bypass degradation (measured by mock WAF tests failing), the feature is rolled back.

**Non-Goals:**
- Do NOT add network-based fingerprinting (keep it local/deterministic)
- Do NOT make fingerprints change mid-session (consistent per-session)
- Do NOT add AI-generated fingerprints (rule-based only)
- Do NOT expose fingerprint API to agents (internal only)

**Risk if Wrong:** Inconsistent fingerprints could make detection EASIER if GPU/platform mismatch is obvious. Mitigated by strict consistency validation in tests.

---

## Architecture Slice

**Files to create:**
- `src/fingerprint.ts` — FingerprintProfile type + generateProfile() + validateConsistency()
- `tests/fingerprint-randomizer.test.ts` — profile generation and consistency tests

**Files to modify:**
- `src/waf/baseline.ts` — replace hardcoded values with profile-based generation
- `src/index.ts` — add `fingerprint` to Config interface
- `README.md` — document fingerprint config

**Files to avoid:**
- `src/stealth.ts` — unchanged (fingerprint is in baseline script)
- `src/tools.ts` — unchanged
- `src/waf/{akamai,imperva,fastly,detector}.ts` — unchanged

**Source of truth:** `src/fingerprint.ts`

**Read path:** Config → SessionManager → baseline.ts reads profile → injects consistent scripts

**Write path:** N/A (pure generation, no state)

**Contract boundary:** `Config.fingerprint?: { profile?: 'auto' | 'windows' | 'mac' | 'linux'; seed?: number }`

**Integration points:**
- `src/waf/baseline.ts` — consumes fingerprint profile
- Playwright viewport (already configurable via session)

**Migration/cutover:** Pure addition. Default auto-mode generates random profiles. No breaking changes.

**Acceptance evidence gate:** All fingerprint consistency checks pass + all existing tests still pass.

---

## Task Breakdown

| # | Task | Files | Scope | Verification | Parallel? |
|---|------|-------|-------|--------------|-----------|
| 1 | Create `src/fingerprint.ts` — profile generation + validation | `src/fingerprint.ts` | Profile types, generators, consistency checker | Unit tests pass | ✅ Yes |
| 2 | Replace hardcoded fingerprints in baseline.ts | `src/waf/baseline.ts`, `src/index.ts` | Use profile-based values | typecheck passes | ❌ After #1 |
| 3 | Write fingerprint tests | `tests/fingerprint-randomizer.test.ts` | Generation + consistency + distribution | Tests pass | ✅ With #1 |
| 4 | Update README.md | `README.md` | Document fingerprint config | Docs render | ✅ Yes |
