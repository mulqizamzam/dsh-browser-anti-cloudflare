import { describe, it, expect } from 'vitest'
import { assertSafeUrl, validateSelector, validateTextInput } from '../src/security.js'

describe('browser input security', () => {
  it('accepts public HTTP(S) URL', async () => {
    await expect(assertSafeUrl('https://example.com')).resolves.toBeInstanceOf(URL)
  })
  it.each(['file:///etc/passwd','javascript:alert(1)','http://localhost','http://127.0.0.1','http://169.254.169.254','http://192.168.1.1','http://[::1]'])('blocks unsafe URL %s', async url => {
    await expect(assertSafeUrl(url)).rejects.toThrow()
  })
  it('rejects URL credentials', async () => {
    await expect(assertSafeUrl('https://user:pass@example.com')).rejects.toThrow(/credentials/)
  })
  it('validates selectors and text lengths', () => {
    expect(() => validateSelector('  ')).toThrow()
    expect(() => validateSelector('a'.repeat(2049))).toThrow()
    expect(() => validateTextInput('x'.repeat(10001))).toThrow()
  })
})
