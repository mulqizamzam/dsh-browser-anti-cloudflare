# Project Harness Evidence — `@mulqi/dsh-browser-anti-cloudflare` v0.1.0

**Provider:** dsh · **Language:** id-ID · **Depth:** quick (7-day window) · **Decision:** review/evaluation  
**Owner limit:** 3 project assets inspected  

---

## Scope / Batas Riwayat

Package baru (v0.1.0), pertama kali dibuat hari ini. Tidak ada riwayat git (`NO_GIT_HISTORY`). Tidak ada file pengujian, tidak ada AGENTS.md/CLAUDE.md. Total source ~290 baris di 3 file (`src/index.ts`, `src/tools.ts`, `src/stealth.ts`). Tidak ada churn yang bisa diukur; seluruh bukti bersifat statik-deklaratif dari arsitektur paket itu sendiri.

---

## Bukti Lima Dimensi

### 1. Context Map
| Sub-metrik | Status | Bukti |
|---|---|---|
| Task Entrypoint | ✅ Tercatat | `SKILL.md` memuat trigger phrases, quick-ref table, dan arsitektur. `README.md` memberikan instalasi & konfigurasi. |
| Context & Boundary Map | ⚠️ Parsial | Cordis patch YML ada; eksklusivitas slot `browserUse` dijelaskan di README & SKILL.md, tapi tidak ada file `AGENTS.md` atau diagram dependensi visual. |
| Risk & Next-Step Route | ⚠️ Parsial | Risiko eksklusivitas slot dan workspace-only dependency disebutkan di README/SKILL. Tidak ada route manual untuk recovery setelah boot gagal ("already registered"). |

### 2. Environment Readiness
| Sub-metrik | Status | Bukti |
|---|---|---|
| Entry terverifikasi | ✅ Ada | `engines.dsh` dipin eksak `"0.2.1-rc.2"`, bukan caret. |
| Run & Doctor command surface | ⚠️ Declaratif saja | `tsdown.config.ts` ada, build target `lib/index.js`. Checklist verifikasi di SKILL.md ada tapi belum ada script `scripts/verify.sh` atau Makefile. |
| State reset & isolasi | ❌ Unavailable | Tidak ada mekanisme reset state browser per operasi selain pola "launch → operate → close" di `runOp()` finally block. Tidak ada isolasi profile/session. |

### 3. Fast Feedback
| Sub-metrik | Status | Bukti |
|---|---|---|
| Validation signal layers | ❌ Null | Tidak ada test runner (jest/vitest) terdeteksi. Tidak ada CI YAML. Satu-satunya validasi adalah `node --check lib/index.js` manual yang disebutkan di SKILL.md. |
| Signal speed & actionability | N/A | — |
| Affected check routing | ❌ Unavailable | Tanpa test, tidak ada routing "affected check" saat perubahan source. |

### 4. Quality Gates
| Sub-metrik | Status | Bukti |
|---|---|---|
| Rule coverage | ⚠️ Parsial | `tsconfig.json` dengan `strict: true` memberi type-checking. Build tool `tsdown` dengan `dts: true` menghasilkan type declarations. |
| Enforcement gate strength | ⚠️ Declaratif | Tidak ada pre-commit hook, tidak ada linting, tidak ada CI pipeline. Type-check hanya berjalan saat developer ran `tsc` secara manual. |
| Rule repair path | ❌ Unavailable | Tanpa gate mekanis, tidak ada jalur perbaikan otomatis. |

### 5. Change Safety
| Sub-metrik | Status | Bukti |
|---|---|---|
| Agent lifecycle guardrails | ⚠️ Parsial | Pola `ctx.effect(function* () { ... })` di `apply()` menunjukkan awareness resource lifecycle. Browser ditutup di `try/finally` per operasi. |
| Merge acceptance path | ❌ Unavailable | Tidak ada branch strategy, PR template, atau merge gate. |
| Side-effect, permission & recovery boundary | ⚠️ Parsial | Setiap operasi `runOp()` membuka browser baru dan menutupnya — menghindari state leakage lintas-panggilan. Namun tidak ada mekanisme rollback jika `ctx.browserUse.register()` conflicts. |

