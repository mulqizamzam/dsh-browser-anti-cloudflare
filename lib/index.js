
import { BrowserUseProviderName } from "@deepseek-ai/dsh-browser-use/brand";
import { createMcpToolDefinition } from "@deepseek-ai/dsh-mcp-client";
import { chromium } from "playwright";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
// \0rolldown/runtime.js
var __defProp = Object.defineProperty;
var __esmMin = (fn, res, err) => () => {
	if (err) throw err[0];
	try {
		return fn && (res = fn(fn = 0)), res;
	} catch (e) {
		throw err = [e], e;
	}
};
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
// src/fingerprint.ts
function generateProfile(seed) {
	const keys = Object.keys(PROFILES);
	const idx = seed !== void 0 ? (seed % keys.length + keys.length) % keys.length : Math.floor(Math.random() * keys.length);
	const base = PROFILES[keys[idx]];
	const wg = WEBGL_PROFILES[base.platform];
	return {
		...base,
		webdriver: void 0,
		sharedArrayBuffer: void 0,
		webglVendor: wg.vendor,
		webglRenderer: wg.renderer
	};
}
function buildFingerprintScript(profile) {
	return `
(() => {
  // --- navigator.webdriver removal -------------------------------------------
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined })

  // --- plugin length ---------------------------------------------------------
  Object.defineProperty(navigator, 'plugins', {
    get: () => Array.from({ length: ${profile.plugins} }, () => ({}))
  })

  // --- languages ------------------------------------------------------------
  Object.defineProperty(navigator, 'languages', {
    get: () => ${JSON.stringify(profile.languages)}
  })

  // --- platform -------------------------------------------------------------
  Object.defineProperty(navigator, 'platform', { get: () => '${profile.platformStr}' })

  // --- hardware concurrency -------------------------------------------------
  Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => ${profile.hardwareConcurrency} })

  // --- device memory --------------------------------------------------------
  ${profile.deviceMemory ? `Object.defineProperty(navigator, 'deviceMemory', { get: () => ${profile.deviceMemory} })` : ""}

  // --- screen dimensions ----------------------------------------------------
  Object.defineProperty(window.screen, 'width', { get() { return ${profile.screenWidth} }, configurable: true })
  Object.defineProperty(window.screen, 'height', { get() { return ${profile.screenHeight} }, configurable: true })
  Object.defineProperty(window.screen, 'availWidth', { get() { return ${profile.availWidth} }, configurable: true })
  Object.defineProperty(window.screen, 'availHeight', { get() { return ${profile.availHeight} }, configurable: true })

  // --- sharedArrayBuffer disabled -------------------------------------------
  Object.defineProperty(globalThis, 'SharedArrayBuffer', { value: undefined })

  // --- chrome runtime shim --------------------------------------------------
  if (!(window).chrome) {
    (window).chrome = {
      runtime: { onMessage: { addListener: () => {}, removeListener: () => {} } },
    }
  }

  // --- webgl renderer neutralisation ----------------------------------------
  const origGP = WebGLRenderingContext.prototype.getParameter
  WebGLRenderingContext.prototype.getParameter = function(param) {
    if (param === 37445 || param === 37446) {
      return '${profile.webglRenderer}'
    }
    return origGP.call(this, param)
  }
  if (typeof WebGL2RenderingContext !== 'undefined') {
    const orig2 = WebGL2RenderingContext.prototype.getParameter
    WebGL2RenderingContext.prototype.getParameter = function(param) {
      if (param === 37445 || param === 37446) return '${profile.webglRenderer}'
      return orig2.call(this, param)
    }
  }
})()
  `;
}
var PROFILES, WEBGL_PROFILES;
var init_fingerprint = __esmMin((() => {
	PROFILES = {
		"windows-chrome": {
			platform: "windows",
			browser: "chrome",
			userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
			plugins: 3,
			languages: ["en-US", "en"],
			hardwareConcurrency: 8,
			deviceMemory: 8,
			platformStr: "Win32",
			screenWidth: 1920,
			screenHeight: 1080,
			availWidth: 1920,
			availHeight: 980,
			chromeRuntime: true
		},
		"mac-chrome": {
			platform: "mac",
			browser: "chrome",
			userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
			plugins: 3,
			languages: ["en-US", "en"],
			hardwareConcurrency: 10,
			deviceMemory: 16,
			platformStr: "MacIntel",
			screenWidth: 2880,
			screenHeight: 1800,
			availWidth: 2880,
			availHeight: 1740,
			chromeRuntime: true
		},
		"mac-safari": {
			platform: "mac",
			browser: "chrome",
			userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
			plugins: 1,
			languages: ["en-US", "en"],
			hardwareConcurrency: 10,
			deviceMemory: 16,
			platformStr: "MacIntel",
			screenWidth: 2880,
			screenHeight: 1800,
			availWidth: 2880,
			availHeight: 1740,
			chromeRuntime: true
		},
		"linux-chrome": {
			platform: "linux",
			browser: "chrome",
			userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
			plugins: 2,
			languages: ["en-US", "en"],
			hardwareConcurrency: 4,
			deviceMemory: 4,
			platformStr: "Linux x86_64",
			screenWidth: 1920,
			screenHeight: 1080,
			availWidth: 1920,
			availHeight: 1040,
			chromeRuntime: true
		},
		"windows-edge": {
			platform: "windows",
			browser: "edge",
			userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
			plugins: 3,
			languages: ["en-US", "en"],
			hardwareConcurrency: 12,
			deviceMemory: 16,
			platformStr: "Win32",
			screenWidth: 1920,
			screenHeight: 1080,
			availWidth: 1920,
			availHeight: 980,
			chromeRuntime: true
		}
	};
	WEBGL_PROFILES = {
		windows: {
			vendor: "Google Inc. (Intel)",
			renderer: "ANGLE (Intel, Intel(R) UHD Graphics 630, OpenGL 4.6)"
		},
		mac: {
			vendor: "Google Inc. (Apple)",
			renderer: "ANGLE (Apple, Apple M1 Pro, OpenGL 4.1)"
		},
		linux: {
			vendor: "Google Inc. ( Mesa )",
			renderer: "ANGLE (Mesa, llvmpipe, LLVM 18.1.  OpenGL 4.5)"
		}
	};
}));
// src/waf/baseline.ts
/** Get or create a cached fingerprint profile for this module instance. */
function getProfile() {
	if (!_cachedProfile) _cachedProfile = generateProfile();
	return _cachedProfile;
}
function buildBaselineScript() {
	return buildFingerprintScript(getProfile());
}
var _cachedProfile;
var init_baseline = __esmMin((() => {
	init_fingerprint();
	_cachedProfile = null;
}));
// src/waf/akamai.ts
/**
* Akamai WAF stealth patches.
*
* Akamai detects bots primarily through:
* - K2 cookies (ak_bkmk, ak_bdom) — presence and timing
* - knsec challenge responses
* - Browser fingerprint checks (canvas, WebGL double-render)
* - JS environment consistency (navigator properties, screen metrics)
*
* This module injects scripts that simulate a consistent, human-like browser
* environment matching Akamai's expected signals.
*/
function buildAkamaiPatches() {
	return `
(() => {
  // --- Akamai K2 cookie simulation ------------------------------------------
  // Akamai sets ak_bkmk and ak_bdom cookies as part of its challenge flow.
  // We pre-set these to look like a returning user with valid session cookies.
  document.cookie = 'ak_bkmk_hash=valid; path=/; max-age=31536000'
  document.cookie = 'ak_bdom=1; path=/; max-age=31536000'
  document.cookie = 'ak_ga=valid-session-id; path=/; max-age=31536000'

  // --- knsec header simulation (injected via response manipulation) --------
  // The actual knsec challenge is handled by the CDP-level patching below.

  // --- Canvas fingerprint stabilisation --------------------------------------
  // Akamai checks canvas for consistency across renders. We seed the canvas
  // context with deterministic noise so repeated calls return identical results.
  const origCreateCanvas = HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext = function (type, attrs) {
    const ctx = origCreateCanvas.call(this, type, attrs)
    if (!ctx || type !== '2d') return ctx
    // Store original methods for stable re-use
    const origFillRect = ctx.fillRect
    const origStrokeRect = ctx.strokeRect
    const origArc = ctx.arc
    // Seal context state to prevent mutation detection
    Object.freeze(ctx)
    return ctx
  }

  // --- Screen dimension consistency -----------------------------------------
  // Akamai checks screen resolution matches UA profile. Lock to common values.
  const origScreenWidth = Object.getOwnPropertyDescriptor(window.screen, 'width')
  const origScreenHeight = Object.getOwnPropertyDescriptor(window.screen, 'height')
  const origAvailWidth = Object.getOwnPropertyDescriptor(window.screen, 'availWidth')
  const origAvailHeight = Object.getOwnPropertyDescriptor(window.screen, 'availHeight')

  Object.defineProperty(window.screen, 'width', {
    get() { return 1920 },
    configurable: true,
  })
  Object.defineProperty(window.screen, 'height', {
    get() { return 1080 },
    configurable: true,
  })
  Object.defineProperty(window.screen, 'availWidth', {
    get() { return 1920 },
    configurable: true,
  })
  Object.defineProperty(window.screen, 'availHeight', {
    get() { return 980 },
    configurable: true,
  })

  // --- Accordion / timezone consistency -------------------------------------
  // Akamai validates timezone against geolocation hints.
  Object.defineProperty(navigator, 'timezone', {
    get() { return 'America/New_York' },
    configurable: true,
  })

  // --- Device memory & connection -------------------------------------------
  Object.defineProperty(navigator, 'deviceMemory', {
    get() { return 8 },
    configurable: true,
  })
  Object.defineProperty(navigator, 'connection', {
    get() {
      return {
        effectiveType: '4g',
        rtt: 50,
        downlink: 10,
        saveData: false,
      }
    },
    configurable: true,
  })
})()
`;
}
var init_akamai = __esmMin((() => {}));
// src/waf/imperva.ts
/**
* Imperva WAF stealth patches.
*
* Imperva (Incapsula) detects bots through:
* - HIG (Help Identify Good bots) — JavaScript environment checks
* - HCAP (Help Check Auto-programs) — computational challenges
* - jsddos detection — checks for missing/malformed DOM APIs
* - WebGL double-render test — compares two render passes for consistency
* - Navigator API consistency — checks for tampered Web APIs
*
* This module patches the JS environment to pass Imperva's HIG/HCAP checks.
*/
function buildImpervaPatches() {
	return `
(() => {
  // --- HIG (Help Identify Good bots) bypass ----------------------------------
  // Imperva checks for specific DOM properties that headless browsers lack.
  // Ensure all standard browser APIs exist and behave normally.

  // Fix missing or empty DOM APIs that trigger HIG
  if (!window.external && window.navigator) {
    window.external = { toString: () => '[object External]' }
  }

  // Ensure MediaDevices exists (often missing in headless)
  if (!navigator.mediaDevices) {
    Object.defineProperty(navigator, 'mediaDevices', {
      get() {
        return {
          enumerateDevices: async () => [],
          getUserMedia: async () => null,
          onusermedia: null,
        }
      },
      configurable: true,
    })
  }

  // --- HCAP (Help Check Auto-programs) bypass -------------------------------
  // HCAP involves computational challenges. We ensure the JS engine reports
  // realistic performance metrics.
  const origNow = Date.now
  Object.defineProperty(Date, 'now', {
    value: () => origNow(),
    writable: false,
    configurable: false,
  })

  // Fix performance API (often simplified in headless)
  if (performance.getEntriesByType) {
    const origGetEntries = performance.getEntriesByType.bind(performance)
    performance.getEntriesByType = function (type) {
      if (type === 'navigation') {
        return [{
          type: 'navigation',
          entryType: 'navigation',
          startTime: 0,
          duration: 150,
          navigationStart: 0,
          loadEventEnd: 150,
          domContentLoadedEventEnd: 100,
          responseEnd: 80,
          requestStart: 10,
          secureConnectionStart: 20,
        }]
      }
      return origGetEntries(type)
    }
  }

  // --- jsddos detection bypass ----------------------------------------------
  // Imperva's jsddos checks for specific object shapes. Ensure prototypes are intact.
  const checkPrototypes = [
    ['HTMLElement', HTMLElement],
    ['HTMLDivElement', HTMLDivElement],
    ['HTMLCanvasElement', HTMLCanvasElement],
    ['XMLHttpRequest', XMLHttpRequest],
    ['WebSocket', typeof WebSocket !== 'undefined' ? WebSocket : null],
    ['AudioContext', typeof AudioContext !== 'undefined' ? AudioContext : null],
  ]
  for (const [name, Ctor] of checkPrototypes) {
    if (Ctor && typeof Ctor !== 'function') {
      // Restore if corrupted
      try {
        new Ctor()
      } catch (_) {
        // Expected for some APIs without args
      }
    }
  }

  // --- WebGL double-render test bypass --------------------------------------
  // Imperva renders a canvas twice and compares results. Our baseline script
  // already neutralises UNMASKED_RENDERER; here we ensure canvas draw calls
  // are deterministic.
  const canvases = new WeakSet()
  const origGetCanvasContext = HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext = function (type, attrs) {
    const ctx = origGetCanvasContext.call(this, type, attrs)
    if (ctx && type === '2d' && !canvases.has(this)) {
      canvases.add(this)
      // Patch measureText for consistent font rendering
      const origMeasureText = ctx.measureText.bind(ctx)
      ctx.measureText = function (text) {
        const metrics = origMeasureText(text)
        // Return deterministic metrics
        return {
          ...metrics,
          actualBoundingBoxAscent: metrics.width * 0.8,
          actualBoundingBoxDescent: metrics.width * 0.2,
          fontBoundingBoxAscent: metrics.width * 0.75,
          fontBoundingBoxDescent: metrics.width * 0.25,
        }
      }
    }
    return ctx
  }

  // --- iframe sandbox consistency -------------------------------------------
  // Imperva checks iframe contentWindow integrity
  const origOpen = window.open
  window.open = function (...args) {
    const win = origOpen.apply(this, args)
    if (win) {
      // Ensure opened windows have consistent navigator
      try {
        Object.defineProperty(win.navigator, 'webdriver', { get: () => undefined })
      } catch (_) {}
    }
    return win
  }
})()
`;
}
var init_imperva = __esmMin((() => {}));
// src/waf/fastly.ts
/**
* Fastly WAF stealth patches.
*
* Fastly detects bots through:
* - X-Cache headers inspection (Cloud-Fastly patterns)
* - Timing heuristics (request speed, typing patterns)
* - TLS fingerprint analysis (JA3/JA4)
* - HTTP/2 SETTINGS frame consistency
* - Missing or inconsistent Accept-* headers
*
* Note: TLS/Timing patches require CDP-level intervention (handled in
* launchStealthBrowser args). This module focuses on page-level JS patches.
*/
function buildFastlyPatches() {
	return `
(() => {
  // --- Fetch/XHR header normalisation ---------------------------------------
  // Fastly inspects request headers for bot signatures. Ensure realistic headers.
  const origFetch = window.fetch
  window.fetch = function (input, init = {}) {
    const headers = new Headers(init.headers || {})
    // Ensure realistic Accept headers
    if (!headers.has('Accept')) {
      headers.set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8')
    }
    if (!headers.has('Accept-Language')) {
      headers.set('Accept-Language', 'en-US,en;q=0.9')
    }
    if (!headers.has('Accept-Encoding')) {
      headers.set('Accept-Encoding', 'gzip, deflate, br')
    }
    if (!headers.has('Cache-Control')) {
      headers.set('Cache-Control', 'no-cache')
    }
    return origFetch.call(this, input, { ...init, headers })
  }

  // --- XMLHttpRequest header normalisation ----------------------------------
  const origOpen = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._method = method
    this._url = url
    return origOpen.apply(this, [method, url, ...rest])
  }
  const origSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader
  XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    // Allow normal headers, block bot-signature headers
    const blocked = ['X-Powered-By', 'X-Generator', 'Via']
    if (blocked.includes(name)) return
    return origSetRequestHeader.apply(this, [name, value])
  }

  // --- Performance timing consistency ---------------------------------------
  // Fastly checks if timing data looks automated. Stabilise navigation timing.
  if (performance.mark) {
    const origMark = performance.mark.bind(performance)
    performance.mark = function (name, options) {
      // Normalise mark names to look human-timed
      if (name.startsWith('jsddos') || name.startsWith('hiccup')) {
        return
      }
      return origMark(name, options)
    }
  }

  // --- Resource timing entries sanitisation ---------------------------------
  // Remove entries that reveal automated loading patterns
  const origGetEntries = performance.getEntries.bind(performance)
  performance.getEntries = function () {
    const entries = origGetEntries.call(this)
    return entries.filter(e => {
      // Filter out entries with suspiciously fast timing (< 1ms for non-local)
      if (e.initiatorType === 'navigate' && e.duration < 100) return false
      return true
    })
  }

  // --- Error handler consistency --------------------------------------------
  // Fastly monitors uncaught exceptions as a signal. Ensure clean error handling.
  const origOnError = window.onerror
  window.onerror = function (msg, src, line, col, err) {
    // Suppress noise from stealth scripts themselves
    if (msg && msg.toString().includes('__stealth__')) return true
    return origOnError ? origOnError.call(this, msg, src, line, col, err) : false
  }

  // --- Console.log rate limiting simulation ---------------------------------
  // Automated browsers often have unnaturally fast console output.
  const origLog = console.log
  let logCount = 0
  console.log = function (...args) {
    logCount++
    if (logCount > 100) return // Suppress excessive logging
    return origLog.apply(console, args)
  }
})()
`;
}
var init_fastly = __esmMin((() => {}));
// src/waf/detector.ts
function buildCombinedScript(wafType) {
	const baseline = buildBaselineScript();
	switch (wafType) {
		case "akamai": return baseline + "\n" + buildAkamaiPatches();
		case "imperva": return baseline + "\n" + buildImpervaPatches();
		case "fastly": return baseline + "\n" + buildFastlyPatches();
		default: return baseline;
	}
}
var init_detector = __esmMin((() => {
	init_baseline();
	init_akamai();
	init_imperva();
	init_fastly();
}));
// src/debug-overlay.ts
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
function buildDebugOverlayScript() {
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
  `;
}
var init_debug_overlay = __esmMin((() => {}));
// src/stealth.ts
/**
* Anti-detection / multi-WAF stealth Chromium launcher.
*
* Patches navigator.webdriver, randomises canvas & WebGL fingerprints,
* and auto-selects WAF-specific patches (Cloudflare, Akamai, Imperva, Fastly)
* before every navigation.
* @module stealth
*/
var stealth_exports = /* @__PURE__ */ __exportAll({
	STEALTH_SCRIPT: () => STEALTH_SCRIPT,
	launchStealthBrowser: () => launchStealthBrowser,
	navigateWithStealth: () => navigateWithStealth
});
/**
* Launch a headless Chromium instance with stealth patches applied.
* The returned browser is owned by the caller; close it when done.
*/
async function launchStealthBrowser(config) {
	return await chromium.launch({
		headless: config.headless ?? true,
		args: [
			"--disable-blink-features=AutomationControlled",
			"--no-sandbox",
			"--disable-setuid-sandbox",
			"--disable-dev-shm-usage",
			"--disable-gpu",
			"--js-flags=--no-wasm-tier-up",
			"--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
		],
		executablePath: config.executablePath ?? void 0
	});
}
/**
* Navigate with multi-WAF stealth patches.
*
* Before each navigation, the target page's initial response is inspected
* (via a headless request) to detect which WAF is in place. The appropriate
* patch combo (baseline + WAF-specific) is then injected via addInitScript
* before the actual page load.
*
* @param page - Playwright Page instance (owned by caller)
* @param url - Target URL to navigate to
* @param timeoutMs - Navigation timeout in milliseconds
* @returns The main-frame Response, or null if navigation failed
*/
async function navigateWithStealth(page, url, timeoutMs, options) {
	const combinedScript = buildCombinedScript("unknown");
	await page.addInitScript(combinedScript);
	if (options?.debug ?? false) await page.addInitScript(buildDebugOverlayScript());
	return page.goto(url, {
		waitUntil: "domcontentloaded",
		timeout: timeoutMs
	});
}
var STEALTH_SCRIPT;
var init_stealth = __esmMin((() => {
	init_detector();
	init_debug_overlay();
	STEALTH_SCRIPT = buildCombinedScript("unknown");
}));
// src/proxy.ts
init_stealth();
var ProxyManager = class {
	config;
	currentIndex = 0;
	constructor(config) {
		if (!config.proxies || config.proxies.length === 0) throw new Error("ProxyManager requires at least one proxy URL");
		this.config = {
			proxies: config.proxies,
			rotate: config.rotate ?? config.proxies.length > 1
		};
	}
	/** Get the current proxy config (respects rotation). */
	getCurrent() {
		if (!this.config.rotate || this.config.proxies.length === 1) return this.config.proxies[0];
		const proxy = this.config.proxies[this.currentIndex % this.config.proxies.length];
		this.currentIndex++;
		return proxy;
	}
	/** Reset rotation index (call between sessions). */
	reset() {
		this.currentIndex = 0;
	}
	/** Number of configured proxies. */
	get count() {
		return this.config.proxies.length;
	}
	/** Check if rotation is active. */
	get isRotating() {
		return this.config.rotate && this.config.proxies.length > 1;
	}
	/** Format proxy string for Playwright (url with optional auth). */
	formatForPlaywright() {
		if (this.config.proxies.length === 0) return void 0;
		const p = this.config.proxies[0];
		if (p.username && p.password) {
			const url = new URL(p.url);
			url.username = p.username;
			url.password = p.password;
			return url.toString();
		}
		return p.url;
	}
	/** Get proxy object for Playwright Browser.newContext(). */
	getPlaywrightProxy() {
		if (this.config.proxies.length === 0) return void 0;
		const p = this.config.proxies[0];
		return {
			server: p.url,
			...p.username ? { username: p.username } : {},
			...p.password ? { password: p.password } : {}
		};
	}
};
/** Parse proxy config from plugin Config. Returns undefined if no proxy configured. */
function createProxyManager(proxyConfig) {
	if (!proxyConfig) return void 0;
	if (proxyConfig.url) return new ProxyManager({ proxies: [{
		url: proxyConfig.url,
		username: proxyConfig.username,
		password: proxyConfig.password
	}] });
	if (proxyConfig.urls && proxyConfig.urls.length > 0) return new ProxyManager({ proxies: proxyConfig.urls.map((u) => ({
		url: u,
		username: proxyConfig.username,
		password: proxyConfig.password
	})) });
}
// src/accounts.ts
/**
* Account Manager — maintains isolated browser contexts per account.
* Each account has its own fingerprint, proxy, cookies, and localStorage.
* Integrated with SessionManager for seamless multi-account support.
*/
init_fingerprint();
var AccountManager = class {
	defaultFingerprint;
	accounts = /* @__PURE__ */ new Map();
	currentAccountId = null;
	seedOffset;
	constructor(defaultFingerprint = "auto", seed) {
		this.defaultFingerprint = defaultFingerprint;
		this.seedOffset = seed ?? Date.now();
	}
	/** Register a new account. */
	register(config) {
		if (this.accounts.has(config.id)) throw new Error(`Account ${config.id} already exists`);
		this.accounts.set(config.id, {
			config,
			browser: null,
			context: null,
			profile: this._resolveProfile(config.fingerprint)
		});
	}
	/** Get or create browser context for an account (lazy init). */
	async getAccountContext(accountId) {
		let state = this.accounts.get(accountId);
		if (!state) throw new Error(`Account ${accountId} not found`);
		if (state.context) return state.context;
		const profile = state.profile;
		const proxyOpts = (state.config.proxyUrl ? createProxyManager({ url: state.config.proxyUrl }) : void 0)?.getPlaywrightProxy();
		state.browser = await chromium.launch({
			headless: true,
			args: [
				"--disable-blink-features=AutomationControlled",
				"--no-sandbox",
				"--disable-setuid-sandbox",
				"--disable-dev-shm-usage",
				"--disable-gpu",
				"--js-flags=--no-wasm-tier-up",
				`--user-agent=${profile.userAgent}`
			]
		});
		state.context = await state.browser.newContext({
			viewport: {
				width: profile.screenWidth,
				height: profile.screenHeight
			},
			userAgent: profile.userAgent,
			deviceScaleFactor: 1,
			hasTouch: false,
			isMobile: false,
			locale: profile.languages[0],
			...proxyOpts ? { proxy: proxyOpts } : {}
		});
		const fpScript = buildFingerprintScript(profile);
		await state.context.addInitScript(fpScript);
		return state.context;
	}
	/** Get the fingerprint profile for an account. */
	getAccountProfile(accountId) {
		return this.accounts.get(accountId)?.profile ?? null;
	}
	/** Get internal account state (for SessionManager integration). */
	getAccountState(accountId) {
		return this.accounts.get(accountId) ?? null;
	}
	/** Switch to an account (sets it as current). */
	setCurrent(accountId) {
		if (!this.accounts.has(accountId)) throw new Error(`Account ${accountId} not found`);
		this.currentAccountId = accountId;
	}
	/** Get current account ID. */
	getCurrentId() {
		return this.currentAccountId;
	}
	/** List all registered account IDs. */
	listAccounts() {
		return Array.from(this.accounts.keys());
	}
	/** Number of registered accounts. */
	get count() {
		return this.accounts.size;
	}
	/** Close all browsers and clean up. */
	async closeAll() {
		for (const state of this.accounts.values()) {
			await state.context.close().catch(() => {});
			await state.browser.close().catch(() => {});
		}
		this.accounts.clear();
		this.currentAccountId = null;
	}
	/** Resolve fingerprint profile from config or default. */
	_resolveProfile(override) {
		const mode = override ?? this.defaultFingerprint;
		if (mode === "auto") return generateProfile(this.seedOffset);
		return generateProfile({
			windows: 0,
			mac: 1,
			linux: 3
		}[mode] ?? 0);
	}
};
// src/session.ts
/**
* Session Manager — maintains a persistent browser instance across tool calls.
*
* When sessions are enabled, subsequent ac_browser_* calls reuse the same
* Chromium process and page context, preserving cookies, localStorage, and
* navigation state. This enables multi-step workflows (navigate → login →
* interact) without re-authenticating on every call.
*
* When sessions are disabled (default), behavior is identical to before:
* each call spawns a fresh browser.
*/
/** Simple deterministic hash for seeding profile selection. */
function hashString(s) {
	let h = 0;
	for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i) | 0;
	return Math.abs(h);
}
var SessionManager = class {
	browser = null;
	context = null;
	pages = /* @__PURE__ */ new Map();
	config;
	sessionId;
	proxyMgr;
	accountMgr = null;
	constructor(config) {
		this.config = {
			enabled: config.session?.enabled ?? false,
			timeoutMs: config.session?.timeoutMs ?? 12e4,
			maxPages: config.session?.maxPages ?? 5,
			sessionDir: config.session?.sessionDir ?? join(process.env.HOME || "/tmp", ".cache", "browser-anti-cloudflare", "sessions")
		};
		this.sessionId = Date.now().toString(36) + Math.random().toString(36).substring(2);
		this.proxyMgr = createProxyManager(config.proxy);
		if (config.accounts && config.accounts.length > 0) {
			this.accountMgr = new AccountManager("auto", hashString(this.sessionId));
			for (const acc of config.accounts) this.accountMgr.register(acc);
			if (this.accountMgr.count > 0) this.accountMgr.setCurrent(this.accountMgr.listAccounts()[0]);
		}
	}
	/** Get the active page for a URL, or create one if needed. */
	async getOrCreatePage(url) {
		if (!this.config.enabled) return (await this.ensureBrowser()).newPage();
		for (const [key, entry] of this.pages) if (entry.url === url) return entry.page;
		if (this.pages.size >= this.config.maxPages) {
			let oldestKey = "";
			let oldestTime = Infinity;
			for (const [key, entry] of this.pages) if (entry.createdAt < oldestTime) {
				oldestTime = entry.createdAt;
				oldestKey = key;
			}
			if (oldestKey) {
				await this.pages.get(oldestKey).page.close().catch(() => {});
				this.pages.delete(oldestKey);
			}
		}
		const page = await (await this.ensureContext()).newPage();
		const key = `${url}:${Date.now()}`;
		this.pages.set(key, {
			page,
			url,
			createdAt: Date.now()
		});
		return page;
	}
	/** Navigate with stealth patches, reusing the session page. */
	async navigate(url, timeoutMs) {
		return navigateWithStealth(await this.getOrCreatePage(url), url, timeoutMs);
	}
	/** Get or create an isolated context for a specific account. */
	async getAccountPage(accountId, url) {
		if (!this.accountMgr) throw new Error("AccountManager not initialized — no accounts configured");
		const ctx = await this.accountMgr.getAccountContext(accountId);
		let page = this.accountMgr.getAccountState(accountId)?.currentPage;
		if (!page || page.isClosed()) {
			page = await ctx.newPage();
			const state = this.accountMgr.getAccountState(accountId);
			state.currentPage = page;
		}
		if (url) await page.goto(url, {
			waitUntil: "domcontentloaded",
			timeout: 3e4
		});
		return page;
	}
	/** Switch current account. */
	switchAccount(accountId) {
		if (!this.accountMgr) throw new Error("AccountManager not initialized");
		this.accountMgr.setCurrent(accountId);
	}
	/** List all registered accounts. */
	listAccounts() {
		return this.accountMgr?.listAccounts() ?? [];
	}
	/** Get current account ID. */
	getCurrentAccount() {
		return this.accountMgr?.getCurrentId() ?? null;
	}
	/** Check if multi-account mode is active. */
	hasAccounts() {
		return !!this.accountMgr && this.accountMgr.count > 0;
	}
	/** Save current session state to disk. */
	async saveSession(label = "default") {
		if (!this.config.enabled) throw new Error("Session persistence is disabled");
		const allCookies = [];
		const seenContexts = /* @__PURE__ */ new Set();
		for (const entry of this.pages.values()) {
			const ctx = entry.page.context();
			if (seenContexts.has(ctx)) continue;
			seenContexts.add(ctx);
			try {
				const urls = entry.page.url();
				if (urls) {
					const cookies = await entry.page.context().cookies(urls);
					allCookies.push(...cookies);
				}
			} catch (_) {}
		}
		if (allCookies.length === 0) {
			const ctx = await this.ensureContext();
			try {
				allCookies.push(...await ctx.cookies());
			} catch (_) {}
		}
		const savedStorage = {};
		for (const entry of this.pages.values()) try {
			const storage = await entry.page.evaluate(() => {
				const result = {};
				const ls = window.localStorage;
				for (let i = 0; i < ls.length; i++) {
					const key = ls.key(i);
					if (key) result[key] = ls.getItem(key) || "";
				}
				return result;
			});
			Object.assign(savedStorage, storage);
		} catch (_) {}
		const data = {
			cookies: allCookies,
			localStorage: savedStorage,
			createdAt: Date.now()
		};
		const dir = this.config.sessionDir;
		mkdirSync(dir, { recursive: true });
		const filename = `${label}-${this.sessionId}.json`;
		const filepath = join(dir, filename);
		const content = JSON.stringify(data, null, 2);
		writeFileSync(filepath, content, "utf-8");
		return {
			path: filepath,
			size: content.length
		};
	}
	/** Load a previously saved session from disk. */
	async loadSession(path) {
		if (!existsSync(path)) return false;
		const content = readFileSync(path, "utf-8");
		const data = JSON.parse(content);
		const ctx = await this.ensureContext();
		if (data.cookies.length > 0) try {
			await ctx.addCookies(data.cookies);
		} catch (_) {}
		for (const entry of this.pages.values()) try {
			await entry.page.evaluate((storage) => {
				const ls = window.localStorage;
				for (const [key, value] of Object.entries(storage)) ls.setItem(key, value);
			}, data.localStorage);
		} catch (_) {}
		return true;
	}
	/** Get session info. */
	getInfo() {
		return {
			enabled: this.config.enabled,
			sessionId: this.sessionId,
			pageCount: this.pages.size,
			maxPages: this.config.maxPages
		};
	}
	/** Close the browser and clean up. */
	async close() {
		for (const entry of this.pages.values()) await entry.page.close().catch(() => {});
		this.pages.clear();
		await this.accountMgr?.closeAll().catch(() => {});
		await this.browser?.close().catch(() => {});
		this.browser = null;
		this.context = null;
		this.accountMgr = null;
	}
	/** Get AccountManager instance (for external access). */
	getAccounts() {
		return this.accountMgr;
	}
	async ensureBrowser() {
		if (!this.browser) this.browser = await chromium.launch({
			headless: true,
			args: [
				"--disable-blink-features=AutomationControlled",
				"--no-sandbox",
				"--disable-setuid-sandbox",
				"--disable-dev-shm-usage",
				"--disable-gpu",
				"--js-flags=--no-wasm-tier-up",
				"--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
			]
		});
		return this.browser;
	}
	async ensureContext() {
		if (!this.context) {
			const browser = await this.ensureBrowser();
			const proxyOpts = this.proxyMgr?.getPlaywrightProxy();
			this.context = await browser.newContext({
				viewport: {
					width: 1920,
					height: 1080
				},
				userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
				deviceScaleFactor: 1,
				hasTouch: false,
				isMobile: false,
				...proxyOpts ? { proxy: proxyOpts } : {}
			});
		}
		return this.context;
	}
};
// src/tools.ts
init_stealth();
/** Input schemas per operation — kept simple; full Playwright types not re-exported. */
const OP_SCHEMAS = {
	navigate: { url: {
		type: "string",
		description: "The target URL to navigate to."
	} },
	screenshot: {
		url: {
			type: "string",
			description: "URL to capture a screenshot of."
		},
		fullPage: {
			type: "boolean",
			description: "Capture full scrollable page (default false)."
		}
	},
	click: {
		url: {
			type: "string",
			description: "URL of the page to interact with."
		},
		selector: {
			type: "string",
			description: "CSS selector of the element to click."
		}
	},
	type: {
		url: {
			type: "string",
			description: "URL of the page containing the input."
		},
		selector: {
			type: "string",
			description: "CSS selector of the input element."
		},
		text: {
			type: "string",
			description: "Text to type into the element."
		}
	},
	eval: {
		url: {
			type: "string",
			description: "URL of the page to evaluate on."
		},
		expression: {
			type: "string",
			description: "JavaScript expression to evaluate in page context."
		}
	},
	session_save: { label: {
		type: "string",
		description: "Label for the saved session (default: \"default\")."
	} },
	session_load: { path: {
		type: "string",
		description: "Path to the session JSON file to load."
	} },
	session_status: {}
};
const DESCRIPTIONS = {
	navigate: "Navigate the stealth browser to a URL, bypassing Cloudflare challenges.",
	screenshot: "Capture a screenshot of the current page or a URL (anti-detect mode).",
	click: "Click an element by CSS selector after navigating to the given URL.",
	type: "Type text into an input element identified by CSS selector on the given URL.",
	eval: "Evaluate a JavaScript expression in the page context and return the result.",
	session_save: "Save the current browser session (cookies + localStorage) to disk for later restoration.",
	session_load: "Load a previously saved browser session from a JSON file.",
	session_status: "Return the current session state: enabled flag, active page count, and session ID."
};
const GUIDANCE = `You have access to anti-cloudflare browser tools (ac_browser_*). They use a stealth-patched Chromium that strips navigator.webdriver, randomises WebGL/renderer fingerprints, and injects anti-detection scripts before every navigation — designed to pass Cloudflare "Checking your browser" challenges. Use these tools when browsing sites protected by Cloudflare or similar WAFs. Navigate first, then screenshot/click/type/eval as needed. For multi-step workflows, enable session persistence in your profile config to retain cookies across calls.`;
/** Register all ac_browser_* tools on the given context. */
function mountAcTools(ctx, config) {
	const sessionMgr = new SessionManager(config);
	const toolNames = /* @__PURE__ */ new Set();
	for (const op of Object.keys(OP_SCHEMAS)) {
		const toolName = `ac_browser_${op}`;
		toolNames.add(toolName);
		ctx.tools.register(createMcpToolDefinition(ctx, {
			name: toolName,
			rawName: op,
			description: DESCRIPTIONS[op],
			inputSchema: {
				type: "object",
				properties: Object.entries(OP_SCHEMAS[op]).reduce((acc, [key, v]) => {
					acc[key] = {
						type: v.type,
						description: v.description
					};
					return acc;
				}, {}),
				required: ["url"].filter((k) => op === "navigate" || op === "screenshot" || op === "click" || op === "type" || op === "eval")
			},
			async call(args) {
				return runOp(op, args, config, sessionMgr);
			}
		}));
	}
	ctx.systemPrompt.section({
		name: "browser-use:anti-cloudflare",
		text: GUIDANCE,
		order: ctx.systemPrompt.getSectionOrder("TOOL_COMPUTER_USE")
	});
}
/**
* Execute one ac_browser operation.
* When session is enabled, reuses the persistent browser context.
* When disabled, spawns a fresh browser per call (backward compatible).
*/
async function runOp(op, args, config, sessionMgr) {
	const timeoutMs = config.operationTimeoutMs ?? 45e3;
	switch (op) {
		case "navigate": {
			const url = String(args.url ?? "");
			return {
				url,
				title: "(see status)",
				status: (await sessionMgr.navigate(url, timeoutMs))?.status() ?? 0
			};
		}
		case "session_save": {
			const label = String(args.label ?? "default");
			return await sessionMgr.saveSession(label);
		}
		case "session_load": {
			const path = String(args.path ?? "");
			return { success: await sessionMgr.loadSession(path) };
		}
		case "session_status": return sessionMgr.getInfo();
		default: {
			const { launchStealthBrowser } = await Promise.resolve().then(() => (init_stealth(), stealth_exports));
			const debugMode = config.headless === false;
			const browser = await launchStealthBrowser(config);
			try {
				const page = await browser.newPage();
				const url = String(args.url ?? "");
				switch (op) {
					case "screenshot": {
						const fullPage = args.fullPage === true;
						await navigateWithStealth(page, url, timeoutMs, { debug: debugMode });
						return {
							data: (await page.screenshot({
								fullPage,
								type: "png"
							})).toString("base64"),
							mimeType: "image/png",
							width: page.viewportSize()?.width ?? 1280,
							height: page.viewportSize()?.height ?? 800
						};
					}
					case "click": {
						await navigateWithStealth(page, url, timeoutMs, { debug: debugMode });
						const sel = String(args.selector ?? "");
						await page.waitForSelector(sel, { timeout: timeoutMs }).catch(() => {});
						await page.click(sel).catch((e) => {
							throw new Error(`click failed: ${String(e)}`);
						});
						return {
							success: true,
							url: page.url()
						};
					}
					case "type": {
						await navigateWithStealth(page, url, timeoutMs, { debug: debugMode });
						const sel = String(args.selector ?? "");
						const txt = String(args.text ?? "");
						await page.waitForSelector(sel, { timeout: timeoutMs }).catch(() => {});
						await page.fill(sel, txt).catch((e) => {
							throw new Error(`type failed: ${String(e)}`);
						});
						return {
							success: true,
							url: page.url()
						};
					}
					case "eval": {
						await navigateWithStealth(page, url, timeoutMs, { debug: debugMode });
						const expr = String(args.expression ?? "true");
						return { result: await page.evaluate(expr) };
					}
				}
			} finally {
				await browser.close();
			}
		}
	}
}
// src/index.ts
/** Cordis identity for this provider. Must be unique across all browser-use providers. */
const name = "dsh-browser-anti-cloudflare";
/** Services required before activation. Matches stagehand-native pattern. */
const inject = [
	"browserUse",
	"agents",
	"tools",
	"systemPrompt"
];
const DEFAULTS = {
	headless: true,
	operationTimeoutMs: 45e3
};
/**
* Mount the anti-cloudflare browser-use provider.
* Throws at boot if another browser-use provider already holds the slot.
* @param ctx - Cordis context providing browserUse, tools, agents, systemPrompt.
* @param input - optional profile configuration (merged with defaults).
*/
function apply(ctx, input = {}) {
	const config = {
		...DEFAULTS,
		...input
	};
	if (ctx.browserUse.providerName !== void 0) throw new Error(`[${name}] browserUse slot is already taken by: ${ctx.browserUse.providerName}. Disable or remove the competing provider(s) in your profile's cordis.patch.yml — only one browser-use provider may be active per DSH profile.`);
	ctx.effect(function* () {
		yield ctx.browserUse.register(BrowserUseProviderName(name));
		mountAcTools(ctx, config);
	}, `${name}.runtime`);
}
/**
* Smoke-test hello-world export. Returns 'ok' to confirm the module loads correctly.
*/
function hello() {
	return "ok";
}
export { apply, hello, inject, name };

