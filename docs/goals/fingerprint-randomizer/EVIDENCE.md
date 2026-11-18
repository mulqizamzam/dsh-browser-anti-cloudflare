# Fingerprint Randomizer Evidence

## Acceptance Evidence

FingerprintProfile di `src/fingerprint.ts` menghasilkan profil koheren per-session: WebGL renderer sesuai platform (Intel/Mesa/Apple), hardwareConcurrency realistis (4-16 core), screen resolution konsisten dengan device type. Baseline stealth script kini menggunakan profile-based generation alih-alih hardcoded values.

## Verification

```bash
$ pnpm run test
✓ tests/fingerprint-randomizer.test.ts   (8 tests)
Test Files: 10 passed (10)
     Tests: 52 passed (52)
```

## Review Notes

- Seed-based generation deterministic untuk reproducibility
- validateProfile() memastikan konsistensi internal sebelum digunakan
- generateBatch(100) lulus validasi 100%
- Commit: `b2d7808`, `3e89086`
