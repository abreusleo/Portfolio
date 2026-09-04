package httpapi

import (
	"net"
	"net/http"
	"net/netip"
	"strings"
)

// ClientIP returns the address the rate limiter and the country lookup are
// allowed to believe.
//
// Caddy *appends* the peer address to X-Forwarded-For rather than replacing it,
// so a client that sends its own header produces "<forged>, <real>". Walking
// the chain from the right and stopping at the first address that is not a
// trusted proxy therefore lands on the address Caddy observed, and the forged
// entries sit harmlessly to its left.
//
// With no trusted proxies configured the header is ignored completely. That is
// the safe failure: every request then shares one bucket, which is annoying,
// whereas believing the header from anyone hands every caller an unlimited
// supply of fresh buckets. Hub makes the same call in its own extractor, and
// this service is meant to run behind the same Caddy.
func ClientIP(r *http.Request, trusted []netip.Prefix) netip.Addr {
	peer := parseAddr(r.RemoteAddr)

	if len(trusted) == 0 || !isTrusted(peer, trusted) {
		return peer
	}

	parts := strings.Split(r.Header.Get("X-Forwarded-For"), ",")
	for i := len(parts) - 1; i >= 0; i-- {
		addr, err := netip.ParseAddr(strings.TrimSpace(parts[i]))
		if err != nil {
			continue
		}
		addr = addr.Unmap()
		if !isTrusted(addr, trusted) {
			return addr
		}
	}

	return peer
}

func isTrusted(addr netip.Addr, trusted []netip.Prefix) bool {
	if !addr.IsValid() {
		return false
	}
	for _, prefix := range trusted {
		if prefix.Contains(addr) {
			return true
		}
	}
	return false
}

func parseAddr(remote string) netip.Addr {
	host, _, err := net.SplitHostPort(remote)
	if err != nil {
		host = remote
	}
	addr, err := netip.ParseAddr(strings.TrimSpace(host))
	if err != nil {
		return netip.Addr{}
	}
	return addr.Unmap()
}
