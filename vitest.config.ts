import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    pool: 'threads',
    // playwright ships its own chromium; no browser env needed
    poolOptions: { threads: { singleThread: true } },
  },
})
