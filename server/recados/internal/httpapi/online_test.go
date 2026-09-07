package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func getOnline(t *testing.T, handler http.Handler, remote string) (*httptest.ResponseRecorder, int) {
	t.Helper()

	r := httptest.NewRequest(http.MethodGet, "/api/online", nil)
	r.RemoteAddr = remote
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)

	var body struct {
		Online int `json:"online"`
	}
	if w.Code == http.StatusOK {
		if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
			t.Fatalf("decode: %v (%s)", err, w.Body.String())
		}
	}
	return w, body.Online
}

func TestOnlineCountsCallers(t *testing.T) {
	_, handler := newTestServer(t)

	w, n := getOnline(t, handler, "1.1.1.1:5000")
	if w.Code != http.StatusOK {
		t.Fatalf("status: got %d, want 200", w.Code)
	}
	if n != 1 {
		t.Fatalf("first caller: got %d, want 1", n)
	}

	// The same person again is still one person.
	if _, n = getOnline(t, handler, "1.1.1.1:5001"); n != 1 {
		t.Fatalf("same address again: got %d, want 1", n)
	}

	if _, n = getOnline(t, handler, "2.2.2.2:5000"); n != 2 {
		t.Fatalf("second caller: got %d, want 2", n)
	}
}

// The number changes every minute, so anything that caches it is serving a
// wrong one.
func TestOnlineIsNotCacheable(t *testing.T) {
	_, handler := newTestServer(t)

	w, _ := getOnline(t, handler, "3.3.3.3:5000")
	if got := w.Header().Get("Cache-Control"); got != "no-store" {
		t.Fatalf("Cache-Control: got %q, want %q", got, "no-store")
	}
}

// It is called cross-origin from GitHub Pages like everything else here, so it
// has to carry the same header the notes do or the page cannot read it.
func TestOnlineAnswersCrossOrigin(t *testing.T) {
	_, handler := newTestServer(t)

	r := httptest.NewRequest(http.MethodGet, "/api/online", nil)
	r.RemoteAddr = "4.4.4.4:5000"
	r.Header.Set("Origin", "https://leo-abreu.com")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)

	if got := w.Header().Get("Access-Control-Allow-Origin"); got != "https://leo-abreu.com" {
		t.Fatalf("allow-origin: got %q", got)
	}
}

// It shares the read budget with the wall, which is what stops a page polling
// in a tight loop from being cheaper than one asking politely.
func TestOnlineIsRateLimited(t *testing.T) {
	_, handler := newTestServer(t)

	var last *httptest.ResponseRecorder
	for range 80 {
		last, _ = getOnline(t, handler, "5.5.5.5:5000")
	}
	if last.Code != http.StatusTooManyRequests {
		t.Fatalf("after 80 calls: got %d, want 429", last.Code)
	}
}
