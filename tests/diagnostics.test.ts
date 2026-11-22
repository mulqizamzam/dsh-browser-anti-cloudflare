import { describe, it, expect } from 'vitest'
import { DiagnosticRecorder } from '../src/diagnostics.js'

describe('diagnostic recorder', () => {
  it('keeps a bounded event history and summarizes counts', () => {
    const diagnostics = new DiagnosticRecorder({ maxEvents: 2 })
    diagnostics.record('tool.completed', 'info', { operation: 'navigate' }, 12)
    diagnostics.record('tool.failed', 'error', { operation: 'click', errorType: 'TimeoutError' }, 40)
    diagnostics.record('waf.observed', 'warn', { classification: 'cloudflare', status: 403 })
    const snapshot = diagnostics.snapshot()
    expect(snapshot.eventCount).toBe(2)
    expect(snapshot.errorCount).toBe(1)
    expect(snapshot.byEvent).toEqual({ 'tool.failed': 1, 'waf.observed': 1 })
    expect(snapshot.events[0].event).toBe('tool.failed')
  })

  it('drops sensitive or unknown attributes', () => {
    const diagnostics = new DiagnosticRecorder()
    diagnostics.record('tool.completed', 'info', {
      operation: 'navigate',
      url: 'https://private.example/path',
      token: 'secret-token',
      selector: '#password',
      errorType: 'TimeoutError',
    })
    expect(diagnostics.snapshot().events[0].attributes).toEqual({
      operation: 'navigate',
      errorType: 'TimeoutError',
    })
  })

  it('can be disabled and validates the event ceiling', () => {
    const disabled = new DiagnosticRecorder({ enabled: false })
    disabled.record('tool.completed')
    expect(disabled.snapshot()).toMatchObject({ enabled: false, eventCount: 0 })
    expect(() => new DiagnosticRecorder({ maxEvents: 1001 })).toThrow(/maxEvents/)
  })
})
