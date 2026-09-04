// Package httpapi is the surface the wall talks to.
//
// One thing here is unlike every other application on this VPS: it is called
// cross-origin. The portfolio is a static site on GitHub Pages and this
// service is on the box, so the browser will not let the page read the answer
// without being told, explicitly and by name, which origins are allowed. Hub's
// pattern of "no CORS at all, everything is same-origin" cannot apply.
//
// The saving grace is that there is nothing to steal: no cookie, no session,
// no credentials, so Access-Control-Allow-Credentials never appears and a
// forged request from another page gains its author exactly one anonymous
// note, which they could have posted anyway.
package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"recados/internal/config"
	"recados/internal/geo"
	"recados/internal/moderation"
	"recados/internal/store"
)

type Server struct {
	cfg       config.Config
	store     *store.Store
	geo       *geo.Resolver
	moderator *moderation.Moderator
	log       *slog.Logger

	readLimit  *Limiter
	writeLimit *Limiter
	dailyWrite Rule
}

// The windows. Reading is generous; writing is not, because a note is meant to
// be thought about.
//
// Only the burst window lives in memory. The daily limit used to sit here too,
// and because a window holds its keys for its whole length, that one map held
// a full day of addresses and hit its cap at the twenty-thousandth visitor of
// the day. Everyone after that was refused a note they had never written. The
// daily count is read from the rows instead, in createNote, which is both
// restart-proof and leaves this map holding ten minutes of writers.
var readRules = []Rule{
	{Max: 60, Window: time.Minute},
}

// The door, in metres, as src/Experience/config/notes.js draws it. A note is
// 0.086 square and may be tilted, so centres are held 0.086*sqrt(2) apart and
// no two can touch at any angle. Both files describe the same physical wall;
// changing one without the other puts notes through the door frame.
const (
	wallWidth  = 0.72
	wallHeight = 1.24
	noteSize   = 0.086
	minDist    = noteSize * 1.4142135623730951
)

func (s *Server) wall() store.Wall {
	return store.Wall{
		Capacity: s.cfg.WallSize,
		MinDist:  minDist,
		HalfW:    (wallWidth - noteSize) / 2,
		HalfH:    (wallHeight - noteSize) / 2,
	}
}

func New(cfg config.Config, st *store.Store, resolver *geo.Resolver, moderator *moderation.Moderator, log *slog.Logger) *Server {
	return &Server{
		cfg:        cfg,
		store:      st,
		geo:        resolver,
		moderator:  moderator,
		log:        log,
		readLimit:  NewLimiter(0, readRules...),
		writeLimit: NewLimiter(0, Rule{Max: 1, Window: cfg.WriteEvery}),
		dailyWrite: Rule{Max: cfg.WritePerDay, Window: 24 * time.Hour},
	}
}

func (s *Server) Close() {
	s.readLimit.Close()
	s.writeLimit.Close()
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/notes", s.listNotes)
	mux.HandleFunc("POST /api/notes", s.createNote)
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	// Admin, reached only through the Hub gate. See the Caddyfile block in the
	// README: the public host never routes these paths, and the protected one
	// hands over a Remote-User this service checks against its own list.
	mux.HandleFunc("GET /admin/notes", s.adminList)
	mux.HandleFunc("DELETE /admin/notes/{id}", s.adminDelete)

	return s.withCORS(mux)
}

// ---------------------------------------------------------------------------

type noteResponse struct {
	ID        string  `json:"id"`
	Text      string  `json:"text"`
	Name      string  `json:"name"`
	Country   string  `json:"country"`
	Sentiment string  `json:"sentiment"`
	CreatedAt string  `json:"created_at"`
	X         float64 `json:"x"`
	Y         float64 `json:"y"`
}

func toResponse(n store.Note) noteResponse {
	return noteResponse{
		ID:        n.ID,
		Text:      n.Text,
		Name:      n.Name,
		Country:   n.Country,
		Sentiment: n.Sentiment,
		CreatedAt: n.CreatedAt.Format(time.RFC3339),
		X:         n.X,
		Y:         n.Y,
	}
}

