/** Passive WAF/challenge classification. Detection never modifies page behavior. */
export type WafType = 'cloudflare' | 'akamai' | 'imperva' | 'fastly' | 'unknown'
export interface WafDetectionInput { status: number; headers: Record<string, string>; body: string }
export function detectWAF(input: WafDetectionInput): WafType {
  const h = Object.fromEntries(Object.entries(input.headers).map(([k,v]) => [k.toLowerCase(), String(v).toLowerCase()]))
  const body = input.body.slice(0, 20000).toLowerCase()
  if (h['cf-ray'] || h.server?.includes('cloudflare') || h['set-cookie']?.includes('__cf') || /cf-chl-|challenge-platform|checking your browser/.test(body)) return 'cloudflare'
  if (h['x-iinfo'] || h['x-incap-info'] || h['x-cdn']?.includes('imperva') || h.server?.includes('incapsula') || h['set-cookie']?.includes('incap_ses') || /incapsula|imperva/.test(body)) return 'imperva'
  if (h['x-akamai-transformed'] || h['akamai-grn'] || h['set-cookie']?.includes('ak_bmsc') || h.server?.includes('akama')) return 'akamai'
  if (h['x-served-by']?.includes('cache-') || h['via']?.includes('varnish') || h.server?.includes('fastly')) return 'fastly'
  return 'unknown'
}
export function buildCombinedScript(_wafType: WafType): string {
  // Deliberately no fingerprint spoofing or WAF-specific challenge manipulation.
  return ''
}
