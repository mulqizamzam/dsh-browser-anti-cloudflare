/**
 * WAF detector — identifies which bot-protection provider is behind a response.
 *
 * Detection is based on response headers, Set-Cookie patterns, and HTML body
 * signatures. Returns a WafType string ('cloudflare' | 'akamai' | 'imperva' |
 * 'fastly' | 'unknown') so the caller can select the appropriate patches.
 *
 * Detection is best-effort; unknown responses fall back to baseline-only patches.
 */

export type WafType = 'cloudflare' | 'akamai' | 'imperva' | 'fastly' | 'unknown'

interface WafDetectionInput {
  /** Response status code */
  status: number
  /** Response headers (lowercase keys) */
  headers: Record<string, string>
  /** Response body (first 10KB for signature matching) */
  body: string
}

/**
 * Detect which WAF is protecting the target URL.
 * Returns 'unknown' if no known WAF signature is found.
 */
export function detectWAF(input: WafDetectionInput): WafType {
  const { headers, body } = input

  // --- Akamai signatures -----------------------------------------------------
  if (
    headers['set-cookie']?.includes('ak_bkmk') ||
    headers['set-cookie']?.includes('ak_bdom') ||
    headers['x-ccache'] === ' HIT' ||
    headers['x-hb'] !== undefined ||
    /__akam/.test(body) ||
    /akamai/i.test(headers['server'] ?? '')
  ) {
    return 'akamai'
  }

  // --- Imperva / Incapsula signatures ---------------------------------------
  if (
    headers['x-incap-info'] !== undefined ||
    headers['x-cdn'] === 'Incapsula' ||
    headers['set-cookie']?.includes('__Impcookie') ||
    headers['server']?.includes('incapsula') ||
    /jschl|jsddos|hig_check|hcaptcha/i.test(body)
  ) {
    return 'imperva'
  }

  // --- Fastly signatures ----------------------------------------------------
  if (
    headers['x-cache'] === 'HIT' ||
    headers['x-cache'] === 'MISS' ||
    headers['x-served-by']?.startsWith('cache-') ||
    headers['server']?.includes('Fastly') ||
    /fastly/gi.test(body)
  ) {
    return 'fastly'
  }

  // --- Cloudflare signatures (existing detection, kept for backward compat) --
  if (
    headers['set-cookie']?.includes('__cfduid') ||
    headers['cf-ray'] !== undefined ||
    headers['server']?.includes('cloudflare') ||
    /checking your browser|i-am-human|cf-browser-verification/i.test(body) ||
    /__cf_chl/i.test(body)
  ) {
    return 'cloudflare'
  }

  return 'unknown'
}

/**
 * Get the patch builder function for a detected WAF type.
 * Returns baseline-only script when WAF is unknown.
 */
import { buildBaselineScript } from './baseline.js'
import { buildAkamaiPatches } from './akamai.js'
import { buildImpervaPatches } from './imperva.js'
import { buildFastlyPatches } from './fastly.js'

export function buildCombinedScript(wafType: WafType): string {
  const baseline = buildBaselineScript()
  switch (wafType) {
    case 'akamai':
      return baseline + '\n' + buildAkamaiPatches()
    case 'imperva':
      return baseline + '\n' + buildImpervaPatches()
    case 'fastly':
      return baseline + '\n' + buildFastlyPatches()
    case 'cloudflare':
    case 'unknown':
    default:
      return baseline
  }
}
