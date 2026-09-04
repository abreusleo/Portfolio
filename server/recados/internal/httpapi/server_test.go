package httpapi

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"recados/internal/config"
	"recados/internal/geo"
	"recados/internal/moderation"
	"recados/internal/store"
)

func newTestServer(t *testing.T) (*Server, http.Handler) {
	t.Helper()

	st, err := store.Open(filepath.Join(t.TempDir(), "test.db"), "salt")
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	t.Cleanup(func() { st.Close() })

	resolver, err := geo.Open("", false)
	if err != nil {
		t.Fatalf("open geo: %v", err)
	}

	cfg := config.Config{
		WallSize:    36,
		WriteEvery:  10 * time.Minute,
		WritePerDay: 3,
		Origins:     []string{"https://leo-abreu.com"},
		Admins:      []string{"leonardo"},
	}

	moderator := moderation.New(moderation.LoadLists("", ""), moderation.LoadLexicon(), 140)
	server := New(cfg, st, resolver, moderator, slog.New(slog.NewTextHandler(io.Discard, nil)))
	t.Cleanup(server.Close)

	return server, server.Handler()
}

func post(t *testing.T, handler http.Handler, text, remote string) *httptest.ResponseRecorder {
	t.Helper()
	body := strings.NewReader(`{"text":` + quote(text) + `}`)
	r := httptest.NewRequest(http.MethodPost, "/api/notes", body)
	r.Header.Set("Content-Type", "application/json")
	r.RemoteAddr = remote
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	return w
}

func quote(s string) string {
	b, _ := json.Marshal(s)
	return string(b)
}

func TestPostThenListRoundTrip(t *testing.T) {
	_, handler := newTestServer(t)

	w := post(t, handler, "ficou muito bom o quarto", "203.0.113.9:1111")
	if w.Code != http.StatusCreated {
		t.Fatalf("POST = %d, body %s", w.Code, w.Body.String())
	}

	r := httptest.NewRequest(http.MethodGet, "/api/notes", nil)
	r.RemoteAddr = "198.51.100.1:2222"
	list := httptest.NewRecorder()
	handler.ServeHTTP(list, r)

	if list.Code != http.StatusOK {
		t.Fatalf("GET = %d", list.Code)
	}

	var parsed struct {
		Notes []struct {
			Text      string `json:"text"`
			Sentiment string `json:"sentiment"`
		} `json:"notes"`
	}
	if err := json.Unmarshal(list.Body.Bytes(), &parsed); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(parsed.Notes) != 1 || parsed.Notes[0].Text != "ficou muito bom o quarto" {
		t.Fatalf("wall = %+v", parsed.Notes)
	}
	if parsed.Notes[0].Sentiment != moderation.SentimentPositive {
		t.Fatalf("sentiment = %q", parsed.Notes[0].Sentiment)
	}
}

func TestSecondNoteIsHeld(t *testing.T) {
	_, handler := newTestServer(t)

	if w := post(t, handler, "primeiro recado do dia", "203.0.113.9:1111"); w.Code != http.StatusCreated {
		t.Fatalf("first POST = %d", w.Code)
	}

	w := post(t, handler, "segundo recado logo em seguida", "203.0.113.9:1111")
	if w.Code != http.StatusTooManyRequests {
		t.Fatalf("second POST = %d, want 429", w.Code)
	}
	if w.Header().Get("Retry-After") == "" {
		t.Fatal("a 429 must say when to come back")
	}
}

func TestRefusedNoteAnswersWithAReason(t *testing.T) {
	_, handler := newTestServer(t)

	w := post(t, handler, "olha meu site em exemplo-legal.com", "203.0.113.9:1111")
	if w.Code != http.StatusUnprocessableEntity {
		t.Fatalf("POST = %d, want 422", w.Code)
	}

	var parsed struct {
		Error string `json:"error"`
	}
	json.Unmarshal(w.Body.Bytes(), &parsed)
	if parsed.Error == "" {
		t.Fatal("a refusal must tell the author what to change")
	}
}

func TestCORSNamesTheOriginAndNeverAllowsCredentials(t *testing.T) {
	_, handler := newTestServer(t)

	r := httptest.NewRequest(http.MethodOptions, "/api/notes", nil)
	r.Header.Set("Origin", "https://leo-abreu.com")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)

	if got := w.Header().Get("Access-Control-Allow-Origin"); got != "https://leo-abreu.com" {
		t.Fatalf("allow-origin = %q", got)
	}
	if w.Header().Get("Access-Control-Allow-Credentials") != "" {
		t.Fatal("there is no session here, so credentials must never be allowed")
	}

	other := httptest.NewRequest(http.MethodOptions, "/api/notes", nil)
	other.Header.Set("Origin", "https://alguem-copiando.example")
	ow := httptest.NewRecorder()
	handler.ServeHTTP(ow, other)

	if ow.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Fatal("an origin that is not on the list must not be echoed back")
	}
}

// The admin routes rest entirely on Remote-User, which is only trustworthy
// because Caddy strips whatever the client sent before hub-auth vouches.
func TestAdminNeedsAVouchedOperator(t *testing.T) {
	_, handler := newTestServer(t)

	cases := []struct {
		name string
		user string
		want int
	}{
		{"no header at all", "", http.StatusForbidden},
		{"someone else", "outra-pessoa", http.StatusForbidden},
		{"the operator", "leonardo", http.StatusOK},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			r := httptest.NewRequest(http.MethodGet, "/admin/notes", nil)
			r.RemoteAddr = "172.18.0.3:5555"
			if tc.user != "" {
				r.Header.Set("Remote-User", tc.user)
			}
			w := httptest.NewRecorder()
			handler.ServeHTTP(w, r)

			if w.Code != tc.want {
				t.Fatalf("status = %d, want %d", w.Code, tc.want)
			}
		})
	}
}
