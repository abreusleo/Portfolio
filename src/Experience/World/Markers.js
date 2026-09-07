import * as THREE from 'three'
import gsap from 'gsap'

import Experience from '../Experience.js'
import { quality } from '../Utils/flags.js'

/**
 * Light falling on everything worth pressing.
 *
 * Until now the only thing that said an object was pressable was the mouse
 * cursor, and a phone has no cursor: the room was mute about itself to every
 * visitor holding one.
 *
 * Three attempts came before this one. A ring read as eight orange objects
 * somebody had left lying about. A glow was closer and still wrong, because it
 * was a billboard: a disc that turns to face the camera, floating in front of a
 * wall rather than lying on it. Then a pool that did lie on the wall, but
 * centred and radial, which puts a soft smudge in the middle of the television
 * and reads as a dirty lens.
 *
 * What this is now is the light over a painting in a gallery. Small, hard to
 * mistake for anything else, and the warm yellow of a halogen rather than the
 * colour of the decor: a real fixture does not change bulbs to match the wall.
 * It hangs just over the top edge of the thing and pools there, lying on the
 * surface and taking its angle, so the tilted laptop lid gets a tilted one and
 * nothing lands in the middle of a screen.
 *
 * The pool has an edge. A wash that only fades reads as haze on the lens; a
 * light reads as a light because it stops somewhere, with a soft rim rather
 * than a hard one. Additive over a core bright enough for the composer's bloom
 * to catch and carry, the way it already carries the strip and the desk lamp.
 *
 * NOT on the hidden things. eggs.js is explicit that a plate is never drawn,
 * "not so much that the room hands out a map", and that stands: this is built
 * from the hotspot list, and the eggs are a different list on purpose.
 *
 * One merged geometry with one material, so the whole set is a single draw
 * call.
 */

/** Clear of the surface, in metres: enough not to fight it, too little to see. */
const LIFT = 0.03

/** Where the brightest part lands: just over the top edge, never on the face. */
const ABOVE = 0.02

/**
 * Half-widths in metres, and how much of the object's own width it takes.
 *
 * Narrow on purpose. A pool as wide as the thing it lights is a floodlit wall,
 * and a floodlit wall says nothing about which wall matters.
 */
const SPREAD = 0.72
const MIN_HALF = 0.1
const MAX_HALF = 0.34

/** How far it falls before it is gone, as a share of the object's height. */
const FALL = 0.75
const MIN_FALL = 0.32
const MAX_FALL = 0.7

/**
 * Where the pool's middle sits, measured down from the quad's top edge.
 *
 * The shader's CY is the same number from the other end; they have to agree,
 * or the light stops landing where the geometry was hung for it to land.
 */
const CROWN = 0.38

/** How bright they settle, once the visitor is in the room. */
const LIT = 0.62

