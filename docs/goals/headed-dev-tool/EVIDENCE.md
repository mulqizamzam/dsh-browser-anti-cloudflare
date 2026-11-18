# Headed Dev Tool Evidence

## Acceptance Evidence

Overlay debug panel tersedia saat `headless: false`. Panel menampilkan metrik fingerprint real-time: webdriver, plugins, chrome.runtime, SharedArrayBuffer, languages, platform. Script overlay TIDAK dimuat saat headless mode (zero overhead).

## Verification

```bash
$ pnpm run test
✓ tests/stealth.test.ts               (3 tests)
✓ tests/integration.test.ts           (2 tests)
✓ tests/waf-integration.test.ts       (9 tests)
✓ tests/live-waf.test.ts              (2 tests)
✓ tests/session-persistence.test.ts   (4 tests)
✓ tests/debug-overlay.test.ts         (5 tests)
✓ tests/smoke.test.ts                 (2 tests)
Test Files: 7 passed (7)
     Tests: 27 passed (27)
```

## Review Notes

- `src/debug-overlay.ts` dibuat — script IIFE untuk panel floating
- `stealth.ts` di-refactor: inject overlay hanya saat `{ debug: true }`
- `tools.ts` otomatis set `debug: !config.headless`
- Panel tidak terlihat di headless (expected — dev-only feature)
- Commit: `1733181`