---

## Kemampuan Terkuat

1. **Struktur plugin Cordis bersih** — `index.ts` hanya 45 baris, mengikuti pola stagehand-native dengan `{name, inject, Config, apply}` yang konsisten.
2. **Eksklusivitas slot `browserUse` di-handling** di dokumentasi (README + SKILL.md).
3. **Pola browser-per-operation** (`launchStealthBrowser` → operasi → `browser.close()` di finally) mencegah resource leak dan state antar-call.
4. **Type safety** via `strict: true` tsconfig + `dts: true` tsdown.

---

## Risiko Inti

1. **Tidak ada pengujian sama sekali** — seluruh 5 dimensi `Fast Feedback` dan sebagian besar `Quality Gates` kosong. Bug di `stealth.ts` (misalnya WebGL patch yang salah) tidak akan tertangkap sebelum production.
2. **Tidak ada riwayat git** — tidak bisa memverifikasi apakah package ini hasil iterasi atau first commit mentah.
3. **Workspace-only dependency** berarti package tidak bisa diuji import-nya di luar DSH pnpm workspace — circle testing yang sulit diverifikasi secara mandiri.

---

## Coverage Tes & Observabilitas

- **Test coverage:** 0% — tidak ada file `.test.*`, `.spec.*`, `tests/`, atau `__tests__/`.
- **Observabilitas:** nol logger/import di source. Satu-satunya observabilitas berasal dari SKILL.md checklist dan output log DSH saat boot. Tidak ada structured logging, tidak ada metrics export.

---

## Referensi Owner & Bukti yang Hilang

**Owner files yang dibaca (3):**
1. `package.json` — manifest, deps, engines pin
2. `README.md` — dokumentasi instalasi & kompatibilitas
3. `SKILL.md` — builder skill dengan checklist verifikasi

**Yang diharapkan tetapi tidak ditemukan:**
- `AGENTS.md` / `CLAUDE.md` (agent-facing instructions)
- File tes apa pun
- `scripts/` directory dengan script CI/build/verify
- `CHANGELOG.md` atau release notes
- Git history (repository initialized tapi kosong log-nya)
- Observability utilities (logger, tracer, metrics)

---

## Kandidat Temuan (Quick Mode, maks 3)

1. **Tidak ada suite pengujian** — seluruh kode fungsi inti (`launchStealthBrowser`, `navigateWithStealth`, `runOp`) berjalan tanpa satu pun test case. Regresi di stealth script injection atau tool registration tidak terdeteksi secara mekanis.

2. **Tidak ada riwayat git** — package v0.1.0 tanpa commit history membuat mustahil menelusuri intent awal, menentukan churn pattern, atau memverifikasi apakah ini fresh scaffold atau hasil modifikasi.

3. **Tidak ada observabilitas runtime** — source tidak mengimpor atau memanggil logger apapun. Ketika tool `ac_browser_*` gagal di lapangan, debugging hanya mengandalkan log DSH eksternal, bukan struktur logging yang terbangun di dalam package.

---

## Klaim yang TIDAK BISA Dibuat Lead dari Bukti Ini

- *"Plugin ini sudah teruji dan stabil."* — tidak ada bukti uji mekanis.
- *"Package ini memiliki riwayat pengembangan yang terverifikasi."* — tidak ada git history.
- *"Observabilitas runtime sudah tercakup."* — tidak ada logger di source.
- *"CI/CD menjalankan quality gates secara otomatis."* — tidak ada workflow file terdeteksi.
- *"Package ini aman untuk production multi-tenant."* — eksklusivitas slot dan tidak adanya isolation test menyisakan keraguan.
