import { deskTop } from './layout.js'

/**
 * Downloaded models, and where each one stands in the room.
 *
 * A model off the internet arrives at a scale and an origin its author chose,
 * never the ones this scene uses: the Christ souvenir is 4 metres tall, the
 * mouse is measured in centimetres, and the Funko's origin sits a metre and a
 * half away from the model itself. So nothing here is trusted except the
 * geometry — `fit` names one axis and the size it should be in metres, and the
 * loader scales and re-centres the model to match, bottom of the bounding box
 * on the floor of the placement.
 *
 * `replaces` names the procedural blockout the model takes over from. The
 * blockout stays in the code and stays in the scene until the file has
 * actually loaded, so a missing or broken model leaves a room with a slightly
 * blockier chair rather than a hole.
 */
export default {
    chair: {
        source: 'chair',
        replaces: 'blockout.chair',
        position: [1.55, 0, -1.45],
        rotationY: Math.PI + 0.22,
        fit: { axis: 'y', size: 1.16 },
    },

    keyboard: {
        source: 'keyboard',
        replaces: 'blockout.keyboard',
        position: [1.52, deskTop, -2.34],
        rotationY: 0,
        fit: { axis: 'x', size: 0.4 },
    },

    mouse: {
        source: 'mouse',
        replaces: 'blockout.mouse',
        position: [1.95, deskTop, -2.34],
        rotationY: 0.15,
        fit: { axis: 'z', size: 0.115 },
    },

    desklamp: {
        source: 'desklamp',
        replaces: 'blockout.desklamp',
        position: [3.32, deskTop, -1.5],
        // Facing the laptop, which is at a smaller x. It was turned the other
        // way and lighting the wall.
        rotationY: Math.PI / 2,
        fit: { axis: 'y', size: 0.54 },
    },

    redeemer: {
        source: 'redeemer',
        replaces: 'blockout.redeemer',
        position: [-0.74, deskTop, -2.78],
        rotationY: 0.2,
        fit: { axis: 'y', size: 0.23 },
    },

    funko: {
        source: 'funko',
        replaces: 'blockout.funko',
        position: [-0.46, deskTop, -2.74],
        rotationY: Math.PI - 0.3,
        fit: { axis: 'y', size: 0.15 },
    },

    ball: {
        source: 'ball',
        replaces: 'blockout.ball',
        position: [-0.19, deskTop, -2.55],
        rotationY: 0.4,
        fit: { axis: 'y', size: 0.11 },
    },

    ps5: {
        source: 'ps5',
        replaces: 'blockout.ps5',
        position: [3.26, 0.6, -0.66],
        rotationY: 0.1,
        fit: { axis: 'y', size: 0.4 },
    },

    // The laptop is the one model with a moving part: its GLB ships an
    // animation that swings the lid, so it gets a controller of its own.
    macbook: {
        source: 'macbook',
        replaces: 'blockout.laptop',
        position: [3.02, deskTop, -1.76],
        rotationY: -0.28,
        fit: { axis: 'x', size: 0.31 },
        behaviour: 'macbook',
        // A flat scrap in the file that hangs well below the laptop. Measuring
        // it put the whole machine in mid-air.
        ignore: ['Object_16'],
    },

    // Earbuds, not headphones: the pair spans about six centimetres, and the
    // tilt goes on the model so the loader still sits them on their own
    // footprint instead of rotating them through the desk.
    earphones: {
        source: 'earphones',
        position: [1.14, deskTop, -2.28],
        rotationX: Math.PI / 2,
        rotationY: Math.PI + 0.45,
        fit: { axis: 'x', size: 0.062 },
    },

    books: {
        source: 'books',
        replaces: 'blockout.books',
        position: [-1.12, deskTop, -2.76],
        rotationY: 0.1,
        fit: { axis: 'x', size: 0.3 },
    },

    // Lying face up on the shelf, exactly as the file ships it.
    gamepad: {
        source: 'gamepad',
        // No tilt at all: the file already rests face up, and every rotation I
        // added was moving it away from that. Confirmed by rendering the sweep
        // rather than reasoning about the file's axes.
        rotationY: 0.18,
        replaces: 'blockout.gamepad',
        // The shelf board is 3.6 cm thick and centred on 1.44, so its surface
        // is at 1.458. The blockout's own 3 cm lift was for a box measured
        // from its middle, and carrying it over left the model in mid-air.
        position: [-0.93, 1.458, -2.8],
        fit: { axis: 'x', size: 0.155 },
    },

    flag: {
        source: 'flag',
        replaces: 'blockout.pennant',
        position: [-0.24, deskTop, -2.86],
        rotationY: 0.12,
        fit: { axis: 'y', size: 0.27 },
    },

    stanley: {
        source: 'stanley',
        replaces: 'blockout.mug',
        position: [2.28, deskTop, -2.36],
        rotationY: -0.6,
        fit: { axis: 'y', size: 0.21 },
        // Its file says BLEND and double-sided for what is a solid steel mug.
        // The floor on roughness takes the mirror off it as well: the room's
        // environment map turns a polished metal into a chrome ball.
        opaque: true,
        roughnessFloor: 0.35,
    },

    paperstack: {
        source: 'paperstack',
        replaces: 'blockout.papers',
        position: [-1.02, deskTop, -2.42],
        rotationY: 0.08,
        fit: { axis: 'z', size: 0.3 },
    },

    pen: {
        source: 'pen',
        // Resting on top of the stack, which is 4.5 cm of paper.
        position: [-1.0, deskTop + 0.046, -2.4],
        rotationY: 0.42,
        fit: { axis: 'x', size: 0.142 },
    },

    trophy: {
        source: 'trophy',
        replaces: 'blockout.trophy',
        position: [0.02, deskTop, -2.74],
        rotationY: -0.15,
        fit: { axis: 'y', size: 0.16 },
    },
}
