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
 * What this is now is a shaded lamp washing a wall. The mouth of a beam meeting
 * a flat surface draws a conic: a vertex where it strikes, two arms opening
 * away from it, and no bottom at all. Brightest along that arc, spent on the
 * way down, and wider than it is loud.
 *
 * The version before this one was a bright closed disc, and a bright closed
 * disc is an object. It took the eye instead of pointing it, which is the one
 * failure a highlight cannot have: everything it lights matters more than it
 * does. So the peak now stays under the composer's bloom threshold on purpose.
 * Crossing it turns a lamp into a flare, and a flare is the loudest thing on
 * the screen.
 *
 * It hangs just over the top edge of the thing and lies on the surface, taking
 * its angle, so the tilted laptop lid gets a tilted one and nothing lands in
 * the middle of a screen.
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
const SPREAD = 0.85
const MIN_HALF = 0.18
const MAX_HALF = 0.55

/** How far it falls before it is gone, as a share of the object's height. */
const FALL = 1.1
const MIN_FALL = 0.5
const MAX_FALL = 1.05

/**
 * Where the beam strikes, measured down from the quad's top edge.
 *
 * The shader's VERTEX is the same point counted from the other end; the two
 * have to agree, or the light stops landing where it was hung to land.
 */
const CROWN = 0.05

/** How bright they settle, once the visitor is in the room. */
const LIT = 0.6

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
                // A halogen lamp, not the theme's accent. Three of the four
                // themes would tint this — one of them nearly white — and a
                // fixture that changes bulbs to match the paint is the one
                // thing in the room that could not be a fixture.
                //
                // Scaled to land under the bloom threshold at its brightest.
                // Over it the composer blows the peak into a flare, and the
                // marker becomes the loudest object in the room.
                uColor: {
                    value: new THREE.Color('#ffb765').multiplyScalar(1.35),
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

                /** Where the beam strikes the surface, from the bottom. */
                #define VERTEX 0.95

                void main()
                {
                    float y = vUv.y;
                    float x = abs((vUv.x - 0.5) * 2.0);

                    // The near edge of the beam. Flat across the middle and
                    // then falling away, which is the dome a shade throws: a
                    // plain parabola here came to a point and read as a hat.
                    // Left open at the bottom, because closing the shape makes
                    // a disc, and a disc is an object.
                    float edge = VERTEX - 1.15 * pow(x, 2.6);
                    float inside = smoothstep(-0.07, 0.04, edge - y);

                    // Brightest at the strike and spent on the way down, so
                    // what covers most of the surface is the weak part of it.
                    float fall = exp(-max(0.0, VERTEX - y) * 2.1);

                    // Gone by the foot of the quad, so the quad is never an
                    // edge anybody can find.
                    float glow = inside * fall * smoothstep(0.0, 0.16, y);
                    if (glow < 0.002) discard;

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
