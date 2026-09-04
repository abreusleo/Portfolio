/**
 * Room dimensions and shared layout constants (metres).
 * Origin is the centre of the floor. Back wall at -Z, right wall at +X.
 */
export const room = {
    width: 7.0,   // X
    depth: 6,     // Z
    height: 3.0,  // Y
}

export const deskTop = 0.74

/** Back wall split: plaster (with the door) on the left, wood slats on the right. */
export const backWall = {
    slatStart: -1.62,
    doorCenter: -2.5,
    doorWidth: 1.0,
    doorHeight: 2.2,
}

/** Free-fly camera bounds */
export const bounds = {
    minX: -3.2, maxX: 3.2,
    minY: 0.4,  maxY: 2.7,
    minZ: -2.6, maxZ: 2.65,
}
