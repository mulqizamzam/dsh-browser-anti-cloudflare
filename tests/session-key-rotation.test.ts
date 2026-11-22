import { describe, it, expect } from 'vitest'
import { SessionManager } from '../src/session.js'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

describe('session encryption key rotation', () => {
  it('decrypts a retained old key and writes with the active key ID', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'browser-key-rotation-'))
    const oldManager = new SessionManager({ headless: true, session: { enabled: true, sessionDir: dir, encryptionKey: 'o'.repeat(48) } })
    let oldPath = ''
    try { oldPath = (await oldManager.saveSession('before-rotation')).path } finally { await oldManager.close() }
    const rotated = new SessionManager({ headless: true, session: { enabled: true, sessionDir: dir, encryptionKey: 'o'.repeat(48), encryptionKeys: { old: 'o'.repeat(48), current: 'n'.repeat(48) }, activeEncryptionKeyId: 'current' } })
    try {
      await expect(rotated.loadSession(oldPath)).resolves.toBe(true)
      const fresh = await rotated.saveSession('after-rotation')
      expect(await readFile(fresh.path, 'utf8')).toMatch(/^BAS2:current:/)
    } finally { await rotated.close() }
    const retired = new SessionManager({ headless: true, session: { enabled: true, sessionDir: dir, encryptionKeys: { current: 'n'.repeat(48) }, activeEncryptionKeyId: 'current' } })
    try { await expect(retired.loadSession(oldPath)).rejects.toThrow(/key is unavailable/) }
    finally { await retired.close(); await rm(dir, { recursive: true, force: true }) }
  }, 60000)
})
