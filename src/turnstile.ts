/** Passive Turnstile detection only. A valid response token must come from the official widget flow. */
export function buildTurnstileBypassScript(): string { return '' }
export function hasTurnstile(html: string): boolean {
  return /cf-turnstile|data-cf-widget|turnstile\.com|g-recaptcha|recaptcha\/api/i.test(html)
}
