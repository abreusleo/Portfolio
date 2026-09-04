package store

import (
	"context"
	"errors"
	"net/netip"
	"path/filepath"
	"testing"
	"time"
)

func newStore(t *testing.T) *Store {
	t.Helper()
	st, err := Open(filepath.Join(t.TempDir(), "test.db"), "salt-for-tests")
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	t.Cleanup(func() { st.Close() })
	return st
}

// testWall is deliberately generous: these tests are about rows, not geometry.
// MinDist zero means nothing ever collides, so every note lands where it asked
// even though they all ask for the same spot. Placement has its own tests.
var testWall = Wall{Capacity: 100, MinDist: 0, HalfW: 0.317, HalfH: 0.577}

func place(t *testing.T, st *Store, ctx context.Context, n Note, fp string) Note {
	t.Helper()
	note, _, err := st.Place(ctx, n, fp, testWall)
	if err != nil {
		t.Fatalf("place: %v", err)
	}
	return note
}

func TestInsertAndRecent(t *testing.T) {
	st := newStore(t)
	ctx := context.Background()
	fingerprint := st.Fingerprint(netip.MustParseAddr("203.0.113.9"))

	for _, text := range []string{"primeiro", "segundo", "terceiro"} {
		place(t, st, ctx, Note{Text: text, Country: "BR", Sentiment: "positive"}, fingerprint)
		// The wall orders on the timestamp, so the rows need distinct ones.
		time.Sleep(2 * time.Millisecond)
	}

	notes, err := st.Recent(ctx, 10)
	if err != nil {
		t.Fatalf("recent: %v", err)
	}
	if len(notes) != 3 {
		t.Fatalf("got %d notes, want 3", len(notes))
	}
	if notes[0].Text != "terceiro" {
		t.Fatalf("newest note = %q, want terceiro", notes[0].Text)
	}
	if notes[0].Country != "BR" {
		t.Fatalf("country = %q, want BR", notes[0].Country)
	}
}

// The fingerprint is the only trace of the address, and it must not be
// reversible by trying the addresses one at a time.
func TestFingerprintIsSaltedAndStable(t *testing.T) {
	a, _ := Open(filepath.Join(t.TempDir(), "a.db"), "salt-one")
	b, _ := Open(filepath.Join(t.TempDir(), "b.db"), "salt-two")
	defer a.Close()
	defer b.Close()

	addr := netip.MustParseAddr("203.0.113.9")

	if a.Fingerprint(addr) == "" {
		t.Fatal("a valid address must produce a fingerprint")
	}
	first := a.Fingerprint(addr)
	if a.Fingerprint(netip.MustParseAddr("203.0.113.9")) != first {
		t.Fatal("the same address must produce the same fingerprint")
	}
	if a.Fingerprint(addr) == b.Fingerprint(addr) {
		t.Fatal("a different salt must produce a different fingerprint")
	}
	if a.Fingerprint(netip.Addr{}) != "" {
		t.Fatal("an unknown address must not be fingerprinted")
	}
}

func TestCountSinceBacksTheWriteLimit(t *testing.T) {
	st := newStore(t)
	ctx := context.Background()

	mine := st.Fingerprint(netip.MustParseAddr("203.0.113.9"))
	theirs := st.Fingerprint(netip.MustParseAddr("198.51.100.4"))

	for range 2 {
		place(t, st, ctx, Note{Text: "oi", Sentiment: "neutral"}, mine)
	}
	place(t, st, ctx, Note{Text: "oi", Sentiment: "neutral"}, theirs)

	count, err := st.CountSince(ctx, mine, time.Now().Add(-time.Hour))
	if err != nil {
		t.Fatalf("count: %v", err)
	}
	if count != 2 {
		t.Fatalf("count = %d, want 2: one caller must not be charged for another's notes", count)
	}

	// A note older than the window is not counted, which is what lets the
	// retention below double as the limit.
	old, err := st.CountSince(ctx, mine, time.Now().Add(time.Hour))
	if err != nil {
		t.Fatalf("count: %v", err)
	}
	if old != 0 {
		t.Fatalf("count outside the window = %d, want 0", old)
	}
}

func TestForgetAddressesKeepsTheNote(t *testing.T) {
	st := newStore(t)
	ctx := context.Background()
	fingerprint := st.Fingerprint(netip.MustParseAddr("203.0.113.9"))

	note := place(t, st, ctx, Note{Text: "recado antigo", Sentiment: "neutral"}, fingerprint)

	// Nothing is old enough yet.
	if n, _ := st.ForgetAddresses(ctx, time.Hour); n != 0 {
		t.Fatalf("forgot %d rows too early", n)
	}

	// Age the row rather than asking whether a note written microseconds ago
	// is already in the past. It was written with a zero window before, and
	// that is a race against the clock's own granularity: when both readings
	// land in the same tick the row is not strictly older than the cutoff and
	// nothing is forgotten. The test failed about once in four full runs.
	backdate(t, st, note.ID, 2*time.Hour)

	n, err := st.ForgetAddresses(ctx, time.Hour)
	if err != nil {
		t.Fatalf("forget: %v", err)
	}
	if n != 1 {
		t.Fatalf("forgot %d rows, want 1", n)
	}

	count, _ := st.CountSince(ctx, fingerprint, time.Now().Add(-time.Hour))
	if count != 0 {
		t.Fatal("a forgotten address must no longer be countable")
	}

	notes, _ := st.Recent(ctx, 10)
	if len(notes) != 1 || notes[0].Text != "recado antigo" {
		t.Fatal("forgetting the address must not touch the note itself")
	}
}

