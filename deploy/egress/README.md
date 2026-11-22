Egress firewall staging verification

Run this only inside the browser container using the shared egress sidecar network namespace. An ordinary container does not validate the firewall.

1. Deploy the compose profile in isolated staging.
2. Ensure the browser image includes curl and nc.
3. Run: sh deploy/egress/verify.sh
4. Require all checks to pass: public HTTPS allowed, metadata blocked, outbound TCP/22 blocked, and unapproved DNS blocked.
5. Capture output and image digest in the staging release record.
6. Inspect effective rules with iptables -S OUTPUT and ip6tables -S OUTPUT.

This smoke test does not replace firewall review. Do not report staging validation complete until it has run in the target environment.
