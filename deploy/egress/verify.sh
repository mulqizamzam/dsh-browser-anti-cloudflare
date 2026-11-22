#!/bin/sh
set -eu
# Run inside the browser container sharing the egress sidecar network namespace.
command -v curl >/dev/null 2>&1 || { echo "curl required" >&2; exit 2; }
command -v nc >/dev/null 2>&1 || { echo "nc required" >&2; exit 2; }
curl --fail --silent --show-error --connect-timeout 5 https://example.com/ >/dev/null
echo "PASS: public HTTPS allowed"
if curl --silent --show-error --connect-timeout 3 http://169.254.169.254/latest/meta-data/ >/dev/null 2>&1; then echo "FAIL: metadata reachable" >&2; exit 1; fi
echo "PASS: cloud metadata blocked"
if nc -z -w 3 1.1.1.1 22 >/dev/null 2>&1; then echo "FAIL: unapproved TCP port reachable" >&2; exit 1; fi
echo "PASS: unapproved TCP port blocked"
if nc -z -w 3 8.8.8.8 53 >/dev/null 2>&1; then echo "FAIL: unapproved DNS resolver reachable" >&2; exit 1; fi
echo "PASS: unapproved DNS resolver blocked"
