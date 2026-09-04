package httpapi

import (
	"net/http/httptest"
	"net/netip"
	"testing"
)

func prefixes(t *testing.T, values ...string) []netip.Prefix {
	t.Helper()
	var out []netip.Prefix
	for _, v := range values {
		p, err := netip.ParsePrefix(v)
		if err != nil {
			t.Fatalf("bad prefix %q: %v", v, err)
		}
		out = append(out, p)
	}
	return out
}

func TestClientIP(t *testing.T) {
	docker := prefixes(t, "172.16.0.0/12")

	tests := []struct {
		name    string
		remote  string
		xff     string
		trusted []netip.Prefix
		want    string
	}{
		{
			name:    "no proxy configured, header ignored",
			remote:  "203.0.113.9:5555",
			xff:     "1.2.3.4",
			trusted: nil,
			want:    "203.0.113.9",
		},
		{
			// The case that matters. Caddy appends rather than replaces, so a
			// caller who sends their own header produces "<forged>, <real>".
			// Reading right to left lands on the address Caddy saw.
			name:    "forged header behind trusted proxy",
			remote:  "172.18.0.3:40000",
			xff:     "1.2.3.4, 203.0.113.9",
			trusted: docker,
			want:    "203.0.113.9",
		},
		{
			name:    "several forged entries",
			remote:  "172.18.0.3:40000",
			xff:     "9.9.9.9, 8.8.8.8, 203.0.113.9",
			trusted: docker,
			want:    "203.0.113.9",
		},
		{
			name:    "header from an untrusted peer is ignored",
			remote:  "203.0.113.9:5555",
			xff:     "1.2.3.4",
			trusted: docker,
			want:    "203.0.113.9",
		},
		{
			name:    "no header at all",
			remote:  "172.18.0.3:40000",
			xff:     "",
			trusted: docker,
			want:    "172.18.0.3",
		},
		{
			name:    "garbage entries are skipped",
			remote:  "172.18.0.3:40000",
			xff:     "not-an-ip, 203.0.113.9",
			trusted: docker,
			want:    "203.0.113.9",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			r := httptest.NewRequest("GET", "/api/notes", nil)
			r.RemoteAddr = tc.remote
			if tc.xff != "" {
				r.Header.Set("X-Forwarded-For", tc.xff)
			}

			if got := ClientIP(r, tc.trusted).String(); got != tc.want {
				t.Fatalf("ClientIP = %s, want %s", got, tc.want)
			}
		})
	}
}
