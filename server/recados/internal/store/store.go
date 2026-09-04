// Package store keeps the notes.
//
// SQLite, one file, no server, the same choice Orbis made. The interesting
// decision here is what is *not* kept: the visitor's address never lands in a
// column. What is written is a salted hash of it, and even that is wiped once
// it is older than the longest rate-limit window, because after that it can
// answer no question the service still needs to ask.
package store

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base32"
	"encoding/hex"
	"errors"
	"fmt"
	"net/netip"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

type Note struct {
	ID        string    `json:"id"`
	Text      string    `json:"text"`
	Country   string    `json:"country"`
	Sentiment string    `json:"sentiment"`
	CreatedAt time.Time `json:"created_at"`

	// Name is who signed it. Optional: plenty of people would rather not.
	Name string `json:"name"`

	// X and Y are where the note sits on the door, in metres from the centre
	// of the wall rectangle. The visitor drags it there, but the number that
	// is stored is the one this package agreed to, never the one the browser
	// sent: see Place.
	X float64 `json:"x"`
	Y float64 `json:"y"`

	// Flagged marks a note the model never saw, because the provider was down
	// when it arrived. It is published like any other; the admin list shows it
	// first. Never serialised to the public wall.
	Flagged bool `json:"-"`
}

type Store struct {
	db   *sql.DB
	salt []byte
}

// stamp is how a time is written to the column, and it is not RFC3339Nano.
//
// Every query here compares created_at as text: ORDER BY for the wall, < for
// the retention sweeps, >= for the daily count. RFC3339Nano trims trailing
// zeros from the fraction, so the strings it produces are not all the same
// length, and when one fraction is a prefix of another the 'Z' decides the
// comparison. 'Z' sorts above every digit, so .1Z reads as *later* than .12Z
// and the row is a tenth of a second in the future as far as SQL is concerned.
//
// That put notes out of order on the wall, made the oldest note the wrong one
// to replace, and intermittently left an address unforgotten. Nine fixed
// digits cost nothing and make the text order the real order.
const stamp = "2006-01-02T15:04:05.000000000Z07:00"

const stampLen = len("2026-01-02T15:04:05.000000000Z")

const schema = `
CREATE TABLE IF NOT EXISTS notes (
    id         TEXT PRIMARY KEY,
    text       TEXT NOT NULL,
    country    TEXT NOT NULL DEFAULT '',
    sentiment  TEXT NOT NULL DEFAULT 'neutral',
    flagged    INTEGER NOT NULL DEFAULT 0,
    ip_hash    TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    x          REAL NOT NULL DEFAULT 0,
    y          REAL NOT NULL DEFAULT 0,
    name       TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS notes_created_at ON notes (created_at DESC);
CREATE INDEX IF NOT EXISTS notes_ip_hash ON notes (ip_hash, created_at DESC);
`

func Open(path, salt string) (*Store, error) {
	db, err := sql.Open("sqlite", path+"?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)&_pragma=foreign_keys(1)")
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}

	// One writer at a time. SQLite serialises writes anyway, and a single
	// connection turns "database is locked" from a runtime surprise into
	// something that cannot happen.
	db.SetMaxOpenConns(1)

	if _, err := db.Exec(schema); err != nil {
		db.Close()
		return nil, fmt.Errorf("create schema: %w", err)
	}

	// A database written before notes had a position needs the two columns
	// added. SQLite has no ADD COLUMN IF NOT EXISTS, so the table is asked
	// what it already has. Existing rows land on 0,0 and are spread out by
	// the first Place that finds them stacked.
	if err := addColumns(db, map[string]string{
		"x":    "REAL NOT NULL DEFAULT 0",
		"y":    "REAL NOT NULL DEFAULT 0",
		"name": "TEXT NOT NULL DEFAULT ''",
	}); err != nil {
		db.Close()
		return nil, err
	}

	if err := restampTimes(db); err != nil {
		db.Close()
		return nil, err
	}

	return &Store{db: db, salt: []byte(salt)}, nil
}