func (s *Server) listNotes(w http.ResponseWriter, r *http.Request) {
	addr := ClientIP(r, s.cfg.TrustedProxies)
	if verdict, retry := s.readLimit.Allow(addr.String()); verdict != Allowed {
		s.refuse(w, verdict, retry)
		return
	}

	limit := s.cfg.WallSize
	if raw := r.URL.Query().Get("limit"); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil && n > 0 && n < limit {
			limit = n
		}
	}

	notes, err := s.store.Recent(r.Context(), limit)
	if err != nil {
		s.log.Error("list notes", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "erro interno"})
		return
	}

	out := make([]noteResponse, 0, len(notes))
	for _, note := range notes {
		out = append(out, toResponse(note))
	}

	writeJSON(w, http.StatusOK, map[string]any{"notes": out})
}

type createRequest struct {
	Text string `json:"text"`

	// Who signed it. Optional, and judged on its own terms; see CheckName.
	Name string `json:"name"`

	// Where the visitor dropped it, in metres from the centre of the wall.
	// A wish, not an instruction: the store clamps it to the door, refuses it
	// if it lands on somebody, and ignores it entirely when the door is full.
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

func (s *Server) createNote(w http.ResponseWriter, r *http.Request) {
	addr := ClientIP(r, s.cfg.TrustedProxies)

	if verdict, retry := s.writeLimit.Allow(addr.String()); verdict != Allowed {
		s.refuse(w, verdict, retry)
		return
	}

	// The in-memory limiter above is fast and forgets on restart. This one
	// reads the rows, so a redeploy does not hand everybody a fresh quota, and
	// it is where the daily limit lives now.
	fingerprint := s.store.Fingerprint(addr)
	if count, err := s.store.CountSince(r.Context(), fingerprint, time.Now().Add(-s.dailyWrite.Window)); err == nil && count >= s.dailyWrite.Max {
		s.refuse(w, OverLimit, s.dailyWrite.Window)
		return
	}

	var body createRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "corpo inválido"})
		return
	}

	text := strings.TrimSpace(body.Text)
	decision := s.moderator.Check(text)
	if !decision.Allowed {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": decision.Reason})
		return
	}

	name := strings.TrimSpace(body.Name)
	if reason, ok := s.moderator.CheckName(name); !ok {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": reason})
		return
	}

	note, replaced, err := s.store.Place(r.Context(), store.Note{
		Text:      text,
		Name:      name,
		Country:   s.geo.Country(r, addr),
		Sentiment: decision.Sentiment,
		Flagged:   decision.Flagged,
		X:         body.X,
		Y:         body.Y,
	}, fingerprint, s.wall())

	if errors.Is(err, store.ErrSpotTaken) {
		// Somebody else took that gap between the browser drawing it free and
		// this request arriving. The door still has room, so the answer is
		// pick again, not try later.
		writeJSON(w, http.StatusConflict, map[string]string{
			"error": "Alguém colou um recado nesse lugar. Escolha outro ponto.",
		})
		return
	}
	if err != nil {
		s.log.Error("place note", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "erro interno"})
		return
	}

	s.log.Info("note published", "id", note.ID, "country", note.Country,
		"sentiment", note.Sentiment, "flagged", note.Flagged, "replaced_oldest", replaced)

	writeJSON(w, http.StatusCreated, map[string]any{"note": toResponse(note)})
}

// ---------------------------------------------------------------------------

func (s *Server) adminList(w http.ResponseWriter, r *http.Request) {
	if !s.isOperator(r) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
		return
	}

	notes, err := s.store.Recent(r.Context(), 500)
	if err != nil {
		s.log.Error("admin list", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "erro interno"})
		return
	}

	type adminNote struct {
		noteResponse
		Flagged bool `json:"flagged"`
	}

	out := make([]adminNote, 0, len(notes))
	for _, note := range notes {
		out = append(out, adminNote{noteResponse: toResponse(note), Flagged: note.Flagged})
	}

	writeJSON(w, http.StatusOK, map[string]any{"notes": out})
}

