import { describe, it, expect } from 'vitest'
import { generateProfile, buildFingerprintScript, validateProfile, generateBatch } from '../src/fingerprint.js'
describe('fingerprint profile metadata', () => {
  it('generates internally valid diagnostic profiles', () => {
    const profile = generateProfile(0)
    expect(validateProfile(profile)).toBe(true)
    expect(generateBatch(5)).toHaveLength(5)
  })
  it('does not inject fingerprint spoofing into browser pages', () => {
    expect(buildFingerprintScript(generateProfile(0))).toBe('')
  })
})