// restampTimes rewrites any created_at that was written in the old variable
// width form. See the comment on stamp for why they cannot be left alone.
func restampTimes(db *sql.DB) error {
	rows, err := db.Query(`SELECT id, created_at FROM notes WHERE length(created_at) != ?`, stampLen)
	if err != nil {
		return fmt.Errorf("read timestamps: %w", err)
	}

	type fix struct{ id, at string }
	var fixes []fix
	for rows.Next() {
		var id, at string
		if err := rows.Scan(&id, &at); err != nil {
			rows.Close()
			return fmt.Errorf("scan timestamp: %w", err)
		}
		parsed, err := time.Parse(time.RFC3339Nano, at)
		if err != nil {
			// Unreadable rather than merely old. Leaving it is worse than
			// moving it: it would sort anywhere at all.
			continue
		}
		fixes = append(fixes, fix{id, parsed.UTC().Format(stamp)})
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return fmt.Errorf("read timestamps: %w", err)
	}

	for _, f := range fixes {
		if _, err := db.Exec(`UPDATE notes SET created_at = ? WHERE id = ?`, f.at, f.id); err != nil {
			return fmt.Errorf("restamp %s: %w", f.id, err)
		}
	}
	return nil
}

func addColumns(db *sql.DB, want map[string]string) error {
	rows, err := db.Query(`PRAGMA table_info(notes)`)
	if err != nil {
		return fmt.Errorf("read table info: %w", err)
	}
	have := map[string]bool{}
	for rows.Next() {
		var (
			cid, notNull, pk int
			name, kind       string
			dflt             sql.NullString
		)
		if err := rows.Scan(&cid, &name, &kind, &notNull, &dflt, &pk); err != nil {
			rows.Close()
			return fmt.Errorf("scan table info: %w", err)
		}
		have[name] = true
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return fmt.Errorf("read table info: %w", err)
	}

	for name, kind := range want {
		if have[name] {
			continue
		}
		if _, err := db.Exec(`ALTER TABLE notes ADD COLUMN ` + name + ` ` + kind); err != nil {
			return fmt.Errorf("add column %s: %w", name, err)
		}
	}
	return nil
}

func (s *Store) Close() error { return s.db.Close() }

// Fingerprint is the only form of the address that exists past the request.
// HMAC rather than a bare hash: the input space is small enough to enumerate,
// so the secret is what makes the output useless to anyone who reads the file.
func (s *Store) Fingerprint(addr netip.Addr) string {
	if !addr.IsValid() {
		return ""
	}
	mac := hmac.New(sha256.New, s.salt)
	mac.Write([]byte(addr.String()))
	return hex.EncodeToString(mac.Sum(nil)[:16])
}

// Wall is the shape of the door, as the server understands it. The numbers
// have to agree with src/Experience/config/notes.js, which is what draws it.
type Wall struct {
	// Capacity is how many notes the door shows. A note is not deleted when it
	// falls past this; it simply stops being on the wall.
	Capacity int

	// MinDist is the closest two centres may sit. A note is a square that may
	// be tilted, and a square of side s fits inside a circle of diameter
	// s*sqrt(2), so holding centres that far apart keeps them from touching at
	// any angle at all.
	MinDist float64

	// HalfW and HalfH bound the centre, already inset by half a note, so no
	// part of it hangs off the door.
	HalfW float64
	HalfH float64
}

// ErrSpotTaken says the requested position overlaps a note already there and
// the door still has room elsewhere. The visitor picks again.
var ErrSpotTaken = errors.New("spot taken")

