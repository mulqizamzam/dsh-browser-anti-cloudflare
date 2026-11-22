export type DiagnosticLevel = 'info' | 'warn' | 'error'
export type DiagnosticValue = string | number | boolean | null

export interface DiagnosticEvent {
  timestamp: string
  level: DiagnosticLevel
  event: string
  durationMs?: number
  attributes: Record<string, DiagnosticValue>
}

export interface DiagnosticsSnapshot {
  enabled: boolean
  eventCount: number
  errorCount: number
  byEvent: Record<string, number>
  events: DiagnosticEvent[]
}

/** Bounded in-memory diagnostics. Callers must pass only non-sensitive metadata. */
export class DiagnosticRecorder {
  private readonly events: DiagnosticEvent[] = []
  private readonly enabled: boolean
  private readonly maxEvents: number

  constructor(config: { enabled?: boolean; maxEvents?: number } = {}) {
    this.enabled = config.enabled ?? true
    this.maxEvents = config.maxEvents ?? 100
    if (!Number.isInteger(this.maxEvents) || this.maxEvents < 1 || this.maxEvents > 1000) {
      throw new Error('observability.maxEvents must be an integer between 1 and 1000')
    }
  }

  record(
    event: string,
    level: DiagnosticLevel = 'info',
    attributes: Record<string, DiagnosticValue> = {},
    durationMs?: number,
  ): void {
    if (!this.enabled) return
    const safeAttributes: Record<string, DiagnosticValue> = {}
    for (const [key, value] of Object.entries(attributes)) {
      if (!/^[a-zA-Z][a-zA-Z0-9_]{0,47}$/.test(key)) continue
      if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
        safeAttributes[key] = typeof value === 'string' ? value.slice(0, 120) : value
      }
    }
    this.events.push({
      timestamp: new Date().toISOString(),
      level,
      event: event.slice(0, 80),
      ...(Number.isFinite(durationMs) && durationMs! >= 0 ? { durationMs } : {}),
      attributes: safeAttributes,
    })
    if (this.events.length > this.maxEvents) this.events.splice(0, this.events.length - this.maxEvents)
  }

  snapshot(): DiagnosticsSnapshot {
    const byEvent: Record<string, number> = {}
    for (const event of this.events) byEvent[event.event] = (byEvent[event.event] ?? 0) + 1
    return {
      enabled: this.enabled,
      eventCount: this.events.length,
      errorCount: this.events.filter(event => event.level === 'error').length,
      byEvent,
      events: this.events.map(event => ({ ...event, attributes: { ...event.attributes } })),
    }
  }
}
