package presence

import (
	"testing"
	"time"
)

func fixed(c *Counter, at *time.Time) {
	c.nowFn = func() time.Time { return *at }
}

func TestCountsDistinctCallersOnce(t *testing.T) {
	now := time.Now()
	c := New([16]byte{1})
	defer c.Close()
	fixed(c, &now)

	if got := c.Seen("1.1.1.1"); got != 1 {
		t.Fatalf("first caller: got %d, want 1", got)
	}
	if got := c.Seen("1.1.1.1"); got != 1 {
		t.Fatalf("same caller again: got %d, want 1", got)
	}
	if got := c.Seen("2.2.2.2"); got != 2 {
		t.Fatalf("second caller: got %d, want 2", got)
	}
}

func TestForgetsAfterTTL(t *testing.T) {
	now := time.Now()
	c := New([16]byte{1})
	defer c.Close()
	fixed(c, &now)

	c.Seen("1.1.1.1")
	c.Seen("2.2.2.2")

	// One of them keeps talking, the other stops.
	now = now.Add(TTL - time.Second)
	if got := c.Seen("1.1.1.1"); got != 2 {
		t.Fatalf("just inside the window: got %d, want 2", got)
	}

	now = now.Add(2 * time.Second)
	if got := c.Count(); got != 1 {
		t.Fatalf("after the quiet one expired: got %d, want 1", got)
	}
}

// The answer must never be zero to the caller being answered: they are, by
// definition, here.
func TestCallerAlwaysCountsThemselves(t *testing.T) {
	now := time.Now()
	c := New([16]byte{1})
	defer c.Close()
	fixed(c, &now)

	for i := 0; i < maxEntries+50; i++ {
		c.Seen(string(rune(i)) + "-filler")
	}
	if got := c.Seen("late.arrival"); got < 1 {
		t.Fatalf("past the cap: got %d, want at least 1", got)
	}
}

func TestCapStopsTheMapGrowing(t *testing.T) {
	now := time.Now()
	c := New([16]byte{1})
	defer c.Close()
	fixed(c, &now)

	for i := 0; i < maxEntries*2; i++ {
		c.Seen(string(rune(i)) + "-filler")
	}
	c.mu.Lock()
	size := len(c.seen)
	c.mu.Unlock()

	if size > maxEntries {
		t.Fatalf("map grew past the cap: %d entries", size)
	}
}

// Two different addresses must not collide into one visitor, and the stored
// key must not be the address itself.
func TestKeysAreHashedAndDistinct(t *testing.T) {
	c := New([16]byte{7})
	defer c.Close()

	if c.hash("1.1.1.1") == c.hash("2.2.2.2") {
		t.Fatal("two addresses hashed to the same key")
	}

	other := New([16]byte{9})
	defer other.Close()
	if c.hash("1.1.1.1") == other.hash("1.1.1.1") {
		t.Fatal("the salt is not reaching the hash")
	}
}
