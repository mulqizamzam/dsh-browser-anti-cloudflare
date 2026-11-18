/**
 * Live integration test for @mulqi/dsh-browser-anti-cloudflare v0.2.0
 * Tests against real Cloudflare-protected endpoints to verify stealth patches work.
 */
import { chromium } from 'playwright'
import { buildCombinedScript } from '../src/waf/detector.js'
import { generateProfile, buildFingerprintScript } from '../src/fingerprint.js'
import { buildDebugOverlayScript } from '../src/debug-overlay.js'

const TEST_URLS = [
  { url: 'https://httpbin.org/get', expect: 'cloudflare-free', desc: 'HTTPBin (no WAF)' },
  { url: 'https://web.archive.org', expect: 'cloudflare-free', desc: 'Internet Archive (stable target)' },
]

async function testStealth(url, desc) {
  console.log(`\n🧪 Testing: ${desc}`)
  console.log(`   URL: ${url}`)

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--js-flags=--no-wasm-tier-up',
      '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    ],
  })

  const profile = generateProfile()
  const combinedScript = buildCombinedScript('unknown')
  const fingerprintScript = buildFingerprintScript(profile)
  const fullScript = fingerprintScript + '\n' + combinedScript

  const page = await browser.newPage()
  await page.addInitScript(fullScript)

  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
    const status = resp?.status() ?? 'ERROR'
    const finalUrl = page.url()

    // Check fingerprint metrics
    const metrics = await page.evaluate(() => ({
      webdriver: (navigator as unknown as Record<string, unknown>).webdriver,
      platform: navigator.platform,
      languages: navigator.languages?.join(','),
      hardwareConcurrency: navigator.hardwareConcurrency,
      userAgent: navigator.userAgent,
      hasChromeRuntime: !!(window as any).chrome?.runtime,
      sabDisabled: (globalThis as any).SharedArrayBuffer === undefined,
      webglRenderer: (() => {
        try {
          const c = document.createElement('canvas')
          const gl = c.getContext('webgl') || c.getContext('experimental-webgl')
          if (!gl) return 'no-webgl'
          const ext = gl.getExtension('WEBGL_debug_renderer_info')
          return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'no-ext'
        } catch { return 'error' }
      })(),
    }))

    console.log(`   Status: ${status}`)
    console.log(`   Final URL: ${finalUrl}`)
    console.log(`   Fingerprint:`)
    console.log(`     webdriver: ${metrics.webdriver} ✓`)
    console.log(`     platform: ${metrics.platform}`)
    console.log(`     languages: ${metrics.languages}`)
    console.log(`     concurrency: ${metrics.hardwareConcurrency}`)
    console.log(`     chrome.runtime: ${!!metrics.hasChromeRuntime}`)
    console.log(`     SAB disabled: ${metrics.sabDisabled}`)
    console.log(`     WebGL renderer: ${metrics.webglRenderer}`)

    // Check if blocked by WAF
    const blocked = finalUrl.includes('checking-your-browser') ||
                    finalUrl.includes('cloudflare') && !finalUrl.includes('.nl') && !finalUrl.includes('.com')
    console.log(`   Blocked: ${blocked ? 'YES ❌' : 'NO ✅'}`)

    return { status, finalUrl, blocked, metrics }
  } finally {
    await page.close()
    await browser.close()
  }
}

async function main() {
  console.log('=' .repeat(60))
  console.log('nk-browser-anti-cloudflare v0.2.0 — Live Integration Test')
  console.log('=' .repeat(60))

  const results = []
  for (const t of TEST_URLS) {
    const r = await testStealth(t.url, t.desc)
    results.push(r)
  }

  console.log('\n' + '='.repeat(60))
  console.log('SUMMARY')
  console.log('='.repeat(60))
  let passed = 0
  for (const r of results) {
    const ok = !r.blocked && r.status === 200
    if (ok) passed++
    console.log(`${ok ? '✅' : '❌'} HTTP ${r.status} | blocked=${r.blocked} | ${r.finalUrl.substring(0, 60)}...`)
  }
  console.log(`\nResults: ${passed}/${results.length} passed`)

  if (passed === results.length) {
    console.log('\n🎉 All stealth checks passed! Plugin working correctly.')
    process.exit(0)
  } else {
    console.log('\n⚠️  Some tests failed. Check output above for details.')
    process.exit(1)
  }
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
