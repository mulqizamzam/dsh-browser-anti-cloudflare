FROM alpine:3.21
RUN apk add --no-cache iptables dnsmasq
COPY entrypoint.sh /usr/local/bin/egress-entrypoint
RUN chmod 0755 /usr/local/bin/egress-entrypoint
ENTRYPOINT ["/usr/local/bin/egress-entrypoint"]
