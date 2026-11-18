# Usage Examples — @mulqi/dsh-browser-anti-cloudflare

Panduan praktis memakai plugin ini untuk bypass Cloudflare dan situs lain yang mendeteksi bot.

---

## Quick Start

### 1. Install ke profil DSH

```bash
dsh plugin --profile web add "github:mulqizamzam/nk-browser-anti-cloudflare#main"
```

Tambahkan `allowBuilds` di `pnpm-workspace.yaml` profil jika belum ada:

```yaml
allowBuilds:
  '@mulqi/dsh-browser-anti-cloudflare@git+https://github.com/mulqizamzam/nk-browser-anti-cloudflare.git': true
```

### 2. Reload profil

```bash
dsh plugin --profile web reload
```

### 3. Verifikasi mount

```bash
dsh --profile web --dump-config | grep browser-anti-cloudflare
```

Harus muncul baris:
```
- id: browser-anti-cloudflare
  name: '@mulqi/dsh-browser-anti-cloudflare'
```

---

## Penggunaan Tools

Setelah terinstall, enam tool baru tersedia dengan prefix `ac_browser_`:

### Navigate — Buka halaman stealth

```json
{
  "name": "ac_browser_navigate",
  "arguments": {
    "url": "https://contoh-situs-cloudflare.com/page"
  }
}
```

Return value:
```json
{
  "url": "https://contoh-situs-cloudflare.com/page",
  "title": "Judul Halaman",
  "status": 200
}
```

### Screenshot — Tangkap layar

```json
{
  "name": "ac_browser_screenshot",
  "arguments": {
    "url": "https://contoh-situs-cloudflare.com/page",
    "fullPage": true
  }
}
```

Return value:
```json
{
  "data": "<base64-encoded-png>",
  "mimeType": "image/png",
  "width": 1280,
  "height": 800
}
```

### Click — Klik elemen

```json
{
  "name": "ac_browser_click",
  "arguments": {
    "url": "https://contoh-situs-cloudflare.com/page",
    "selector": "#login-button"
  }
}
```

Return value:
```json
{"success": true, "url": "https://contoh-situs-cloudflare.com/dashboard"}
```

### Type — Ketik teks

```json
{
  "name": "ac_browser_type",
  "arguments": {
    "url": "https://contoh-situs-cloudflare.com/login",
    "selector": "input[name='email']",
    "text": "admin@example.com"
  }
}
```

### Eval — Eksekusi JavaScript

```json
{
  "name": "ac_browser_eval",
  "arguments": {
    "url": "https://contoh-situs-cloudflare.com/page",
    "expression": "document.title"
  }
}
```

---

## Pola Penggunaan Umum

### Pola 1: Bypass Cloudflare + Ambil Konten

```
1. ac_browser_navigate(url="https://site-diblokir.com")
2. ac_browser_eval(expression="document.body.innerText") → ambil konten
3. ac_browser_screenshot(fullPage=true) → simpan bukti visual
```

### Pola 2: Otentikasi di Balik Cloudflare

```
1. ac_browser_navigate(url="https://site-diblokir.com/login")
2. ac_browser_type(selector="input#email", text="user@email.com")
3. ac_browser_type(selector="input#password", text="rahasia123")
4. ac_browser_click(selector="button[type=submit]")
5. ac_browser_eval(expression="window.location.href") → cek redirect sukses
```

### Pola 3: Scraping Multi-Halaman

```
1. For each url in pages:
     a. ac_browser_navigate(url=url)
     b. ac_browser_eval(expression="extractData()")
     c. Store result
```

### Pola 4: Verifikasi Anti-Detect

```
1. ac_browser_navigate(url="https://bot.sannysoft.com")
2. ac_browser_eval(expression="(navigator.webdriver === undefined) ? 'PASS' : 'FAIL'")
3. ac_browser_eval(expression="navigator.plugins.length > 3 ? 'PASS' : 'FAIL'")
4. ac_browser_eval(expression="chrome.runtime ? 'PASS' : 'FAIL'")
```

---

## Contoh Lengkap: Ambil Artikel dari Situs Ber-Cloudflare

```javascript
// Flow yang bisa diikuti agent:
const URL = 'https://contoh-blog-comfort-cc.com/artikel/123'

// 1. Navigasi dengan stealth
const navResult = await ac_browser_navigate({ url: URL })
console.log('Navigated:', navResult.title, navResult.status)

// 2. Tunggu konten utama muncul
await ac_browser_eval({
  url: URL,
  expression: 'await new Promise(r => setTimeout(r, 2000))'
})

// 3. Ekstrak artikel
const article = await ac_browser_eval({
  url: URL,
  expression: `
    const content = document.querySelector('article') || document.querySelector('.post-content');
    content ? content.innerText.substring(0, 5000) : 'No content found'
  `
})
console.log('Article:', article.result)

// 4. Screenshot sebagai bukti
const screenshot = await ac_browser_screenshot({ url: URL, fullPage: true })
fs.writeFileSync('/tmp/screenshot.png', Buffer.from(screenshot.data, 'base64'))
```

---

## Troubleshooting Umum

| Masalah | Solusi |
|---------|--------|
| Tool `ac_browser_*` tidak muncul | Cek `--dump-config`; pastikan tidak ada provider lain di slot `browserUse` |
| Halaman tetap menampilkan challenge Cloudflare | Tingkatkan `operationTimeoutMs` jadi 60000; pastikan headless mode |
| `ERR_MODULE_NOT_FOUND` | Jalankan `pnpm install` di repo plugin sebelum pakai `file:`/`link:` |
| Timeout saat navigasi | Periksa koneksi internet; coba target sederhana dulu (httpbin.org) |
| Screenshot kosong | Gunakan `fullPage: true` atau periksa apakah halaman butuh scroll |

---

## Catatan Penting

1. **Setiap call = fresh browser** — Tidak ada session persistence antar call. Jika butuh login state berulang, lakukan navigate + type + click dalam satu sequence.
2. **Headless default** — Untuk debugging visual, set `headless: false` di config.
3. **Hanya Chromium** — Firefox/WebKit tidak didukung karena patches menarget CDP.
4. **Exclusive slot** — Tidak bisa coexist dengan stagehand-native atau playwright-mcp.
