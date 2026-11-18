/**
 * Fingerprint Randomizer — generates coherent, realistic browser fingerprints
 * per session based on device/locale profile.
 *
 * Each profile ensures internal consistency: WebGL vendor matches platform,
 * screen resolution matches typical devices, hardware concurrency is realistic,
 * etc. This prevents statistical anomalies that sophisticated WAFs can detect.
 */

export type PlatformType = 'windows' | 'mac' | 'linux'
export type BrowserType = 'chrome' | 'firefox' | 'edge'

export interface FingerprintProfile {
  platform: PlatformType
  browser: BrowserType
  userAgent: string
  webdriver: undefined
  plugins: number
  languages: string[]
  hardwareConcurrency: number
  deviceMemory?: number
  platformStr: string
  screenWidth: number
  screenHeight: number
  availWidth: number
  availHeight: number
  webglVendor: string
  webglRenderer: string
  chromeRuntime: boolean
  sharedArrayBuffer: undefined
}

/** Predefined realistic profiles. */
const PROFILES: Record<string, Omit<FingerprintProfile, 'webglVendor' | 'webglRenderer' | 'webdriver' | 'sharedArrayBuffer'>> = {
  'windows-chrome': {
    platform: 'windows',
    browser: 'chrome',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    plugins: 3,
    languages: ['en-US', 'en'],
    hardwareConcurrency: 8,
    deviceMemory: 8,
    platformStr: 'Win32',
    screenWidth: 1920,
    screenHeight: 1080,
    availWidth: 1920,
    availHeight: 980,
    chromeRuntime: true,
  },
  'mac-chrome': {
    platform: 'mac',
    browser: 'chrome',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    plugins: 3,
    languages: ['en-US', 'en'],
    hardwareConcurrency: 10,
    deviceMemory: 16,
    platformStr: 'MacIntel',
    screenWidth: 2880,
    screenHeight: 1800,
    availWidth: 2880,
    availHeight: 1740,
    chromeRuntime: true,
  },
  'mac-safari': {
    platform: 'mac',
    browser: 'chrome', // Safari uses same UA pattern for stealth
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
    plugins: 1,
    languages: ['en-US', 'en'],
    hardwareConcurrency: 10,
    deviceMemory: 16,
    platformStr: 'MacIntel',
    screenWidth: 2880,
    screenHeight: 1800,
    availWidth: 2880,
    availHeight: 1740,
    chromeRuntime: true,
  },
  'linux-chrome': {
    platform: 'linux',
    browser: 'chrome',
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    plugins: 2,
    languages: ['en-US', 'en'],
    hardwareConcurrency: 4,
    deviceMemory: 4,
    platformStr: 'Linux x86_64',
    screenWidth: 1920,
    screenHeight: 1080,
    availWidth: 1920,
    availHeight: 1040,
    chromeRuntime: true,
  },
  'windows-edge': {
    platform: 'windows',
    browser: 'edge',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
    plugins: 3,
    languages: ['en-US', 'en'],
    hardwareConcurrency: 12,
    deviceMemory: 16,
    platformStr: 'Win32',
    screenWidth: 1920,
    screenHeight: 1080,
    availWidth: 1920,
    availHeight: 980,
    chromeRuntime: true,
  },
}

const WEBGL_PROFILES: Record<string, { vendor: string; renderer: string }> = {
  windows: { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 630, OpenGL 4.6)' },
  mac: { vendor: 'Google Inc. (Apple)', renderer: 'ANGLE (Apple, Apple M1 Pro, OpenGL 4.1)' },
  linux: { vendor: 'Google Inc. ( Mesa )', renderer: 'ANGLE (Mesa, llvmpipe, LLVM 18.1.  OpenGL 4.5)' },
}

export function generateProfile(seed?: number): FingerprintProfile {
  const keys = Object.keys(PROFILES)
  const idx = seed !== undefined ? seed % keys.length : Math.floor(Math.random() * keys.length)
  const base = PROFILES[keys[idx]]
  const wg = WEBGL_PROFILES[base.platform]

  return {
    ...base,
    webdriver: undefined,
    sharedArrayBuffer: undefined,
    webglVendor: wg.vendor,
    webglRenderer: wg.renderer,
  }
}

export function buildFingerprintScript(profile: FingerprintProfile): string {
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
  ${profile.deviceMemory ? `Object.defineProperty(navigator, 'deviceMemory', { get: () => ${profile.deviceMemory} })` : ''}

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
  `
}

/** Validate that a profile is internally consistent. */
export function validateProfile(profile: FingerprintProfile): boolean {
  if (profile.webdriver !== undefined) return false
  if (profile.sharedArrayBuffer !== undefined) return false
  if (profile.plugins < 1 || profile.plugins > 10) return false
  if (profile.hardwareConcurrency < 2 || profile.hardwareConcurrency > 32) return false
  if (!profile.languages.includes('en')) return false
  if (!profile.webglRenderer.includes('Google Inc.')) return false
  return true
}

/** Generate N random profiles and validate them all. */
export function generateBatch(count: number, seedOffset?: number): FingerprintProfile[] {
  const results: FingerprintProfile[] = []
  for (let i = 0; i < count; i++) {
    const profile = generateProfile(seedOffset !== undefined ? seedOffset + i : undefined)
    if (!validateProfile(profile)) {
      throw new Error(`Invalid fingerprint profile generated at index ${i}`)
    }
    results.push(profile)
  }
  return results
}
