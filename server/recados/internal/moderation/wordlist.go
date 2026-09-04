package moderation

import (
	_ "embed"
	"strconv"
	"strings"
)

// Two lists, because vulgar and abusive are not the same thing and treating
// them the same is how a wall ends up rejecting "que porra boa ficou isso".
//
//	block   never belongs on the wall under any reading. Refused outright,
//	        and the model is never asked, because there is nothing to weigh.
//	suspect vulgar, insulting or borderline depending entirely on who it is
//	        aimed at. Never blocks on its own; it tells the model to read
//	        this one strictly.
//
// Both are seeds. They are data, not code, so extending them is editing a text
// file — start from the open list at github.com/LDNOOBW/List-of-Dirty-Naughty-
// Obscene-and-Otherwise-Bad-Words for the long tail.

//go:embed data/block.txt
var blockData string

//go:embed data/suspect.txt
var suspectData string

//go:embed data/sentiment.txt
var sentimentData string

type Lists struct {
	block   []string
	suspect []string

	// Terms long enough that finding them inside a longer run of letters is
	// almost certainly evasion rather than coincidence.
	blockSquashed []string
}

const squashMinLen = 5

func LoadLists(extraBlock, extraSuspect string) *Lists {
	l := &Lists{}

	l.block = normalizeTerms(blockData + "\n" + extraBlock)
	l.suspect = normalizeTerms(suspectData + "\n" + extraSuspect)

	for _, term := range l.block {
		squashed := strings.ReplaceAll(term, " ", "")
		if len(squashed) >= squashMinLen {
			l.blockSquashed = append(l.blockSquashed, squashed)
		}
	}

	return l
}

// Blocked reports a hard match and the term that caused it. The spaced form is
// matched on word boundaries, which keeps "assado" away from a list entry of
// "ass"; the squashed form is matched anywhere, which catches "c a r a l h o",
// but only for terms too long to collide with an innocent word by accident.
func (l *Lists) Blocked(n Normalized) (string, bool) {
	for _, term := range l.block {
		if ContainsWord(n.Words, term) {
			return term, true
		}
	}
	for _, term := range l.blockSquashed {
		if strings.Contains(n.Squashed, term) {
			return term, true
		}
	}
	return "", false
}

// Suspect reports whether the note should be read strictly by the model.
func (l *Lists) Suspect(n Normalized) bool {
	for _, term := range l.suspect {
		if ContainsWord(n.Words, term) || (len(term) >= squashMinLen && strings.Contains(n.Squashed, strings.ReplaceAll(term, " ", ""))) {
			return true
		}
	}
	return false
}

// normalizeTerms runs the list through the very same normaliser the note goes
// through. Without this the two sides never meet: the note arrives collapsed to
// "carona" while the list still holds "caroona", and nothing ever matches.
func normalizeTerms(raw string) []string {
	seen := make(map[string]bool)
	var terms []string

	for _, line := range strings.Split(raw, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		term := Normalize(line).Words
		if term == "" || seen[term] {
			continue
		}
		seen[term] = true
		terms = append(terms, term)
	}

	return terms
}

// Lexicon is the fallback tone reader: a signed score per term, summed. It is
// not good at irony and was never going to be. It exists so that a note still
// gets a label on the day the provider is down.
type Lexicon map[string]int

func LoadLexicon() Lexicon {
	lex := make(Lexicon)

	for _, line := range strings.Split(sentimentData, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}
		score, err := strconv.Atoi(fields[len(fields)-1])
		if err != nil {
			continue
		}
		term := Normalize(strings.Join(fields[:len(fields)-1], " ")).Words
		if term != "" {
			lex[term] = score
		}
	}

	return lex
}

func (l Lexicon) Sentiment(n Normalized) string {
	total := 0
	for term, score := range l {
		if ContainsWord(n.Words, term) {
			total += score
		}
	}

	switch {
	case total > 0:
		return SentimentPositive
	case total < 0:
		return SentimentNegative
	default:
		return SentimentNeutral
	}
}
