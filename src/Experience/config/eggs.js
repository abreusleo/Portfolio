/**
 * The hidden things, and where they are.
 *
 * Each entry becomes a small invisible plate in the room. The plate itself is
 * never drawn, so nothing on screen marks the spot, but the cursor does turn
 * over it: enough of a tell that a visitor who happens to sweep past knows to
 * press, and not so much that the room hands out a map.
 *
 * Two ways to place one, and the first is the safer:
 *
 *  - `position` puts a plate at those coordinates in metres. It exists whether
 *    or not any model loaded, which is why the ones below use it.
 *  - `attach` names an object already in the scene and wraps the plate around
 *    it. Convenient, but an entry that names a model which failed to download
 *    simply will not be there.
 *
 * `size` is the plate in metres, `rotationY` turns it off the default facing
 * of +Z (into the room). Keep them small. A plate a visitor cannot miss is not
 * hidden, and a plate the size of a wall makes every other click feel loaded.
 *
 * Adding one is this file and nothing else. Removing one leaves any visitor
 * who already found it holding a count for something that no longer exists,
 * which World/Eggs.js handles by only ever counting ids that still appear
 * here.
 *
 * One rule when choosing a spot: keep it off the clickable things. A plate on
 * top of a hotspot swallows that hotspot's first click, and it inherits the
 * pointer cursor, which is the room quietly telling everybody where to look.
 * Interactions.js warns in the console when an egg lands on one, so put a spot
 * in, open the room, and check.
 *
 * The two below are placeholders in free space, chosen only to prove the
 * mechanism. Move them wherever the good jokes are.
 */
export default [
    {
        id: 'mug',
        // The steel tumbler on the desk, right of the keyboard.
        position: [2.28, 0.84, -2.3],
        size: [0.09, 0.11],
    },
    {
        id: 'console',
        // The console standing on the credenza, under the television.
        position: [3.2, 0.8, -0.66],
        rotationY: -Math.PI / 2,
        size: [0.12, 0.16],
    },
]
