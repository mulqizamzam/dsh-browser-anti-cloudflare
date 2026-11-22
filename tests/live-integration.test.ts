import { describe, it, expect } from 'vitest'
import { detectWAF, buildCombinedScript } from '../src/waf/detector.js'
describe('passive WAF classification', () => {
  it('detects Cloudflare from response headers', () => {
    expect(detectWAF({ status: 403, headers: { 'cf-ray': 'abc', server: 'cloudflare' }, body: '' })).toBe('cloudflare')
  })
  it('detects Akamai and Imperva from provider signals', () => {
    expect(detectWAF({ status: 403, headers: { 'akamai-grn': 'abc' }, body: '' })).toBe('akamai')
    expect(detectWAF({ status: 403, headers: { 'x-iinfo': 'abc' }, body: '' })).toBe('imperva')
  })
  it('does not inject challenge bypass or fingerprint scripts', () => {
    expect(buildCombinedScript('cloudflare')).toBe('')
    expect(buildCombinedScript('unknown')).toBe('')
  })
  it('returns unknown when no reliable signature exists', () => {
    expect(detectWAF({ status: 200, headers: { 'content-type': 'text/html' }, body: '<h1>ok</h1>' })).toBe('unknown')
  })
})
