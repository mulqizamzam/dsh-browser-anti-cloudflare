import { describe, it, expect } from 'vitest'
import { SessionManager } from '../src/session.js'
import { mkdtemp, rm, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

describe('session persistence security', () => {
  it('requires encryption key and validates labels', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'browser-session-'))
    const manager = new SessionManager({ session: { enabled: true, sessionDir: dir } })
    await expect(manager.saveSession()).rejects.toThrow(/encryptionKey/)
    await manager.close()
    await rm(dir, { recursive: true, force: true })
  })
  it('does not create plaintext session files', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'browser-session-'))
    const manager = new SessionManager({ session: { enabled: true, sessionDir: dir, encryptionKey: 'a'.repeat(40) } })
    try {
      // No browser launch needed to verify invalid labels are rejected before state collection.
      await expect(manager.saveSession('../escape')).rejects.toThrow(/label/)
      expect(await readdir(dir)).toEqual([])
    } finally { await manager.close(); await rm(dir, { recursive: true, force: true }) }
  })
})