// Place writes the note where the visitor dropped it.
//
// The read of the wall and the write happen in one transaction, which is what
// stops two people who picked the same gap in the same instant from both
// getting it. The second one loses and is told to pick again.
//
// When the door is full the visitor does not get to choose at all: the note
// takes the position of the oldest one on the wall, and that oldest note falls
// off the bottom of the newest-first query on its own. Nothing is deleted for
// this. Old rows leave through Purge, on a clock, not because somebody wrote.
//
// The position the browser sent is never trusted: it is clamped to the door
// and checked against every neighbour before it is written.
func (s *Store) Place(ctx context.Context, note Note, fingerprint string, wall Wall) (Note, bool, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Note{}, false, fmt.Errorf("begin: %w", err)
	}
	defer tx.Rollback()

	rows, err := tx.QueryContext(ctx,
		`SELECT x, y FROM notes ORDER BY created_at DESC, rowid DESC LIMIT ?`, wall.Capacity)
	if err != nil {
		return Note{}, false, fmt.Errorf("read wall: %w", err)
	}
	var taken []point
	for rows.Next() {
		var p point
		if err := rows.Scan(&p.X, &p.Y); err != nil {
			rows.Close()
			return Note{}, false, fmt.Errorf("scan wall: %w", err)
		}
		taken = append(taken, p)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return Note{}, false, fmt.Errorf("read wall: %w", err)
	}

	full := len(taken) >= wall.Capacity || !hasFreeSpot(taken, wall)
	if full {
		// The oldest of the ones on show, which is the last row of a
		// newest-first query. Its spot is the only one that is about to open.
		note.X, note.Y = taken[len(taken)-1].X, taken[len(taken)-1].Y
	} else {
		note.X = clamp(note.X, wall.HalfW)
		note.Y = clamp(note.Y, wall.HalfH)
		if collides(note.X, note.Y, taken, wall.MinDist) {
			return Note{}, false, ErrSpotTaken
		}
	}

	note.ID = newID()
	note.CreatedAt = time.Now().UTC()

	_, err = tx.ExecContext(ctx,
		`INSERT INTO notes (id, text, country, sentiment, flagged, ip_hash, created_at, x, y, name)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		note.ID, note.Text, note.Country, note.Sentiment, boolToInt(note.Flagged),
		fingerprint, note.CreatedAt.Format(stamp), note.X, note.Y, note.Name)
	if err != nil {
		return Note{}, false, fmt.Errorf("insert note: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return Note{}, false, fmt.Errorf("commit: %w", err)
	}

	return note, full, nil
}

type point struct{ X, Y float64 }

func collides(x, y float64, taken []point, minDist float64) bool {
	for _, p := range taken {
		dx, dy := x-p.X, y-p.Y
		if dx*dx+dy*dy < minDist*minDist {
			return true
		}
	}
	return false
}

// hasFreeSpot walks the door on a grid finer than a note and asks whether any
// centre is still legal.
//
// Counting notes is not enough to know the wall is full. People do not pack a
// door tightly, and a run of unlucky drops jams it well below the capacity: a
// simulation of this door saturates anywhere between 30 and 42. Without this
// check a visitor could be told to pick again forever, with nowhere left to
// pick.
func hasFreeSpot(taken []point, wall Wall) bool {
	const step = 0.008 // 8 mm, about a tenth of a note
	for x := -wall.HalfW; x <= wall.HalfW; x += step {
		for y := -wall.HalfH; y <= wall.HalfH; y += step {
			if !collides(x, y, taken, wall.MinDist) {
				return true
			}
		}
	}
	return false
}

func clamp(v, limit float64) float64 {
	if v < -limit {
		return -limit
	}
	if v > limit {
		return limit
	}
	return v
}

// Two notes can carry the same created_at: the clock has a granularity and two
// visitors can land inside one tick of it. With no tiebreaker SQLite is free to
// return tied rows in any order, so the wall could shuffle between reads and,
// worse, Place could pick the wrong note as the oldest and drop somebody
// else's. rowid is insertion order, which is exactly the order intended.
// Recent returns what goes on the wall, newest first.
func (s *Store) Recent(ctx context.Context, limit int) ([]Note, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, text, country, sentiment, flagged, created_at, x, y, name
		   FROM notes ORDER BY created_at DESC, rowid DESC LIMIT ?`, limit)
	if err != nil {
		return nil, fmt.Errorf("select notes: %w", err)
	}
	defer rows.Close()

	return scanNotes(rows)
}

