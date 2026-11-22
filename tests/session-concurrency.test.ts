import { describe, it, expect } from 'vitest'
import { SessionManager } from '../src/session.js'

describe('shared browser operation queue', () => {
  it('runs stateful operations one at a time in submission order', async () => {
    const manager = new SessionManager({ headless: true })
    const order: string[] = []
    try {
      const first = manager.runExclusive(async () => {
        order.push('first:start')
        await new Promise(resolve => setTimeout(resolve, 30))
        order.push('first:end')
        return 1
      })
      const second = manager.runExclusive(async () => {
        order.push('second:start')
        order.push('second:end')
        return 2
      })
      await expect(Promise.all([first, second])).resolves.toEqual([1, 2])
      expect(order).toEqual(['first:start', 'first:end', 'second:start', 'second:end'])
    } finally {
      await manager.close()
    }
  })

  it('rejects new work after the manager is closed', async () => {
    const manager = new SessionManager({ headless: true })
    await manager.close()
    await expect(manager.runExclusive(async () => 'unexpected')).rejects.toThrow(/closed/)
  })
})
