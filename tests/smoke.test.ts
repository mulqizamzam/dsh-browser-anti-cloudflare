/**
 * Smoke test for the get-fable e2e lifecycle demonstration.
 * Verifies that the hello() export works and the module loads without errors.
 */
import { describe, it, expect } from 'vitest'
import { hello } from '../src/index.js'

describe('hello smoke', () => {
  it("returns 'ok'", () => {
    expect(hello()).toBe('ok')
  })

  it('is a string', () => {
    const result = hello()
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })
})