func TestDelete(t *testing.T) {
	st := newStore(t)
	ctx := context.Background()

	note := place(t, st, ctx, Note{Text: "some fora", Sentiment: "neutral"}, "")

	deleted, err := st.Delete(ctx, note.ID)
	if err != nil || !deleted {
		t.Fatalf("delete = %v, %v", deleted, err)
	}

	deleted, err = st.Delete(ctx, note.ID)
	if err != nil || deleted {
		t.Fatalf("deleting twice = %v, %v; want false, nil", deleted, err)
	}
}

// backdate moves a row into the past so a retention test does not have to race
// the clock. In-package on purpose: nothing outside store may move a note's
// time, which is why this is not on Store.
func backdate(t *testing.T, st *Store, id string, by time.Duration) {
	t.Helper()
	when := time.Now().UTC().Add(-by).Format(stamp)
	if _, err := st.db.Exec(`UPDATE notes SET created_at = ? WHERE id = ?`, when, id); err != nil {
		t.Fatalf("backdate: %v", err)
	}
}

func TestPurgeRemovesOldNotesAndOnlyThose(t *testing.T) {
	st := newStore(t)
	ctx := context.Background()

	old := place(t, st, ctx, Note{Text: "recado de um mes atras", Sentiment: "neutral"}, "")
	place(t, st, ctx, Note{Text: "recado de hoje", Sentiment: "neutral"}, "")
	backdate(t, st, old.ID, 40*24*time.Hour)

	n, err := st.Purge(ctx, 30*24*time.Hour)
	if err != nil {
		t.Fatalf("purge: %v", err)
	}
	if n != 1 {
		t.Fatalf("purged %d rows, want 1", n)
	}

	notes, _ := st.Recent(ctx, 10)
	if len(notes) != 1 || notes[0].Text != "recado de hoje" {
		t.Fatalf("purge took the wrong note: %+v", notes)
	}
}

// The door, near enough: a note may sit anywhere as long as it is a note's
// diagonal away from every neighbour.
var doorWall = Wall{Capacity: 36, MinDist: 0.086 * 1.4142135623730951, HalfW: 0.317, HalfH: 0.577}

func TestPlaceRefusesAnOccupiedSpot(t *testing.T) {
	st := newStore(t)
	ctx := context.Background()

	if _, _, err := st.Place(ctx, Note{Text: "primeiro", X: 0, Y: 0}, "", doorWall); err != nil {
		t.Fatalf("first note: %v", err)
	}

	// Two centimetres away is well inside the exclusion circle.
	_, _, err := st.Place(ctx, Note{Text: "por cima", X: 0.02, Y: 0}, "", doorWall)
	if !errors.Is(err, ErrSpotTaken) {
		t.Fatalf("err = %v, want ErrSpotTaken", err)
	}

	// And far enough away is fine.
	if _, _, err := st.Place(ctx, Note{Text: "ao lado", X: 0.2, Y: 0.2}, "", doorWall); err != nil {
		t.Fatalf("a clear spot must be accepted: %v", err)
	}
}

func TestPlaceClampsToTheDoor(t *testing.T) {
	st := newStore(t)
	ctx := context.Background()

	note, _, err := st.Place(ctx, Note{Text: "fora da porta", X: 99, Y: -99}, "", doorWall)
	if err != nil {
		t.Fatalf("place: %v", err)
	}
	if note.X != doorWall.HalfW || note.Y != -doorWall.HalfH {
		t.Fatalf("position = %v,%v, want the corner of the door", note.X, note.Y)
	}
}

// When the door is full the visitor does not choose. The note takes the spot of
// the oldest one on the wall, and that oldest note falls off the newest-first
// query on its own. Nothing is deleted for it.
func TestPlaceTakesTheOldestSpotWhenFull(t *testing.T) {
	st := newStore(t)
	ctx := context.Background()

	small := Wall{Capacity: 3, MinDist: 0.2, HalfW: 0.317, HalfH: 0.577}

	first := place(t, st, ctx, Note{Text: "o mais antigo", X: -0.3, Y: -0.5}, "")
	place(t, st, ctx, Note{Text: "do meio", X: 0.0, Y: 0.0}, "")
	place(t, st, ctx, Note{Text: "o mais novo", X: 0.3, Y: 0.5}, "")

	// The door is full, so this asks for a spot it will not get.
	note, replaced, err := st.Place(ctx, Note{Text: "o novo", X: 0.1, Y: 0.1}, "", small)
	if err != nil {
		t.Fatalf("place: %v", err)
	}
	if !replaced {
		t.Fatal("a full door must report that it replaced the oldest")
	}
	if note.X != first.X || note.Y != first.Y {
		t.Fatalf("position = %v,%v, want the oldest note's %v,%v", note.X, note.Y, first.X, first.Y)
	}

	wall, _ := st.Recent(ctx, small.Capacity)
	if len(wall) != small.Capacity {
		t.Fatalf("wall has %d notes, want %d", len(wall), small.Capacity)
	}
	for _, n := range wall {
		if n.ID == first.ID {
			t.Fatal("the oldest note should have fallen off the wall")
		}
	}

	// Fallen off the door, still in the file. Only Purge removes a note.
	all, _ := st.Recent(ctx, 100)
	if len(all) != 4 {
		t.Fatalf("rows = %d, want 4: a full wall must not delete anything", len(all))
	}
}
