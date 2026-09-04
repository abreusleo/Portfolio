package httpapi

import (
	"testing"
	"time"
)

func TestLimiterHoldsBothWindows(t *testing.T) {
	l := NewLimiter(0,
		Rule{Max: 1, Window: 10 * time.Minute},
		Rule{Max: 3, Window: 24 * time.Hour},
	)
	defer l.Close()

	if v, _ := l.Allow("a"); v != Allowed {
		t.Fatal("first note should be allowed")
	}
	if v, retry := l.Allow("a"); v != OverLimit || retry <= 0 {
		t.Fatalf("second note should be held by the short window, got verdict=%v retry=%v", v, retry)
	}

	// A different caller is unaffected.
	if v, _ := l.Allow("b"); v != Allowed {
		t.Fatal("another key should have its own bucket")
	}
}

// A caller refused by one window must not have the other advanced. Otherwise
// the two drift apart and the daily count runs out while nothing was published.
func TestLimiterDoesNotConsumeOnRefusal(t *testing.T) {
	l := NewLimiter(0,
		Rule{Max: 1, Window: time.Hour},
		Rule{Max: 3, Window: 24 * time.Hour},
	)
	defer l.Close()

	l.Allow("a")
	for range 5 {
		l.Allow("a")
	}

	l.mu.Lock()
	daily := l.windows[1]["a"].count
	l.mu.Unlock()

	if daily != 1 {
		t.Fatalf("daily counter = %d, want 1: refusals must not consume the other windows", daily)
	}
}

// Refusing unknown keys once full is deliberate. Any eviction policy lets a
// caller with endless keys push out everybody else's counters.
func TestLimiterRefusesNewKeysWhenFull(t *testing.T) {
	l := NewLimiter(2, Rule{Max: 5, Window: time.Hour})
	defer l.Close()

	if v, _ := l.Allow("a"); v != Allowed {
		t.Fatal("first key should fit")
	}
	if v, _ := l.Allow("b"); v != Allowed {
		t.Fatal("second key should fit")
	}
	// And it says so as capacity, not as "you have had your share": the third
	// caller has done nothing.
	if v, _ := l.Allow("c"); v != AtCapacity {
		t.Fatal("third key should be refused as capacity, not evict another")
	}
	// The keys already inside keep working.
	if v, _ := l.Allow("a"); v != Allowed {
		t.Fatal("existing key should still be served")
	}
}

func TestLimiterEmptyKeyPasses(t *testing.T) {
	l := NewLimiter(0, Rule{Max: 1, Window: time.Hour})
	defer l.Close()

	for range 3 {
		if v, _ := l.Allow(""); v != Allowed {
			t.Fatal("an unknown address must not be bucketed with every other unknown address")
		}
	}
}
