package moderation

import (
	"strings"
	"unicode"
)

// Normalising is what makes a word list worth having. Matching raw text catches
// nobody: the first person who wants through writes "p0rr@", "c a r a l h o" or
// "caraaaalho", and a list of plain words sees three strings it has never heard
// of.
//
// Two forms come out of it, because the two jobs pull in opposite directions:
//
//	Words    keeps the spaces, so a term can be matched on its own boundaries.
//	         Low false positives. This is the form allowed to block outright.
//	Squashed drops everything that is not a letter or digit, so evasion by
//	         punctuation and spacing collapses back to the word. High false
//	         positives, so a hit here never blocks by itself — it escalates.
type Normalized struct {
	Words    string
	Squashed string
}

// Characters that exist to be invisible. Left in place they break every match
// in this file, and they have no business in a 140-character note.
var invisible = map[rune]bool{
	0x200b: true, // zero width space
	0x200c: true, // zero width non-joiner
	0x200d: true, // zero width joiner
	0x2060: true, // word joiner
	0xfeff: true, // byte order mark
	0x00ad: true, // soft hyphen
	0x180e: true, // mongolian vowel separator
	0x034f: true, // combining grapheme joiner
}

// The substitutions people actually use, split by how much damage getting it
// wrong does.
//
// These are safe anywhere: as characters they hardly ever end a word in an
// ordinary sentence, so reading them as letters costs nothing.
var leet = map[rune]rune{
	'0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't',
	'@': 'a', '$': 's', '|': 'i',
}

// These are punctuation first and substitutions second. "trabalho!" must not
// become "trabalhoi", so they only count when letters stand on both sides,
// which is the only place anybody writes "b!tch" anyway.
var innerLeet = map[rune]rune{
	'!': 'i', '*': 'a', '+': 't',
}

// Accent folding for the letters Portuguese actually uses, done by hand so the
// service carries no text-processing dependency for eleven characters.
var accents = map[rune]rune{
	'á': 'a', 'à': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a',
	'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
	'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i',
	'ó': 'o', 'ò': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o',
	'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u',
	'ç': 'c', 'ñ': 'n', 'ý': 'y',
}

func Normalize(input string) Normalized {
	runes := []rune(strings.ToLower(input))

	var words strings.Builder
	words.Grow(len(input))

	var previous rune = -1
	for i, r := range runes {
		if invisible[r] || unicode.IsControl(r) {
			continue
		}
		if folded, ok := accents[r]; ok {
			r = folded
		}
		if mapped, ok := leet[r]; ok {
			r = mapped
		} else if mapped, ok := innerLeet[r]; ok && betweenLetters(runes, i) {
			r = mapped
		}
		if !unicode.IsLetter(r) && !unicode.IsDigit(r) {
			r = ' '
		}
		// Collapse runs: "caraaaalho" and "caralho" must reach the list as the
		// same string, and so must "hello    world".
		if r == previous {
			continue
		}
		words.WriteRune(r)
		previous = r
	}

	spaced := strings.Join(strings.Fields(words.String()), " ")

	var squashed strings.Builder
	squashed.Grow(len(spaced))
	for _, r := range spaced {
		if r != ' ' {
			squashed.WriteRune(r)
		}
	}

	return Normalized{Words: spaced, Squashed: squashed.String()}
}

// betweenLetters reports whether the nearest visible neighbour on each side is
// a letter, so a substitution that is usually punctuation only applies where a
// letter was plainly meant.
func betweenLetters(runes []rune, i int) bool {
	return nearestIsLetter(runes, i, -1) && nearestIsLetter(runes, i, 1)
}

func nearestIsLetter(runes []rune, i, step int) bool {
	for j := i + step; j >= 0 && j < len(runes); j += step {
		if invisible[runes[j]] {
			continue
		}
		return unicode.IsLetter(runes[j])
	}
	return false
}

// ContainsWord reports whether term appears in the spaced form on its own
// boundaries, so "assado" does not match a list entry of "ass".
func ContainsWord(haystack, term string) bool {
	if term == "" {
		return false
	}

	offset := 0
	for {
		index := strings.Index(haystack[offset:], term)
		if index < 0 {
			return false
		}
		start := offset + index
		end := start + len(term)

		beforeOK := start == 0 || haystack[start-1] == ' '
		afterOK := end == len(haystack) || haystack[end] == ' '
		if beforeOK && afterOK {
			return true
		}

		offset = start + 1
		if offset >= len(haystack) {
			return false
		}
	}
}
