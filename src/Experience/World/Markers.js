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
 * This one borrows from what is already in the room. Every light here is
 * overhead — the ceiling strip, the track over the shelves — and each throws
 * the same shape: a narrow bright patch high up that widens and dies as it
 * falls. So each hotspot gets that shape, hung from just above the thing and
 * spilling down over it, lying on the surface and taking its angle. The tilted
 * laptop lid gets a tilted one. Nothing lands in the middle of a screen.
 *
 * Additive, so it brightens what is under it instead of covering it, with a
 * crown bright enough for the composer's bloom to catch and carry the way it
 * already carries the strip and the desk lamp.
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

/** Half-widths in metres. A two-metre wall does not get a two-metre sun. */
const MIN_HALF = 0.13
const MAX_HALF = 0.62

/** How far it falls before it is gone, as a share of the object's height. */
const FALL = 0.9
const MIN_FALL = 0.42
const MAX_FALL = 0.95

/** Where the crown sits inside the quad, measured down from its top edge. */
const CROWN = 0.18

/** How bright they settle, once the visitor is in the room. */
const LIT = 0.55

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
                // Warm, and past the bloom threshold at the crown on purpose:
                // this is meant to read as the room being lit there, not as a
                // colour someone painted on it.
                uColor: {
                    value: new THREE.Color(this.theme.accent)
                        .lerp(new THREE.Color('#fff3e4'), 0.62)
                        .multiplyScalar(2.3),
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

                void main()
                {
                    // A cone seen where it lands: tight at the top, opening as
                    // it falls, the way the track lights open on the far wall.
                    float y = vUv.y;
                    float spread = mix(0.42, 1.0, 1.0 - y);
                    float across = smoothstep(1.0, 0.0, clamp(abs((vUv.x - 0.5) * 2.0) / spread, 0.0, 1.0));

                    // Brightest a little under the top edge, gone by the floor
                    // of the quad, and eased off at the very top so the light
                    // never ends on a straight line.
                    float down = smoothstep(1.0, 0.82, y) * smoothstep(0.0, 0.85, y);

                    float glow = pow(across * down, 1.6);
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

            const half = THREE.MathUtils.clamp(wide * 0.5 * 1.3, MIN_HALF, MAX_HALF)
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
