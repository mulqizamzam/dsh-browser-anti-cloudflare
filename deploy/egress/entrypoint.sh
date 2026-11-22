#!/bin/sh
set -eu

command -v iptables >/dev/null
command -v ip6tables >/dev/null
command -v dnsmasq >/dev/null

# Default deny. Private, local, metadata, documentation, benchmarking,
# multicast and reserved IPv4 ranges are blocked before any allow rules.
iptables -w -F OUTPUT
iptables -w -P OUTPUT DROP
iptables -w -A OUTPUT -o lo -j ACCEPT
for cidr in \
  0.0.0.0/8 10.0.0.0/8 100.64.0.0/10 127.0.0.0/8 169.254.0.0/16 \
  172.16.0.0/12 192.0.0.0/24 192.0.2.0/24 192.88.99.0/24 \
  192.168.0.0/16 198.18.0.0/15 198.51.100.0/24 203.0.113.0/24 \
  224.0.0.0/4 240.0.0.0/4 255.255.255.255/32
do
  iptables -w -A OUTPUT -d "$cidr" -j DROP
done
iptables -w -A OUTPUT -p udp -d 1.1.1.1 --dport 53 -j ACCEPT
iptables -w -A OUTPUT -p tcp -d 1.1.1.1 --dport 53 -j ACCEPT
iptables -w -A OUTPUT -p udp -d 1.0.0.1 --dport 53 -j ACCEPT
iptables -w -A OUTPUT -p tcp -d 1.0.0.1 --dport 53 -j ACCEPT
iptables -w -A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
iptables -w -A OUTPUT -p tcp -m multiport --dports 80,443 -j ACCEPT

# IPv6 is fail-closed except public TCP web traffic. DNS AAAA replies are
# filtered by dnsmasq so Chromium cannot use IPv6 to evade the IPv4 policy.
ip6tables -w -F OUTPUT
ip6tables -w -P OUTPUT DROP
ip6tables -w -A OUTPUT -o lo -j ACCEPT
for cidr in ::/128 ::1/128 ::ffff:0:0/96 64:ff9b::/96 100::/64 \
  2001::/23 2001:db8::/32 2002::/16 fc00::/7 fe80::/10 ff00::/8
do
  ip6tables -w -A OUTPUT -d "$cidr" -j DROP
done
ip6tables -w -A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
ip6tables -w -A OUTPUT -p tcp -m multiport --dports 80,443 -j ACCEPT

# Cache DNS answers for at least 60 seconds. The application also pins
# validated answers in-process and rejects DNS answer changes.
exec dnsmasq --no-daemon --no-resolv --server=1.1.1.1 --server=1.0.0.1 \
  --min-cache-ttl=60 --max-cache-ttl=3600 --cache-size=10000 \
  --filter-AAAA --listen-address=127.0.0.1 --bind-interfaces --port=53
