import type { BrowserContext, Page } from 'playwright'

/** Enforce a per-context LRU page ceiling, including popups opened by a page. */
export function enforcePageLimit(context: BrowserContext, maxPages: number): void {
  if (!Number.isInteger(maxPages) || maxPages < 1) throw new Error('session.maxPages must be a positive integer')
  const lastUsed = new Map<Page, number>()
  const track = (page: Page): void => {
    if (lastUsed.has(page)) { lastUsed.set(page, Date.now()); return }
    lastUsed.set(page, Date.now())
    page.on('request', () => lastUsed.set(page, Date.now()))
    page.on('framenavigated', () => lastUsed.set(page, Date.now()))
    page.on('close', () => lastUsed.delete(page))
    if (lastUsed.size > maxPages) {
      const oldest = [...lastUsed.entries()].sort((a, b) => a[1] - b[1])[0]?.[0]
      if (oldest && oldest !== page) void oldest.close().catch(() => {})
      else if (oldest) void page.close().catch(() => {})
    }
  }
  context.on('page', track)
  for (const page of context.pages()) track(page)
}
