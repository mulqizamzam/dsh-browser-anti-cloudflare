/**
 * Debug overlay — floating panel showing real-time anti-detect fingerprint metrics.
 *
 * Only injected when headless mode is disabled (development use). Zero overhead
 * in production/headless since the script is never loaded.
 *
 * Metrics displayed:
 * - navigator.webdriver
 * - navigator.plugins length
 * - WebGL renderer string
 * - chrome.runtime presence
 * - SharedArrayBuffer status
 */

export function buildDebugOverlayScript(): string {
  return `
(() => {
  // Only inject if not already present (prevent double-injection)
  if (document.getElementById('__stealth-debug-panel')) return

  const panel = document.createElement('div')
  panel.id = '__stealth-debug-panel'
  panel.style.cssText = \`
    position: fixed;
    top: 10px;
    right: 10px;
    z-index: 2147483647;
    background: rgba(10, 10, 20, 0.92);
    color: #e0e0e0;
    font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
    font-size: 11px;
    line-height: 1.6;
    padding: 10px 14px;
    border-radius: 8px;
    border: 1px solid rgba(100, 200, 255, 0.3);
    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    min-width: 220px;
    pointer-events: auto;
    cursor: default;
  \`

  const header = document.createElement('div')
  header.style.cssText = 'font-weight:bold;color:#6cf;margin-bottom:4px;border-bottom:1px solid rgba(100,200,255,0.2);padding-bottom:4px;'
  header.textContent = '🔍 Stealth Debug'
  panel.appendChild(header)

  const rows = [
    { label: 'webdriver', check: () => (navigator as unknown as Record<string, unknown>).webdriver === undefined },
    { label: 'plugins', check: () => { try { return navigator.plugins.length > 0 } catch { return false } } },
    { label: 'chrome.runtime', check: () => typeof (window as unknown as Record<string, unknown>).chrome !== 'undefined' },
    { label: 'SA Buffer', check: () => (globalThis as unknown as Record<string, unknown>).SharedArrayBuffer === undefined },
    { label: 'languages', check: () => { try { return navigator.languages?.includes('en-US') } catch { return false } } },
    { label: 'platform', check: () => typeof navigator.platform === 'string' },
  ]

  for (const { label, check } of rows) {
    const row = document.createElement('div')
    row.style.cssText = 'display:flex;justify-content:space-between;gap:8px;'
    const statusEl = document.createElement('span')
    statusEl.className = 'stealth-metric'
    statusEl.dataset.label = label
    const update = () => {
      const ok = check()
      statusEl.textContent = ok ? '✓' : '✗'
      statusEl.style.color = ok ? '#4f8' : '#f44'
    }
    update()
    // Re-check on any navigation
    const obs = new MutationObserver(update)
    obs.observe(document.body || document, { childList: true, subtree: true })
    row.innerHTML = \`<span style="color:#aaa">\${label}:</span>\`
    row.appendChild(statusEl)
    panel.appendChild(row)
  }

  // Show timestamp
  const ts = document.createElement('div')
  ts.style.cssText = 'color:#666;font-size:9px;margin-top:4px;text-align:right;'
  ts.className = 'stealth-timestamp'
  const refreshTs = () => {
    ts.textContent = 'updated: ' + new Date().toLocaleTimeString()
  }
  refreshTs()
  setInterval(refreshTs, 5000)
  panel.appendChild(ts)

  document.documentElement.appendChild(panel)
})()
  `
}