export default class Markers
{
    constructor(hotspots)
    {
        this.experience = new Experience()
        this.scene = this.experience.scene
        this.theme = this.experience.theme

        const places = this.places(hotspots)
        if (places.length === 0) return

        this.material = new THREE.ShaderMaterial({
            transparent: true,
            // Adds light where it lands rather than covering what is under it,
            // which is the whole difference between a lamp and a sticker.
            blending: THREE.AdditiveBlending,
            // Depth tested so light behind a wall stays behind it, and no depth
            // written so two of them never cut holes in each other.
            depthWrite: false,
            side: THREE.DoubleSide,
            uniforms: {
                // A halogen picture light, not the theme's accent. Three of
                // the four themes would tint this — one of them nearly white —
                // and a fixture that changes colour with the paint is the one
                // thing in the room that could not be a fixture.
                //
                // Well past the bloom threshold at the core, so the composer
                // spreads it and it arrives as light rather than as a shape.
                uColor: {
                    value: new THREE.Color('#ffc247')
                        .lerp(new THREE.Color('#fff0cf'), 0.32)
                        .multiplyScalar(3.1),
                },
                uOpacity: { value: 0 },
            },
            vertexShader: /* glsl */`
                varying vec2 vUv;
                void main()
                {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: /* glsl */`
                uniform vec3 uColor;
                uniform float uOpacity;
                varying vec2 vUv;

                /** Where the pool's middle sits in the quad, from the bottom. */
                #define CY 0.62

                void main()
                {
                    // A cone meeting a wall makes a rounded pool, not a
                    // wedge: closed at the top where the beam is tight, opened
                    // and dropped towards the bottom where it has travelled
                    // furthest. Straight sides and a flat top read as the
                    // silhouette of a lampshade, which is the wrong object.
                    float y = vUv.y;
                    float x = abs((vUv.x - 0.5) * 2.0);

                    // Half-width at this height, and how far up or down the
                    // pool this pixel is, each on its own scale so the shape
                    // closes at both ends.
                    float w = mix(0.62, 1.0, 1.0 - y);
                    float dy = (y - CY) / (y > CY ? 1.0 - CY : CY);
                    float d = length(vec2(x / w, dy));

                    // Full inside, then a rim. The plateau is what makes it a
                    // light: something that only fades is haze on the lens.
                    float glow = smoothstep(1.0, 0.42, d);
                    if (glow < 0.003) discard;

                    gl_FragColor = vec4(uColor * glow * uOpacity, 1.0);
                }
            `,
        })

        this.mesh = new THREE.Mesh(this.washes(places), this.material)
        this.mesh.name = 'hotspot.markers'
        // The quads are scattered around the room and cheap; culling the set as
        // one box would only ever be wrong.
        this.mesh.frustumCulled = false
        this.mesh.renderOrder = 2
        this.mesh.raycast = () => {}
        this.scene.add(this.mesh)
    }

    /**
     * One quad per place, in world space, lying against the plate it belongs to.
     *
     * A plate is flat, so one of its three local axes is far shorter than the
     * other two: that short one is the way it faces. Of the remaining two, the
     * one that points nearest to the ceiling is the light's way down and the
     * other is its width — which is what makes the wash on the tilted laptop
     * lid lean with the lid instead of standing upright in front of it.
     */
    washes(places)
    {
        const positions = []
        const uvs = []
        const indices = []

        const size = new THREE.Vector3()
        const centre = new THREE.Vector3()
        const facing = new THREE.Vector3()
        const up = new THREE.Vector3()
        const side = new THREE.Vector3()
        const towards = new THREE.Vector3()
        const corner = new THREE.Vector3()

        // A local axis as it points once the room's own transforms have had
        // their say.
        const axis = (object, i, out) => out.set(0, 0, 0).setComponent(i, 1)
            .transformDirection(object.matrixWorld)

        places.forEach((hotspot, i) =>
        {
            const object = hotspot.object
            object.updateWorldMatrix(true, false)
            object.geometry.computeBoundingBox()

            const scale = new THREE.Vector3().setFromMatrixScale(object.matrixWorld)
            object.geometry.boundingBox.getSize(size)
            object.geometry.boundingBox.getCenter(centre)
            centre.applyMatrix4(object.matrixWorld)

            // Thinnest axis first: that is the way the plate faces.
            const order = [0, 1, 2].sort(
                (a, b) => size.getComponent(a) * scale.getComponent(a) - size.getComponent(b) * scale.getComponent(b),
            )
            const [normal, a, b] = order

            // Of the two that are left, the more vertical one carries the fall.
            const dirA = axis(object, a, new THREE.Vector3())
            const dirB = axis(object, b, new THREE.Vector3())
            const upIsA = Math.abs(dirA.y) >= Math.abs(dirB.y)
            up.copy(upIsA ? dirA : dirB)
            side.copy(upIsA ? dirB : dirA)
            if (up.y < 0) up.negate()

            const tall = size.getComponent(upIsA ? a : b) * scale.getComponent(upIsA ? a : b)
            const wide = size.getComponent(upIsA ? b : a) * scale.getComponent(upIsA ? b : a)

            // Out of the surface on the side the visitor stands, so the light is
            // never buried inside the mesh it falls on.
            axis(object, normal, facing)
            towards.fromArray(hotspot.station.position).sub(centre)
            if (facing.dot(towards) < 0) facing.negate()

            const half = THREE.MathUtils.clamp(wide * 0.5 * SPREAD, MIN_HALF, MAX_HALF)
            const fall = THREE.MathUtils.clamp(tall * FALL, MIN_FALL, MAX_FALL)

            // Hung so the crown lands just over the top edge and the rest is
            // the tail sliding down the face. Aimed at the middle instead, it
            // puts a soft blot across whatever the thing is showing, which on
            // a television is the television.
            const top = tall * 0.5 + ABOVE + fall * CROWN

            for (const [su, sv, tu, tv] of [[-1, 0, 0, 0], [1, 0, 1, 0], [1, 1, 1, 1], [-1, 1, 0, 1]])
            {
                corner.copy(centre)
                    .addScaledVector(side, su * half)
                    .addScaledVector(up, top - fall + sv * fall)
                    .addScaledVector(facing, LIFT)

                positions.push(corner.x, corner.y, corner.z)
                uvs.push(tu, tv)
            }

            const base = i * 4
            indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
        })

        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
        geometry.setIndex(indices)
        return geometry
    }

    /**
     * The same set the menu lists: the places, not their contents.
     *
     * A wash on each of the six framed prints is six of them on one wall, which
     * reads as a pattern printed on it rather than as six things to open. The
     * wall gets one, and the six arrive once it is open.
     */
    places(hotspots)
    {
        const seen = new Set()

        return hotspots.filter((hotspot) =>
        {
            if (hotspot.group || !hotspot.object?.geometry || !hotspot.station) return false

            // The tower and the screen are one place reached two ways, and two
            // lights a hand apart look like a mistake.
            const key = hotspot.kind === 'desktop' ? 'desktop' : hotspot.id
            if (seen.has(key)) return false
            seen.add(key)
            return true
        })
    }

    /** Nothing to keep in step with a resize: this is measured in metres. */
    resize() {}

    /** Brought up once the visitor is in the room, not while they arrive. */
    reveal(duration = 2.2)
    {
        if (!this.material || quality.shot) return

        this.lit = LIT
        gsap.to(this.material.uniforms.uOpacity, {
            value: LIT,
            duration,
            delay: 0.6,
            ease: 'power1.out',
            // Somebody who opens something inside the first second of the room
            // would otherwise have this one finish after the fade and light
            // them all back up behind the panel.
            overwrite: true,
        })
    }

    /**
     * Down while something is open, up again on the way out.
     *
     * These are sized for the room, and standing at one puts a wash meant to
     * be read from four metres across most of the screen. They have also
     * stopped being useful by then: a visitor reading about the wall knows the
     * wall can be opened. The fade takes about as long as the camera does, so
     * they go out on the way in rather than blinking off.
     */
    dim(on)
    {
        if (!this.material || !this.lit) return

        gsap.to(this.material.uniforms.uOpacity, {
            value: on ? 0 : this.lit,
            duration: on ? 0.9 : 1.3,
            ease: 'power1.out',
            overwrite: true,
        })
    }
}
