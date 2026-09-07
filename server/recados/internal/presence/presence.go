// Package presence counts who is in the room right now.
//
// It is a set of recent callers with a lifetime, and nothing else. No storage,
// no identity, no history: an entry is a hash of an address and the moment it
// was last seen, it is gone a minute later, and a restart forgets everyone.
// The number is a nice-to-have on a portfolio and is not worth one row of
// anybody's data on disk.
//
// The address is hashed rather than kept. The rate limiter next door does hold
// raw addresses, because it has to tell a repeat writer from a new one across
// a ten-minute window and a hash would do just as well there — this one starts
// from the better default, since counting needs to distinguish callers without
// ever knowing who they are.
package presence

import (
	"crypto/sha256"
	"encoding/binary"
	"sync"
	"time"
)

// How long somebody counts as here after their last word.
//
// Comfortably more than the heartbeat the page sends, so an ordinary visitor
// never blinks out between two beats, and short enough that somebody who
// closed the tab stops being counted while the next visitor is still reading.
const TTL = 70 * time.Second

// Above this the map stops growing. A number on a portfolio is not worth an
// unbounded map: past the cap, new callers are counted in the answer but not
// remembered, which understates a crowd and cannot be used to exhaust the box.
const maxEntries = 20000

type Counter struct {
	mu     sync.Mutex
	seen   map[uint64]time.Time
	salt   [16]byte
	stop   chan struct{}
	once   sync.Once
	nowFn  func() time.Time
	sweepN time.Duration
}

func New(salt [16]byte) *Counter {
	c := &Counter{
		seen:   make(map[uint64]time.Time),
		salt:   salt,
		stop:   make(chan struct{}),
		nowFn:  time.Now,
		sweepN: TTL,
	}
	go c.sweep()
	return c
}

// Seen records a caller and returns how many are here, that one included.
func (c *Counter) Seen(key string) int {
	k := c.hash(key)
	now := c.nowFn()

	c.mu.Lock()
	defer c.mu.Unlock()

	if _, known := c.seen[k]; known || len(c.seen) < maxEntries {
		c.seen[k] = now
	}

	// Counted here rather than by len, because the sweep runs on its own clock
	// and this must not report somebody who left forty seconds ago.
	n := 0
	cutoff := now.Add(-TTL)
	for _, at := range c.seen {
		if at.After(cutoff) {
			n++
		}
	}
	if n == 0 {
		n = 1
	}
	return n
}

// Count answers without recording anybody.
func (c *Counter) Count() int {
	c.mu.Lock()
	defer c.mu.Unlock()

	n := 0
	cutoff := c.nowFn().Add(-TTL)
	for _, at := range c.seen {
		if at.After(cutoff) {
			n++
		}
	}
	return n
}

func (c *Counter) Close() { c.once.Do(func() { close(c.stop) }) }

func (c *Counter) hash(key string) uint64 {
	h := sha256.New()
	h.Write(c.salt[:])
	h.Write([]byte(key))
	return binary.BigEndian.Uint64(h.Sum(nil)[:8])
}

func (c *Counter) sweep() {
	t := time.NewTicker(c.sweepN)
	defer t.Stop()

	for {
		select {
		case <-c.stop:
			return
		case <-t.C:
			c.mu.Lock()
			cutoff := c.nowFn().Add(-TTL)
			for k, at := range c.seen {
				if !at.After(cutoff) {
					delete(c.seen, k)
				}
			}
			c.mu.Unlock()
		}
	}
}
