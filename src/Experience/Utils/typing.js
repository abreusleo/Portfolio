/**
 * Whether the visitor is writing something rather than driving the room.
 *
 * The room listens for bare letters on the document — F to explore, WASD to
 * move — and a note is written in a field sitting on that same document. With
 * nothing in between, the three f's in "fui de fusca ate a festa" take off,
 * and the room flies away under the note while the words keep arriving.
 *
 * Asked of the focused element and not of the composer, so a field added later
 * is covered without anybody having to remember this file.
 */
export function isTyping()
{
    const element = document.activeElement
    if (!element) return false

    return element.tagName === 'INPUT'
        || element.tagName === 'TEXTAREA'
        || element.isContentEditable
}
