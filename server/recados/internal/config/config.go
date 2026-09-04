// Package config reads everything the service needs, once, at start-up.
//
// A missing value that would silently change behaviour is a start-up failure
// rather than a default. The salt is the clearest case: without it the IP hash
// is a plain hash of a small, enumerable input, which any rainbow table
// reverses, and the service would still appear to work.
package config

import (
	"errors"
	"fmt"
	"net/netip"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Addr    string
	DBPath  string
	IPSalt  string
	Origins []string
	Admins  []string

	// TrustedProxies are the networks whose X-Forwarded-For may be believed.
	// Empty means the header is ignored entirely and every request appears to
	// come from the proxy, which collapses the rate limit into one bucket.
	TrustedProxies []netip.Prefix

	GeoDBPath string

	MaxNoteRunes int
	WallSize     int
	IPRetention  time.Duration

	// NoteRetention is how long a note stays in the database. It is not how
	// long it stays on the door: the wall shows the newest WallSize notes and
	// a note leaves it when newer ones push it off, not when a clock runs out.
	// This is only the promise that a stranger's message is not kept forever.
	NoteRetention time.Duration

	// WriteEvery is the gap one address must leave between notes, and
	// WritePerDay is its allowance over a day. Both are configurable for one
	// honest reason: on a laptop, running the room against a local service,
	// the production numbers mean a single note every ten minutes and three a
	// day, which makes the feature untestable by the person building it.
	// Leave them alone anywhere real.
	WriteEvery  time.Duration
	WritePerDay int
}

const (
	defaultAddr     = ":8080"
	defaultDBPath   = "recados.db"
	defaultMaxRunes = 140
	// Measured against the door, not chosen: a 0.086 m note that may sit at
	// any angle needs its neighbours 0.122 m away, and a simulation of people
	// dropping notes at random on this door saturates at 36 on average.
	// See the wall geometry in src/Experience/config/notes.js.
	defaultWallSize      = 36
	defaultIPRetention   = 24 * time.Hour
	defaultNoteRetention = 30 * 24 * time.Hour
	defaultWriteEvery    = 10 * time.Minute
	defaultWritePerDay   = 3
)

func Load() (Config, error) {
	c := Config{
		Addr:         env("RECADOS_ADDR", defaultAddr),
		DBPath:       env("RECADOS_DB", defaultDBPath),
		IPSalt:       os.Getenv("RECADOS_IP_SALT"),
		GeoDBPath:    os.Getenv("RECADOS_GEOIP_DB"),
		MaxNoteRunes: envInt("RECADOS_MAX_RUNES", defaultMaxRunes),
		WallSize:     envInt("RECADOS_WALL_SIZE", defaultWallSize),
		IPRetention:  defaultIPRetention,
		NoteRetention: time.Duration(envInt("RECADOS_NOTE_RETENTION_DAYS",
			int(defaultNoteRetention/(24*time.Hour)))) * 24 * time.Hour,
		WriteEvery: time.Duration(envInt("RECADOS_WRITE_EVERY_SECONDS",
			int(defaultWriteEvery/time.Second))) * time.Second,
		WritePerDay: envInt("RECADOS_WRITE_PER_DAY", defaultWritePerDay),
	}

	if strings.TrimSpace(c.IPSalt) == "" {
		return Config{}, errors.New("RECADOS_IP_SALT is required: without it the stored IP hash is reversible")
	}

	c.Origins = splitList(os.Getenv("RECADOS_ORIGINS"))
	if len(c.Origins) == 0 {
		return Config{}, errors.New("RECADOS_ORIGINS is required: the portfolio is served from another origin, so the browser needs an explicit allowance")
	}
	for _, origin := range c.Origins {
		if origin == "*" {
			return Config{}, errors.New("RECADOS_ORIGINS must name origins, never *")
		}
	}

	c.Admins = splitList(os.Getenv("RECADOS_ADMINS"))

	for _, raw := range splitList(os.Getenv("TRUSTED_PROXIES")) {
		prefix, err := netip.ParsePrefix(raw)
		if err != nil {
			return Config{}, fmt.Errorf("TRUSTED_PROXIES entry %q is not a CIDR: %w", raw, err)
		}
		c.TrustedProxies = append(c.TrustedProxies, prefix)
	}

	return c, nil
}

func env(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

func envInt(key string, fallback int) int {
	v, err := strconv.Atoi(strings.TrimSpace(os.Getenv(key)))
	if err != nil || v <= 0 {
		return fallback
	}
	return v
}

func splitList(raw string) []string {
	var out []string
	for _, part := range strings.Split(raw, ",") {
		if part = strings.TrimSpace(part); part != "" {
			out = append(out, part)
		}
	}
	return out
}
