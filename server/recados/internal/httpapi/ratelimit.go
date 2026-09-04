package httpapi

import (
	"sync"
	"time"
)

// Rule is one window: at most Max requests per Window, per key.
type Rule struct {
	Max    int
	Window time.Duration
}

// Limiter applies several windows at once, so a caller can be held to both a
// short burst limit and a long daily one under a single key.
//
// Fixed windows rather than a token bucket, because the numbers here are small
// and a window that is off by a few seconds at the boundary changes nothing
// that matters. Everything lives in memory: this is the cheap first gate, and
// the write path checks the database as well, so a restart does not hand
// everybody a fresh quota.
type Limiter struct {
	rules      []Rule
	maxEntries int

	mu      sync.Mutex
	windows []map[string]*counter
	stop    chan struct{}
	once    sync.Once
}

type counter struct {
	count int
	start time.Time
}

// Two hundred thousand keys, at roughly a hundred bytes each, is about twenty
// megabytes per window. The old cap was twenty thousand, and it was reached by
// the twenty-thousandth address of the *day*, because the daily window kept a
// day of them. The daily limit is read from the rows now, so what lives here
// is ten minutes of writers and one minute of readers.
const defaultMaxEntries = 200000

// Verdict says why a caller was turned away, because the two reasons are not
// the same thing and must not read the same to the person on the other end.
type Verdict int

const (
	// Allowed: within every window.
	Allowed Verdict = iota
	// OverLimit: this caller has had its share. Their own doing.
	OverLimit
	// AtCapacity: the limiter is holding as many callers as it will hold, and
	// this one is a stranger. Nothing to do with anything they did.
	AtCapacity
)

func NewLimiter(maxEntries int, rules ...Rule) *Limiter {
	if maxEntries <= 0 {
		maxEntries = defaultMaxEntries
	}

	// A rule with no window and no allowance is not a rule, and it used to be
	// a crash: the sweep ticker refuses a non-positive interval and took the
	// process with it. A limiter that was handed nothing meaningful lets
	// everything through instead, which is what an empty rule set already
	// means to Allow.
	kept := rules[:0]
	for _, rule := range rules {
		if rule.Window > 0 && rule.Max > 0 {
			kept = append(kept, rule)
		}
	}
	rules = kept

	l := &Limiter{
		rules:      rules,
		maxEntries: maxEntries,
		windows:    make([]map[string]*counter, len(rules)),
		stop:       make(chan struct{}),
	}
	for i := range l.windows {
		l.windows[i] = make(map[string]*counter)
	}

	if len(rules) > 0 {
		go l.sweep()
	}
	return l
}

// Allow consumes one unit against every rule, or none at all. A caller that
// fails the daily limit must not have its ten-minute counter advanced too,
// otherwise the two windows drift apart for no reason.
func (l *Limiter) Allow(key string) (Verdict, time.Duration) {
	if key == "" || len(l.rules) == 0 {
		return Allowed, 0
	}

	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()

	for i, rule := range l.rules {
		entry, ok := l.windows[i][key]
		if ok && now.Sub(entry.start) <= rule.Window && entry.count >= rule.Max {
			return OverLimit, rule.Window - now.Sub(entry.start)
		}
		// Refuse unknown keys once the map is full instead of evicting the
		// oldest. Any eviction policy lets a caller with an endless supply of
		// keys push out everyone else's counters, which is the opposite of
		// what a rate limiter is for. Hub's limiter refuses for the same
		// reason. The sweep below drains expired entries, so capacity returns.
		if !ok && len(l.windows[i]) >= l.maxEntries {
			return AtCapacity, rule.Window
		}
	}

	for i, rule := range l.rules {
		entry, ok := l.windows[i][key]
		if !ok || now.Sub(entry.start) > rule.Window {
			l.windows[i][key] = &counter{count: 1, start: now}
			continue
		}
		entry.count++
	}

	return Allowed, 0
}

func (l *Limiter) Close() { l.once.Do(func() { close(l.stop) }) }

func (l *Limiter) sweep() {
	shortest := l.rules[0].Window
	for _, rule := range l.rules {
		if rule.Window < shortest {
			shortest = rule.Window
		}
	}

	ticker := time.NewTicker(shortest)
	defer ticker.Stop()

	for {
		select {
		case <-l.stop:
			return
		case now := <-ticker.C:
			l.mu.Lock()
			for i, rule := range l.rules {
				for key, entry := range l.windows[i] {
					if now.Sub(entry.start) > rule.Window {
						delete(l.windows[i], key)
					}
				}
			}
			l.mu.Unlock()
		}
	}
}
