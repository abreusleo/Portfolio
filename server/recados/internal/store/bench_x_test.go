package store

import (
	"context"
	"testing"
)

// What one write costs when the door is full, which is the worst case: the
// placement scan sweeps the whole door on an 8 mm grid against every note on
// it, and it does that inside the write transaction.
func BenchmarkPlaceOnFullWall(b *testing.B) {
	st := newStoreBench(b)
	ctx := context.Background()
	wall := Wall{Capacity: 36, MinDist: 0.086 * 1.4142135623730951, HalfW: 0.317, HalfH: 0.577}

	xs := []float64{-0.317, -0.1585, 0, 0.1585, 0.317}
	n := 0
	for row := 0; row < 9 && n < 36; row++ {
		for _, x := range xs {
			if n >= 36 {
				break
			}
			y := -0.577 + float64(row)*(1.154/8)
			st.Place(ctx, Note{Text: "cheio", X: x, Y: y}, "", wall)
			n++
		}
	}

	for b.Loop() {
		st.Place(ctx, Note{Text: "mais um", X: 0.1, Y: 0.1}, "", wall)
	}
}

// And on an empty door, where the scan finds room on its first probe.
func BenchmarkPlaceOnEmptyWall(b *testing.B) {
	st := newStoreBench(b)
	ctx := context.Background()
	wall := Wall{Capacity: 36, MinDist: 0.086 * 1.4142135623730951, HalfW: 0.317, HalfH: 0.577}

	for b.Loop() {
		st.Place(ctx, Note{Text: "primeiro", X: 0, Y: 0}, "", wall)
	}
}

func newStoreBench(b *testing.B) *Store {
	b.Helper()
	st, err := Open(b.TempDir()+"/bench.db", "salt")
	if err != nil {
		b.Fatal(err)
	}
	b.Cleanup(func() { st.Close() })
	return st
}
