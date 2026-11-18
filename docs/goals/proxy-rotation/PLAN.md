# Proxy Rotation Integration Implementation Plan

**Intent:** Solusi untuk Akamai IP-level blocking dengan menambahkan proxy rotation support. Plugin akan mendukung konfigurasi proxy per-session sehingga IP datacenter yang ter-flag dapat digantikan dengan residential/rotating proxy tanpa mengubah cara kerja stealth patches.

**Current Behavior:** Plugin menggunakan Chromium langsung ke target URL. Jika IP server ter-flag oleh WAF (seperti Akamai di live test), navigasi gagal 403/Access Denied terlepas dari kualitas stealth patches. Tidak ada mekanisme proxy atau IP rotation.

**Expected Outcome:** Config baru `proxy` di `cordis.patch.yml` yang memungkinkan pengguna specify HTTP/SOCKS5 proxy. Optional rotating proxy pool支持与 multiple proxies bergantian per session. Setiap session bisa pakai proxy berbeda, mengurangi risiko IP flagging.

**Target-Perspective Output:** Developer set `proxy: { url: 'http://proxy.example.com:8080' }` di config, lalu semua navigasi browser melewati proxy tersebut. Hasil: halaman target termuat normal bahkan jika IP asli ter-block oleh WAF.

**Truth Owner:** `src/proxy.ts` — new module handling proxy configuration and rotation logic. `src/session.ts` consumes it via Playwright's `proxy` option in `browser.newContext()`.

**Contract Boundary:** `Config.proxy?: { url: string; username?: string; password?: string } | Array<{ url: string; ... }>`. New optional field, backward compatible. Default undefined = no proxy (existing behavior).

**Cutover:** Zero-config. Adding `proxy` to config activates. No migration needed. Old profiles work identically.

**Displaced Path:** None. Pure addition — existing direct connection path remains as default.

**Value Density:** High. Solves the #1 known limitation (Akamai IP blocking) identified in live tests. Enables production use against strict WAFs.

**Evidence Gate:** Test with mock HTTP proxy server that echoes requests. Verify navigation succeeds through proxy vs direct. Verify multiple proxy rotation works.

**Acceptance Evidence:** Screenshot/log showing successful navigation through proxy to a blocked endpoint, compared to failure without proxy.

**Evidence Lane:** `tests/proxy-rotation.test.ts` — mock proxy server + actual navigation test. CI runs on every push.

**Kill Criteria:** If proxy injection causes Playwright to fail launching or crashes on invalid proxy config, the feature is gated behind explicit validation. Invalid config must throw descriptive error at boot, not silently fail.

**Non-Goals:**
- Do NOT implement automatic proxy discovery (user must configure)
- Do NOT add proxy market API integration (out of scope)
- Do NOT modify WAF detection logic
- Do NOT persist proxy credentials across sessions (config-only)

**Risk if Wrong:** Connection timeout if proxy is unavailable. Mitigated by fallback to direct connection on proxy failure (configurable).

---

## Architecture Slice

**Files to create:**
- `src/proxy.ts` — ProxyManager class with rotation logic
- `tests/proxy-rotation.test.ts` — mock proxy + navigation tests

**Files to modify:**
- `src/index.ts` — add `proxy` to Config interface
- `src/session.ts` — pass proxy config to `browser.newContext()`
- `README.md` — document proxy config options

**Files to avoid:**
- `src/stealth.ts` — unchanged (proxy is transparent to stealth)
- `src/waf/*.ts` — unchanged
- `src/tools.ts` — minimal changes (proxy passed through session)

**Source of truth:** `src/proxy.ts` (proxy manager) + `src/session.ts` (integration point)

**Read path:** Config → SessionManager constructor → browser.newContext({ proxy }) → page operations

**Write path:** N/A (proxy is read config, no state written)

**Contract boundary:** `Config.proxy?: ProxyConfig | ProxyConfig[]` where ProxyConfig = `{ url: string; username?: string; password?: string }`

**Integration points:**
- Playwright `Browser.newContext({ proxy })` option
- Existing SessionManager browser/context lifecycle

**Migration/cutover:** Pure addition. Setting `proxy` in config activates. Default (undefined) preserves existing direct connection.

**Acceptance evidence gate:** Proxy test passes + all existing tests still pass. `pnpm run test` exits 0.

---

## Task Breakdown

| # | Task | Files | Scope | Verification | Parallel? |
|---|------|-------|-------|--------------|-----------|
| 1 | Create `src/proxy.ts` — ProxyManager with rotation | `src/proxy.ts` | Proxy selection, round-robin rotation, validation | Unit tests pass | ✅ Yes |
| 2 | Integrate proxy into SessionManager | `src/session.ts`, `src/index.ts` | Pass proxy to browser.newContext() | typecheck passes | ❌ After #1 |
| 3 | Write proxy rotation tests | `tests/proxy-rotation.test.ts` | Mock proxy server + navigation verification | Tests pass | ✅ With #2 |
| 4 | Update README.md | `README.md` | Document proxy config syntax | Docs render | ✅ Yes |
