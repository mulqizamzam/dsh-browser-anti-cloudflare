# Multi-Account Rotation Evidence

## Acceptance Evidence

AccountManager terintegrasi penuh ke SessionManager. Setiap account mendapat browser context terisolasi dengan fingerprint unik (WebGL renderer, platform, concurrency berbeda). Stealth patches diinject via addInitScript pada konteks per-account. Config `accounts` array di `Config` interface memungkinkan multi-account mode.

## Verification

```bash
$ pnpm run test
✓ tests/multi-account.test.ts     (6 tests)
Test Files: 12 passed (12)
     Tests: 59 passed (59)
```

## Review Notes

- Lazy-init: browser/context baru dibuat saat getAccountPage() pertama dipanggil
- Fingerprint script diinject otomatis ke setiap account context
- Platform isolation verified: Windows='Win32'/Intel GPU vs Mac='MacIntel'/Apple GPU
- Cookie/store isolation: setiap context memiliki storage terpisah
- Commit: `f83e485`