/**
 * Fingerprint randomizer tests — verify profile generation and consistency.
 */
import { describe, it, expect } from 'vitest'
import {
  generateProfile,
  buildFingerprintScript,
  validateProfile,
  generateBatch,
} from '../src/fingerprint.js'

describe('fingerprint-randomizer: profile generation', () => {
  it('generates a valid profile', () => {
    const p = generateProfile()
    expect(p).toBeDefined()
    expect(p.webdriver).toBeUndefined()
    expect(p.sharedArrayBuffer).toBeUndefined()
    expect(p.plugins).toBeGreaterThan(0)
    expect(p.hardwareConcurrency).toBeGreaterThanOrEqual(2)
    expect(p.hardwareConcurrency).toBeLessThanOrEqual(32)
    expect(p.languages).toContain('en')
    expect(p.webglVendor).toContain('Google Inc.')
    expect(p.webglRenderer).toContain('ANGLE')
  })

  it('generates different profiles with different seeds', () => {
    const p1 = generateProfile(0)
    const p2 = generateProfile(1)
    // Different seeds should produce different user agents or screen sizes
    const same = p1.userAgent === p2.userAgent && p1.screenWidth === p2.screenWidth
    expect(same).toBe(false) // at least one should differ
  })

  it('all generated profiles pass validation', () => {
    for (let i = 0; i < 20; i++) {
      const p = generateProfile(i)
      expect(validateProfile(p)).toBe(true)
    }
  })

  it('generateBatch produces consistent profiles', () => {
    const batch = generateBatch(10)
    expect(batch).toHaveLength(10)
    for (const p of batch) {
      expect(validateProfile(p)).toBe(true)
    }
  })

  it('profiles have coherent WebGL + platform pairing', () => {
    const windows = generateProfile(0)
    const mac = generateProfile(1)

    expect(windows.platform).toBe('windows')
    expect(windows.webglRenderer).toContain('Intel')

    expect(mac.platform).toBe('mac')
    expect(mac.webglRenderer).toContain('Apple')
  })
})

describe('fingerprint-randomizer: script output', () => {
  it('buildFingerprintScript produces valid JS', () => {
    const p = generateProfile()
    const script = buildFingerprintScript(p)
    expect(script).toContain('navigator.webdriver')
    expect(script).toContain('SharedArrayBuffer')
    expect(script).toContain('chrome')
    expect(script).toContain('WebGLRenderingContext')
    expect(script).toContain('hardwareConcurrency')
  })

  it('script contains correct profile values', () => {
    const p = generateProfile(0)
    const script = buildFingerprintScript(p)
    expect(script).toContain(String(p.hardwareConcurrency))
    expect(script).toContain(String(p.screenWidth))
    expect(script).toContain(p.webglRenderer)
    expect(script).toContain('webdriver')
  })
})
