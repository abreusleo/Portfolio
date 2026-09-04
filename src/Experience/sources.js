/**
 * External assets, loaded by Utils/Resources.js.
 *
 * The room is complete without any of these: every one of them replaces a
 * procedural blockout that is already standing. Where each one goes, and at
 * what size, is in config/models.js.
 */
const base = import.meta.env.BASE_URL

export default [
    { name: 'chair', type: 'gltfModel', path: `${base}models/Chair.glb` },
    { name: 'keyboard', type: 'gltfModel', path: `${base}models/Keyboard.glb` },
    { name: 'mouse', type: 'gltfModel', path: `${base}models/Mouse.glb` },
    { name: 'desklamp', type: 'gltfModel', path: `${base}models/DeskLamp.glb` },
    { name: 'redeemer', type: 'gltfModel', path: `${base}models/ChristTheRedeemer.glb` },
    { name: 'funko', type: 'gltfModel', path: `${base}models/FunkoPop.glb` },
    { name: 'ball', type: 'gltfModel', path: `${base}models/SoccerBall.glb` },
    { name: 'ps5', type: 'gltfModel', path: `${base}models/PS5Controller.glb` },
    { name: 'macbook', type: 'gltfModel', path: `${base}models/Macbook.glb` },
    { name: 'earphones', type: 'gltfModel', path: `${base}models/EarPhones.glb` },
    { name: 'books', type: 'gltfModel', path: `${base}models/Books.glb` },
    { name: 'gamepad', type: 'gltfModel', path: `${base}models/Controller.glb` },
    { name: 'flag', type: 'gltfModel', path: `${base}models/Brazil.glb` },
    { name: 'trophy', type: 'gltfModel', path: `${base}models/Trophy.glb` },
    { name: 'stanley', type: 'gltfModel', path: `${base}models/Stanley.glb` },
    { name: 'paperstack', type: 'gltfModel', path: `${base}models/PaperStack.glb` },
    { name: 'pen', type: 'gltfModel', path: `${base}models/Pen.glb` },
]