// Flagged lists what the model never judged, newest first, for the admin page.
func (s *Store) FlaggedNotes(ctx context.Context, limit int) ([]Note, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, text, country, sentiment, flagged, created_at, x, y, name
		   FROM notes WHERE flagged = 1 ORDER BY created_at DESC, rowid DESC LIMIT ?`, limit)
	if err != nil {
		return nil, fmt.Errorf("select flagged notes: %w", err)
	}
	defer rows.Close()

	return scanNotes(rows)
}

// CountSince is the half of the write limit that survives a restart. The
// in-memory limiter is faster and catches the burst; this catches the redeploy
// that would otherwise reset everybody's daily quota.
func (s *Store) CountSince(ctx context.Context, fingerprint string, since time.Time) (int, error) {
	if fingerprint == "" {
		return 0, nil
	}

	var n int
	err := s.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM notes WHERE ip_hash = ? AND created_at >= ?`,
		fingerprint, since.UTC().Format(stamp)).Scan(&n)
	if err != nil {
		return 0, fmt.Errorf("count notes: %w", err)
	}
	return n, nil
}

func (s *Store) Delete(ctx context.Context, id string) (bool, error) {
	result, err := s.db.ExecContext(ctx, `DELETE FROM notes WHERE id = ?`, id)
	if err != nil {
		return false, fmt.Errorf("delete note: %w", err)
	}
	n, err := result.RowsAffected()
	return n > 0, err
}

// ForgetAddresses clears the fingerprint on everything older than the longest
// window it could still be needed for. The retention *is* the rate limit: past
// that point the column answers no question, so it stops existing.
func (s *Store) ForgetAddresses(ctx context.Context, olderThan time.Duration) (int64, error) {
	cutoff := time.Now().UTC().Add(-olderThan).Format(stamp)
	result, err := s.db.ExecContext(ctx,
		`UPDATE notes SET ip_hash = '' WHERE ip_hash != '' AND created_at < ?`, cutoff)
	if err != nil {
		return 0, fmt.Errorf("forget addresses: %w", err)
	}
	return result.RowsAffected()
}

// Purge drops notes past their retention. This is the only thing that removes
// a note, and it has nothing to do with the wall being full: what governs the
// door is the newest-N query, and what governs the file is this clock.
func (s *Store) Purge(ctx context.Context, olderThan time.Duration) (int64, error) {
	cutoff := time.Now().UTC().Add(-olderThan).Format(stamp)
	result, err := s.db.ExecContext(ctx, `DELETE FROM notes WHERE created_at < ?`, cutoff)
	if err != nil {
		return 0, fmt.Errorf("purge notes: %w", err)
	}
	return result.RowsAffected()
}

func scanNotes(rows *sql.Rows) ([]Note, error) {
	notes := make([]Note, 0, 16)
	for rows.Next() {
		var (
			note      Note
			flagged   int
			createdAt string
		)
		if err := rows.Scan(&note.ID, &note.Text, &note.Country, &note.Sentiment, &flagged, &createdAt, &note.X, &note.Y, &note.Name); err != nil {
			return nil, fmt.Errorf("scan note: %w", err)
		}
		note.Flagged = flagged == 1
		note.CreatedAt, _ = time.Parse(time.RFC3339Nano, createdAt)
		notes = append(notes, note)
	}
	return notes, rows.Err()
}

var encoding = base32.NewEncoding("0123456789abcdefghjkmnpqrstvwxyz").WithPadding(base32.NoPadding)

// newID is random rather than sequential. An id that counts tells every visitor
// how many notes the wall has ever had, including the ones that were deleted.
func newID() string {
	var b [10]byte
	if _, err := rand.Read(b[:]); err != nil {
		// crypto/rand does not fail in practice, and a note without an id is
		// worse than a note with a time-based one.
		return strings.ToLower(fmt.Sprintf("t%015x", time.Now().UnixNano()))
	}
	return encoding.EncodeToString(b[:])
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
