# Browser Automation Provider

A Playwright browser-use provider for authorized automation. Features include public-web navigation, screenshots, form interaction, passive WAF classification, account-isolated contexts, and encrypted session persistence.

**This package does not bypass Cloudflare, CAPTCHA, Turnstile, or other access controls.** Use the site's approved verification flow or authorized API.

## Install

Install from GitHub into a DSH profile:

```bash
dsh plugin --profile <name> add "github:mulqizamzam/dsh-browser-anti-cloudflare#main"
```

The package claims the exclusive browserUse provider slot. Disable competing browser-use providers before loading it. See [docs/INSTALL.md](docs/INSTALL.md) for local installation and configuration details.

## Security defaults
- Only HTTP(S) URLs are accepted.
- Loopback, private, link-local, reserved, and internal hostnames/IPs are blocked. DNS answers and subresource/redirect requests are checked.
- `allowPrivateNetworks` defaults to `false`; enable only in isolated local tests with trusted inputs.
- `ac_browser_eval` is disabled unless `allowUnsafeEval: true` is explicitly configured.
- The same in-memory browser context is reused across tool calls. Disk session persistence requires `session.encryptionKey` (at least 32 characters); files use AES-256-GCM and restrictive permissions.
- Session export/import is disabled with account isolation until per-account encrypted restore is implemented.
- Supply proxy credentials through secrets, not embedded URLs.

## Tools
| Tool | Purpose |
|---|---|
| `ac_browser_navigate` | Navigate to an authorized public HTTP(S) page and report passive WAF signals. |
| `ac_browser_screenshot` | Capture PNG screenshot. |
| `ac_browser_click` | Click a CSS selector. |
| `ac_browser_type` | Fill a CSS selector. |
| `ac_browser_eval` | Explicitly opt-in trusted page JavaScript. |
| `ac_browser_session_save` | Save encrypted storage state. |
| `ac_browser_session_load` | Restore encrypted storage state. |
| `ac_browser_session_status` | Report session status. |

## WAF detection
WAF detection is passive and informational. It inspects response headers and page content for known provider signals. It does not modify browser identity, forge challenge tokens, or alter access-control flows. A classification is best-effort, not proof that access is permitted.

## Development
Run `pnpm install`, `pnpm run typecheck`, `pnpm run build`, `pnpm run test`, and `pnpm run test:integration`.
Local tests that bind loopback explicitly pass `allowPrivateNetworks: true`. Never enable this for untrusted or production inputs.

## Limitations
- Browser URL checks reduce SSRF risk but do not replace DNS pinning, container isolation, or restrictive outbound firewall rules.
- WebRTC, extensions, and platform networking may need additional egress restrictions in high-assurance deployments.
- Account-specific session export/import is not enabled.
