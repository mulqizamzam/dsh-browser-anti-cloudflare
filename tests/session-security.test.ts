import { describe, it, expect } from 'vitest'
import { SessionManager } from '../src/session.js'
import { mkdtemp, rm, readdir, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

describe('encrypted session persistence', () => {
  it('requires a strong encryption key', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'browser-session-'))
    const manager = new SessionManager({ session: { enabled: true, sessionDir: dir } })
    try { await expect(manager.saveSession()).rejects.toThrow(/encryptionKey/) }
    finally { await manager.close(); await rm(dir, { recursive: true, force: true }) }
  })
  it('rejects unsafe labels before writing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'browser-session-'))
    const manager = new SessionManager({ session: { enabled: true, sessionDir: dir, encryptionKey: 's'.repeat(40) } })
    try {
      await expect(manager.saveSession('../escape')).rejects.toThrow(/label/)
      expect(await readdir(dir)).toEqual([])
    } finally { await manager.close(); await rm(dir, { recursive: true, force: true }) }
  })
  it('writes authenticated ciphertext and restores it', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'browser-session-'))
    const manager = new SessionManager({ headless: true, session: { enabled: true, sessionDir: dir, encryptionKey: 'k'.repeat(40) } })
    try {
      const saved = await manager.saveSession('test')
      const encrypted = await readFile(saved.path, 'utf8')
      expect(encrypted.startsWith('BAS1:')).toBe(true)
      expect(encrypted).not.toContain('"cookies"')
      await expect(manager.loadSession(saved.path)).resolves.toBe(true)
      await expect(manager.loadSession('/etc/passwd')).rejects.toThrow()
    } finally { await manager.close(); await rm(dir, { recursive: true, force: true }) }
  }, 30000)
})
