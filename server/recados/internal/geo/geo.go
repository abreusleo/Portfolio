// Package geo turns the address the request came from into a two-letter
// country code, and nothing else.
//
// Two sources, in order of how little they cost:
//
//	CF-IPCountry  free and already correct, if Cloudflare fronts the site.
//	GeoLite2      a local file, no network call, needs a free MaxMind account.
//
// With neither, the country comes back empty and the note simply has no flag.
// That is a missing decoration, not a failure, so it must never refuse a note.
package geo

import (
	"net/http"
	"net/netip"
	"strings"

	"github.com/oschwald/maxminddb-golang/v2"
)

type Resolver struct {
	db      *maxminddb.Reader
	trusted bool
}

// Open builds a resolver. dbPath may be empty, in which case only the
// Cloudflare header is used. trustHeader must be true only when a proxy the
// operator controls sits in front — otherwise the header is whatever the
// caller decided to claim.
func Open(dbPath string, trustHeader bool) (*Resolver, error) {
	r := &Resolver{trusted: trustHeader}

	if strings.TrimSpace(dbPath) == "" {
		return r, nil
	}

	db, err := maxminddb.Open(dbPath)
	if err != nil {
		return nil, err
	}
	r.db = db

	return r, nil
}

func (r *Resolver) Close() error {
	if r.db == nil {
		return nil
	}
	return r.db.Close()
}

// Country returns an ISO 3166-1 alpha-2 code, or "" when it cannot tell.
func (r *Resolver) Country(request *http.Request, addr netip.Addr) string {
	if r.trusted {
		if code := clean(request.Header.Get("CF-IPCountry")); code != "" {
			// Cloudflare answers XX for anonymising proxies and T1 for Tor.
			// Neither names a place, so neither goes on a post-it.
			if code != "XX" && code != "T1" {
				return code
			}
			return ""
		}
	}

	if r.db == nil || !addr.IsValid() {
		return ""
	}

	var record struct {
		Country struct {
			ISOCode string `maxminddb:"iso_code"`
		} `maxminddb:"country"`
	}
	if err := r.db.Lookup(addr).Decode(&record); err != nil {
		return ""
	}

	return clean(record.Country.ISOCode)
}

func clean(value string) string {
	value = strings.ToUpper(strings.TrimSpace(value))
	if len(value) != 2 {
		return ""
	}
	for i := 0; i < len(value); i++ {
		if value[i] < 'A' || value[i] > 'Z' {
			return ""
		}
	}
	return value
}
