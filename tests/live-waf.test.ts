import { describe, it, expect } from 'vitest'
import { detectWAF } from '../src/waf/detector.js'
describe('passive WAF signal fixtures', () => {
  it('classifies Cloudflare response metadata without attempting a bypass', () => {
    expect(detectWAF({ status: 403, headers: { 'cf-ray': 'fixture', server: 'cloudflare' }, body: '<title>Attention Required</title>' })).toBe('cloudflare')
  })
  it('does not infer a WAF from an ordinary response', () => {
    expect(detectWAF({ status: 200, headers: { 'content-type': 'application/json' }, body: '{"ok":true}' })).toBe('unknown')
  })
})
