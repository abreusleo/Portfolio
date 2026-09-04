/**
 * The message wall.
 *
 * The service is `server/recados/`; the design and the reasoning are in
 * docs/recados.md. Everything here is about the browser half.
 *
 * The base URL comes from the environment because the room is a static site on
 * one host and the service is on another: there is no sensible default, and a
 * wrong one would be a mystery instead of an error. With it unset the wall
 * simply does not appear, and the room is exactly as complete as it was — the
 * same rule the downloaded models follow.
 */
export const api = String(import.meta.env.VITE_RECADOS_API ?? '').replace(/\/+$/, '')

export const enabled = api !== ''

/** Matches the service: 140 runes, refused past that on the server anyway. */
export const MAX_LENGTH = 140

/** Same again for the signature, which is optional. */
export const MAX_NAME_LENGTH = 24

/**
 * How many go on the door.
 *
 * Measured, not chosen. A note is 8.6 cm square and sits at an angle, so two of
 * them need their centres a diagonal apart to be sure they never touch at any
 * angle. Dropping notes at random on a door this size and refusing every
 * overlap saturates at 36 on average. The server holds the same number and is
 * the one that decides; this copy is what lets the room know the door is full
 * before it asks.
 *
 * A note leaves the door when 36 newer ones have arrived, not when a clock runs
 * out. How long it stays in the database is a different question and lives on
 * the server.
 */
export const WALL_SIZE = 36

/**
 * The paper.
 *
 * One colour, and it is the colour of the card the visitor writes on. There
 * were six, picked per note from its id, and the wall read as a bag of sweets:
 * you wrote on a yellow post-it and a grey one appeared. A note that comes out
 * a different colour from the one you filled in is a small lie about what just
 * happened.
 */
export const PAPER = '#f2e6a8'

/**
 * Where the notes live on the door leaf, clear of the handle.
 *
 * `x`, `y` and `z` place the rectangle in the room. `width` and `height` are
 * the rectangle itself, and a note's centre is bounded by half a note inside
 * it so no corner hangs off the door.
 *
 * These numbers are duplicated in server/recados/internal/httpapi/server.go,
 * which validates every position against them. They describe one physical
 * door: changing one side alone puts notes through the frame.
 */
export const wall = {
    x: -2.58,
    y: 1.34,
    z: -2.944,
    width: 0.72,
    height: 1.24,
    note: 0.086,
}

/**
 * The closest two centres may sit.
 *
 * A tilted square of side s fits inside a circle of diameter s*sqrt(2), so
 * holding centres that far apart means no two notes touch at any angle either
 * of them happens to have.
 */
export const MIN_DIST = wall.note * Math.SQRT2

/** How far a note's centre may stray from the middle of the rectangle. */
export const bounds = {
    x: (wall.width - wall.note) / 2,
    y: (wall.height - wall.note) / 2,
}

/** True when nothing new can be placed without covering something. */
export function collides(x, y, taken, minDist = MIN_DIST)
{
    return taken.some((p) => (x - p.x) ** 2 + (y - p.y) ** 2 < minDist * minDist)
}

/**
 * A free centre near the one asked for, or null when the door is full.
 *
 * Walks outwards in rings from the wanted point, so a visitor who lets go over
 * an occupied patch gets the closest gap rather than a random one. The step is
 * a tenth of a note, matching the grid the server sweeps.
 */
export function freeSpotNear(x, y, taken, minDist = MIN_DIST)
{
    const step = 0.008
    const clamp = (v, limit) => Math.max(-limit, Math.min(limit, v))

    for (let ring = 0; ring <= 90; ring++)
    {
        for (let i = -ring; i <= ring; i++)
        {
            for (const [dx, dy] of ring === 0 ? [[0, 0]] : [[i, -ring], [i, ring], [-ring, i], [ring, i]])
            {
                const cx = clamp(x + dx * step, bounds.x)
                const cy = clamp(y + dy * step, bounds.y)
                if (!collides(cx, cy, taken, minDist)) return { x: cx, y: cy }
            }
        }
    }
    return null
}