func (s *Server) adminDelete(w http.ResponseWriter, r *http.Request) {
	if !s.isOperator(r) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
		return
	}

	deleted, err := s.store.Delete(r.Context(), r.PathValue("id"))
	if err != nil {
		s.log.Error("admin delete", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "erro interno"})
		return
	}
	if !deleted {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "não encontrado"})
		return
	}

	s.log.Info("note deleted", "id", r.PathValue("id"), "by", r.Header.Get("Remote-User"))
	w.WriteHeader(http.StatusNoContent)
}

// isOperator trusts Remote-User, and can only do so because of where the
// header comes from: Caddy strips whatever the client sent, hub-auth vouches,
// and Caddy writes it back. The same assertion Cal, Orbis and Lvl are built
// on. It holds exactly as long as this service is unreachable except through
// that gate, which is why it publishes no port of its own.
func (s *Server) isOperator(r *http.Request) bool {
	user := strings.TrimSpace(r.Header.Get("Remote-User"))
	if user == "" {
		return false
	}
	for _, admin := range s.cfg.Admins {
		if strings.EqualFold(admin, user) {
			return true
		}
	}
	return false
}

// ---------------------------------------------------------------------------

func (s *Server) withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")

		if origin != "" && s.originAllowed(origin) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			w.Header().Set("Access-Control-Max-Age", "86400")
		}

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func (s *Server) originAllowed(origin string) bool {
	for _, allowed := range s.cfg.Origins {
		if strings.EqualFold(allowed, origin) {
			return true
		}
	}
	return false
}

// refuse answers a limiter verdict. The two reasons get different codes and
// different sentences on purpose: one is the caller's own doing and the other
// is the service admitting it is holding all it can. Telling somebody who has
// never written that they already wrote is the kind of bug nobody reports,
// because it reads like a rule they misunderstood.
func (s *Server) refuse(w http.ResponseWriter, verdict Verdict, retry time.Duration) {
	seconds := int(retry.Seconds())
	if seconds < 1 {
		seconds = 1
	}
	w.Header().Set("Retry-After", strconv.Itoa(seconds))

	if verdict == AtCapacity {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{
			"error":       "O mural está com muita gente agora. Tente daqui a pouco.",
			"retry_after": seconds,
		})
		return
	}

	writeJSON(w, http.StatusTooManyRequests, map[string]any{
		"error":       "Você já deixou um recado agora há pouco.",
		"retry_after": seconds,
	})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

// PurgeLoop deletes notes past their retention.
//
// This is the only thing that removes a note, and it is worth being clear about
// what it is not: it is not how a note leaves the door. The door shows the
// newest few and a note slides off it when newer ones arrive, which is why a
// quiet week still shows a full wall. This is only the promise that a
// stranger's message is not kept forever.
func PurgeLoop(ctx context.Context, st *store.Store, retention time.Duration, log *slog.Logger) {
	if retention <= 0 {
		log.Warn("note retention is off: notes are kept forever")
		return
	}

	ticker := time.NewTicker(time.Hour)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			n, err := st.Purge(ctx, retention)
			if err != nil && !errors.Is(err, context.Canceled) {
				log.Error("purge notes", "error", err)
				continue
			}
			if n > 0 {
				log.Info("notes purged", "rows", n)
			}
		}
	}
}

// ForgetLoop wipes stored fingerprints once they are older than the longest
// window they could still answer for.
func ForgetLoop(ctx context.Context, st *store.Store, retention time.Duration, log *slog.Logger) {
	ticker := time.NewTicker(time.Hour)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			n, err := st.ForgetAddresses(ctx, retention)
			if err != nil && !errors.Is(err, context.Canceled) {
				log.Error("forget addresses", "error", err)
				continue
			}
			if n > 0 {
				log.Info("addresses forgotten", "rows", n)
			}
		}
	}
}
