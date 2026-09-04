// Package moderation decides whether a note goes on the wall and what tone it
// carries.
//
// Every gate runs inside the POST, before the row exists, and every one of
// them is local: no network call, no provider, no key. The order is cheapest
// first, and each stage only sees text the stage before it let through:
//
//  1. shape     length, links, letters. Microseconds.
//  2. word list slurs refuse outright; vulgarity is published for review.
//  3. lexicon   scores the tone of what is left.
//
// There was a model here, one call per note inside the request. It was removed
// on purpose. A note is untrusted text, and sending it to a provider put a
// six-second network call in the write path of a wall that anyone can write
// to; worse, when the provider was slow or out of quota the pipeline published
// anyway. A safety gate that opens under load is not a safety gate, and the
// load it opened under was exactly the traffic that would attack the wall.
//
// What that costs is real and worth naming: nothing here reads a sentence.
// Abuse that avoids the list — a new word, another language, an insult phrased
// politely — is published. The answer to that is the admin list, not a model
// in the request path.
package moderation

import (
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"
)

const (
	SentimentPositive = "positive"
	SentimentNeutral  = "neutral"
	SentimentNegative = "negative"
)

// Decision is what the handler acts on.
type Decision struct {
	Allowed   bool
	Reason    string // shown to the author, in Portuguese, only when refused
	Sentiment string

	// Flagged marks a note that tripped the suspect list. It is published like
	// any other and listed first for review, because the suspect list is a
	// list of words that are usually fine and occasionally are not, and
	// nothing here can tell those two apart.
	Flagged bool
}

type Moderator struct {
	lists    *Lists
	lexicon  Lexicon
	maxRunes int
}

func New(lists *Lists, lexicon Lexicon, maxRunes int) *Moderator {
	return &Moderator{lists: lists, lexicon: lexicon, maxRunes: maxRunes}
}

// A bare domain is still a link. Requiring letters after the dot keeps version
// numbers and prices out of it.
var linkPattern = regexp.MustCompile(`(?i)(https?://|www\.|[a-z0-9][a-z0-9-]{1,}\.(com|net|org|io|dev|app|xyz|info|link|br|co|me|ru|cn|tk|gg|tv|shop|site|online)\b)`)

func (m *Moderator) Check(text string) Decision {
	if reason, ok := m.checkShape(text); !ok {
		return Decision{Reason: reason}
	}

	normalized := Normalize(text)

	if _, blocked := m.lists.Blocked(normalized); blocked {
		// The matched term is deliberately not echoed back. Naming it turns
		// the refusal into a probe: send a word, read the answer, learn the
		// list one request at a time.
		return Decision{Reason: "Esse recado tem ofensa. Reescreva sem ela."}
	}

	// A suspect term is published and queued for review rather than refused.
	// The list is vulgarity, not slurs, and most of it is somebody being
	// enthusiastic. Refusing all of it would have turned "que porra linda de
	// quarto" into an error message, and the author would never know why.
	return Decision{
		Allowed:   true,
		Sentiment: m.lexicon.Sentiment(normalized),
		Flagged:   m.lists.Suspect(normalized),
	}
}

// MaxNameRunes is short on purpose. A signature is a first name or a handle,
// and a field long enough for a sentence invites one.
const MaxNameRunes = 24

// CheckName judges the signature, which is not judged the same way as the
// message. It may be empty, because signing is optional, and it is held to the
// block list but not to the shape rules: a name is allowed to be two letters,
// or to be mostly punctuation, in a way a message is not.
func (m *Moderator) CheckName(name string) (string, bool) {
	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return "", true
	}
	if utf8.RuneCountInString(trimmed) > MaxNameRunes {
		return "Esse nome é longo demais.", false
	}
	if linkPattern.MatchString(trimmed) {
		return "Sem links no nome.", false
	}
	if _, blocked := m.lists.Blocked(Normalize(trimmed)); blocked {
		return "Escolha outro nome.", false
	}
	return "", true
}

func (m *Moderator) checkShape(text string) (string, bool) {
	trimmed := strings.TrimSpace(text)

	if trimmed == "" {
		return "Escreva alguma coisa antes de colar.", false
	}
	if utf8.RuneCountInString(trimmed) > m.maxRunes {
		return "Recado longo demais. Corte um pouco.", false
	}
	if linkPattern.MatchString(trimmed) {
		return "Sem links, por favor.", false
	}

	letters, runes, longestRun, run := 0, 0, 1, 1
	var previous rune = -1
	for _, r := range trimmed {
		runes++
		if unicode.IsLetter(r) {
			letters++
		}
		if r == previous {
			run++
			if run > longestRun {
				longestRun = run
			}
		} else {
			run = 1
		}
		previous = r
	}

	if letters < 3 {
		return "Escreva um recado de verdade.", false
	}
	// Mostly symbols means art, spam or a layout test, none of which are a
	// message to anybody.
	if letters*4 < runes {
		return "Escreva um recado de verdade.", false
	}
	if longestRun > 6 {
		return "Sem repetir caractere assim.", false
	}

	return "", true
}
