# Browser Automation Provider

A Playwright browser-use provider for authorized automation. Features include public-web navigation, screenshots, form interaction, passive WAF classification, account-isolated contexts, and encrypted session persistence.

**This package does not bypass Cloudflare, CAPTCHA, Turnstile, or other access controls.** Use the site's approved verification flow or authorized API.

## Install

Install from GitHub into a DSH profile:

    dsh plugin --profile <name> add "github:mulqizamzam/dsh-browser-anti-cloudflare#main"

The package claims the exclusive browserUse provider slot. Disable competing browser-use providers before loading it. See docs/INSTALL.md for local installation and configuration details.

## Security defaults
- Only HTTP(S) URLs are accepted.
- Loopback, private, link-local, reserved, and internal destinations are blocked. DNS answers are pinned for the process lifetime and answer drift is rejected.
- The production deployment example uses a shared network namespace, default-deny firewall, public TCP 80/443 allowlist, and a local DNS cache with a 60-second minimum TTL. See docker-compose.egress.yml.
- The application DNS guard is defense-in-depth; use the container egress policy for socket-level enforcement. Do not run an unrestricted browser container in production.
- allowPrivateNetworks defaults to false; enable only in isolated local tests with trusted inputs.
- ac_browser_eval is disabled unless allowUnsafeEval: true is explicitly configured.
- The same in-memory browser context is reused across tool calls. Disk session persistence requires session.encryptionKey (at least 32 characters); files use AES-256-GCM and restrictive permissions.
- Account sessions are encrypted and bound to the account ID. A saved session cannot be restored while another account is selected.
- session.timeoutMs closes browser contexts after tool inactivity; session.maxPages enforces a per-context LRU page ceiling.
- Supply proxy credentials through secrets, not embedded URLs.

## Tools
| Tool | Purpose |
|---|---|
| ac_browser_navigate | Navigate to an authorized public HTTP(S) page and report passive WAF signals. |
| ac_browser_screenshot | Capture PNG screenshot. |
| ac_browser_click | Click a CSS selector. |
| ac_browser_type | Fill a CSS selector. |
| ac_browser_eval | Explicitly opt-in trusted page JavaScript. |
| ac_browser_session_save | Save encrypted browser storage state for the current account. |
| ac_browser_session_load | Restore encrypted storage state only into the matching account. |
| ac_browser_session_status | Report browser session status, page count, and timeout configuration. |
| ac_browser_diagnostics | Report bounded in-memory diagnostic events and counters. |

## Example configuration

    session:
      enabled: true
      timeoutMs: 900000
      maxPages: 5
      encryptionKey: ${BROWSER_SESSION_KEY}

## Runtime diagnostics

Diagnostics are enabled by default and retained in a bounded in-memory ring (100 events by default). The `ac_browser_diagnostics` tool reports event counts, errors, operation durations, browser-context lifecycle, session activity, and passive WAF observations.

Example configuration:

    observability:
      enabled: true
      maxEvents: 100

Set `enabled: false` to disable event collection. `maxEvents` accepts values from 1 to 1000. Diagnostic metadata is allowlisted; URLs, selectors, form values, page content, session paths, account identifiers, and proxy credentials are not recorded. Events are process-local and are not exported to an external telemetry service.

Stateful browser tools are serialized through a manager-owned operation queue because they share browser context/page state. Closing the manager waits for an active operation to finish and rejects queued/new work.

## WAF detection
WAF detection is passive and informational. It inspects response headers and page content for known provider signals. It does not modify browser identity, forge challenge tokens, or alter access-control flows. A classification is best-effort, not proof that access is permitted.

## Development
Run pnpm install --frozen-lockfile, pnpm run typecheck, pnpm run build, pnpm run test, and pnpm run test:integration.

Local tests that bind loopback explicitly pass allowPrivateNetworks: true. Never enable this for untrusted or production inputs.

## Limitations
- The in-process DNS pin rejects changed DNS answers; the deployment DNS cache pins answers for at least 60 seconds. The firewall blocks private/reserved ranges even if a resolver returns one.
- The egress example allows only TCP 80/443 and DNS to two configured public resolvers; applications needing other ports require an explicit reviewed firewall change.
- WebRTC/UDP, arbitrary outbound protocols, and IPv6 AAAA resolution are blocked by the deployment profile.
- The egress firewall needs Docker host support for iptables/ip6tables and NET_ADMIN on the dedicated egress sidecar. Do not grant NET_ADMIN to the browser container.
