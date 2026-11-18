/**
 * Baseline anti-detection script — shared across all WAF types.
 * This is the universal stealth layer that runs on every navigation regardless
 * of which WAF (if any) is detected behind it.
 *
 * Now uses fingerprint-randomizer for coherent per-session profiles.
 */

import { generateProfile, buildFingerprintScript } from '../fingerprint.js'

let _cachedProfile: ReturnType<typeof generateProfile> | null = null

/** Get or create a cached fingerprint profile for this module instance. */
function getProfile(): ReturnType<typeof generateProfile> {
  if (!_cachedProfile) {
    _cachedProfile = generateProfile()
  }
  return _cachedProfile
}

export function buildBaselineScript(): string {
  const profile = getProfile()
  return buildFingerprintScript(profile)
}
