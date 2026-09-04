package moderation

import (
	"testing"
)

func newModerator() *Moderator {
	return New(LoadLists("", ""), LoadLexicon(), 140)
}

// U+200B, the zero width space: invisible in every editor and the first
// thing anybody reaches for to break a word list.
var zw = string(rune(0x200b))

func TestNormalizeDefeatsEvasion(t *testing.T) {
	tests := []struct {
		input    string
		words    string
		squashed string
	}{
		{"CARALHO", "caralho", "caralho"},
		{"caraaaalho", "caralho", "caralho"},
		{"c a r a l h o", "c a r a l h o", "caralho"},
		{"c.a.r.a.l.h.o", "c a r a l h o", "caralho"},
		{"p0rr@", "pora", "pora"},
		{"Ótimo trabalho!", "otimo trabalho", "otimotrabalho"},
		{"f" + zw + "u" + zw + "c" + zw + "k", "fuck", "fuck"},
	}

	for _, tc := range tests {
		got := Normalize(tc.input)
		if got.Words != tc.words {
			t.Errorf("Normalize(%q).Words = %q, want %q", tc.input, got.Words, tc.words)
		}
		if got.Squashed != tc.squashed {
			t.Errorf("Normalize(%q).Squashed = %q, want %q", tc.input, got.Squashed, tc.squashed)
		}
	}
}

// The Scunthorpe problem: a listed short term must not fire inside a longer,
// innocent word.
func TestContainsWordRespectsBoundaries(t *testing.T) {
	if ContainsWord("carne assada no almoco", "ass") {
		t.Fatal("a short term must not match inside another word")
	}
	if !ContainsWord("voce e um ass", "ass") {
		t.Fatal("a term standing on its own must match")
	}
}

func TestBlockedIsRefused(t *testing.T) {
	m := newModerator()

	decision := m.Check("seu projeto e legal mas voce e um viado")
	if decision.Allowed {
		t.Fatal("a listed slur must be refused")
	}
	if decision.Reason == "" {
		t.Fatal("a refusal needs a reason the author can act on")
	}
}

// Vulgar is not abusive. The suspect list publishes and queues for review
// rather than refusing, because most of what it catches is somebody being
// enthusiastic and nothing here can read a sentence to tell the difference.
func TestVulgarPraiseIsPublishedAndFlagged(t *testing.T) {
	m := newModerator()

	decision := m.Check("que porra boa ficou esse quarto")
	if !decision.Allowed {
		t.Fatal("vulgar praise should reach the wall")
	}
	if !decision.Flagged {
		t.Fatal("a suspect term must queue the note for review")
	}
	if decision.Sentiment != SentimentPositive {
		t.Fatalf("sentiment = %q, want positive", decision.Sentiment)
	}
}

// There is no network in the write path any more. Nothing about a note's fate
// depends on anything outside this process, which is the whole point of having
// taken the model out.
func TestOrdinaryNoteNeedsNothingExternal(t *testing.T) {
	m := newModerator()

	clean := m.Check("passei so pra dizer que ficou otimo")
	if !clean.Allowed {
		t.Fatal("an ordinary note must pass")
	}
	if clean.Flagged {
		t.Fatal("an ordinary note must not be queued for review")
	}
	if clean.Sentiment != SentimentPositive {
		t.Fatalf("sentiment = %q, want positive", clean.Sentiment)
	}
}

func TestShapeRules(t *testing.T) {
	m := newModerator()

	tests := []struct {
		name string
		text string
	}{
		{"empty", "   "},
		{"too long", repeat("ab ", 60)},
		{"link", "olha meu site legal-demais.com"},
		{"bare url", "https://exemplo.io"},
		{"no letters", "12345 !!! 678"},
		{"mostly symbols", "a >>>>> <<<<< ##### $$$$$ %%%%%"},
		{"held key", "boaaaaaaaaaaa"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if d := m.Check(tc.text); d.Allowed {
				t.Fatalf("%q should be refused by the shape rules", tc.text)
			}
		})
	}
}

func TestOrdinaryNotePasses(t *testing.T) {
	m := newModerator()

	decision := m.Check("cheguei aqui pelo Twitter, o quarto ficou lindo")
	if !decision.Allowed {
		t.Fatalf("an ordinary note must pass, got %q", decision.Reason)
	}
	if decision.Flagged {
		t.Fatal("a clean note must not be queued for review")
	}
}

// What the local pipeline cannot do, written down so nobody is surprised by
// it later. A word list has no idea what a sentence means, and the lexicon
// sums terms without reading around them, so a negation flips the meaning and
// not the score. The answer to this is the admin list, not a model in the
// request path.
func TestKnownBlindSpots(t *testing.T) {
	m := newModerator()

	if d := m.Check("nao gostei nada disso aqui"); d.Sentiment != SentimentPositive {
		t.Skip("negation is now handled; delete this test and say so")
	} else {
		t.Log("known: 'nao gostei' scores positive, because 'gostei' is in the lexicon")
	}

	if d := m.Check("your portfolio is worthless and so are you"); !d.Allowed {
		t.Skip("English abuse is now caught; delete this test and say so")
	} else {
		t.Log("known: abuse in a language the list does not cover is published")
	}
}

func repeat(s string, n int) string {
	out := ""
	for range n {
		out += s
	}
	return out
}

// A signature is judged on its own terms. It may be missing, it may be two
// letters, and it may be punctuation, none of which a message may be.
func TestNameRules(t *testing.T) {
	m := newModerator()

	for _, ok := range []string{"", "Leo", "jú", "Ana Maria", "x_x"} {
		if reason, allowed := m.CheckName(ok); !allowed {
			t.Errorf("CheckName(%q) recusou: %s", ok, reason)
		}
	}

	for _, bad := range []string{
		"um nome absurdamente longo que nao cabe",
		"veja meu site legal-demais.com",
		"viado",
	} {
		if _, allowed := m.CheckName(bad); allowed {
			t.Errorf("CheckName(%q) deveria recusar", bad)
		}
	}
}
