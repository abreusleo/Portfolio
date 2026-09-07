import * as THREE from 'three'
import gsap from 'gsap'

import Experience from '../Experience.js'
import { quality } from '../Utils/flags.js'

/**
 * A soft light on everything worth pressing.
 *
 * Until now the only thing that said an object was pressable was the mouse
 * cursor, and a phone has no cursor: the room was mute about itself to every
 * visitor holding one. These are the answer, and they are made of
 * the same thing the room is lit with rather than drawn on top of it: an
 * additive glow bright enough to cross the composer's bloom threshold, so what
 * reaches the screen is the scene's own bloom pass spreading it.
 *
 * A ring was the first attempt and it read as eight orange objects somebody
 * had left lying about the room, which is what a mark drawn over a place does
 * and what light falling on it does not.
 *
 * NOT on the hidden things. eggs.js is explicit that a plate is never drawn,
 * "not so much that the room hands out a map", and that stands: this is built
 * from the hotspot list, and the eggs are a different list on purpose.
 *
 * One Points with one material, so the whole set is a single draw call. The
 * per-frame budget in this scene is under two tenths of a millisecond for all
 * the logic there is, and fifteen projected divs would have been a large
 * fraction of that for a decoration.
 */

/** How far in front of the surface a ring sits, in metres. */
const OFFSET = 0.07

export default class Markers
{
    constructor(hotspots)
    {
        this.experience = new Experience()
        this.scene = this.experience.scene
        this.theme = this.experience.theme

        const places = this.places(hotspots)
        if (places.length === 0) return

        const positions = new Float32Array(places.length * 3)
        const world = new THREE.Vector3()
        const toward = new THREE.Vector3()
        const box = new THREE.Box3()

        places.forEach((hotspot, i) =>
        {
            // Under the thing, not on it. Centred on a mesh, a mark lands in
            // the middle of whatever the object is showing — across the face
            // of a print, on top of a figure on a shelf — and a wall-sized
            // plate has its centre in mid-air between two rows of frames.
            // The foot of the object is always a place nothing is.
            box.setFromObject(hotspot.object)
            box.getCenter(world)
            world.y = box.min.y - 0.02

            // And forward, towards the station that frames it: the centre of a
            // mesh is inside the mesh, and a ring inside the television is a
            // ring nobody sees.
            toward.fromArray(hotspot.station.position).sub(world).normalize()
            world.addScaledVector(toward, OFFSET).toArray(positions, i * 3)
        })

        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

        this.material = new THREE.ShaderMaterial({
            transparent: true,
            // Depth tested so a ring behind a wall stays behind it, and no
            // depth written so two rings never cut holes in each other.
            depthWrite: false,
            // Additive: it adds light where it lands rather than covering
            // what is under it. Nothing is hidden, only brightened.
            blending: THREE.AdditiveBlending,
            uniforms: {
                // Warm, and over the bloom threshold on purpose — this is
                // meant to read as a lamp catching the thing, not as a colour
                // painted on it.
                uColor: { value: new THREE.Color(this.theme.accent).lerp(new THREE.Color('#fff6ec'), 0.55).multiplyScalar(2.4) },
                uOpacity: { value: 0 },
                // In framebuffer pixels, so it has to be told the pixel
                // ratio: the quality ladder moves that between 0.6 and 2,
                // and without this a ring would be three times the size on
                // the weakest phone and a speck on the strongest.
                uSize: { value: 15 },
                uScale: { value: this.experience.sizes.pixelRatio },
            },
            vertexShader: /* glsl */`
                uniform float uSize;
                uniform float uScale;
                void main()
                {
                    vec4 mv = modelViewMatrix * vec4(position, 1.0);
                    // Shrinks with distance like everything else in the room,
                    // so a ring across the room does not shout louder than the
                    // object it belongs to — clamped at both ends, because a
                    // ring nobody can see is not a marker and one filling the
                    // frame is not discreet.
                    float size = clamp(uSize * 9.0 / -mv.z, 14.0, 44.0);
                    gl_PointSize = size * uScale;
                    gl_Position = projectionMatrix * mv;
                }
            `,
            fragmentShader: /* glsl */`
                uniform vec3 uColor;
                uniform float uOpacity;
                void main()
                {
                    // A falloff, not an edge. An outline is a drawn thing; a
                    // pool that fades to nothing is a light landing on one.
                    float d = length(gl_PointCoord - 0.5) * 2.0;
                    float glow = pow(max(0.0, 1.0 - d), 2.6);
                    if (glow < 0.004) discard;
                    gl_FragColor = vec4(uColor * glow * uOpacity, 1.0);
                }
            `,
        })

        this.points = new THREE.Points(geometry, this.material)
        this.points.name = 'hotspot.markers'
        // Drawn after the room, and never a thing the pointer can catch.
        this.points.renderOrder = 2
        this.points.raycast = () => {}
        this.scene.add(this.points)
    }

    /**
     * The same set the menu lists: the places, not their contents.
     *
     * A ring on each of the six framed prints is six rings on one wall, which
     * reads as a pattern printed on it rather than as six things to open. The
     * wall gets one, and the six arrive once it is open.
     */
    places(hotspots)
    {
        const seen = new Set()

        return hotspots.filter((hotspot) =>
        {
            if (hotspot.group || !hotspot.object || !hotspot.station) return false

            // The tower and the screen are one place reached two ways, and two
            // rings a hand apart look like a mistake.
            const key = hotspot.kind === 'desktop' ? 'desktop' : hotspot.id
            if (seen.has(key)) return false
            seen.add(key)
            return true
        })
    }

    /** The ladder and the window both change the pixel ratio under us. */
    resize()
    {
        if (this.material) this.material.uniforms.uScale.value = this.experience.sizes.pixelRatio
    }

    /** Faded in once the visitor is in the room, not while they arrive. */
    reveal(duration = 1.8)
    {
        if (!this.material || quality.shot) return

        gsap.to(this.material.uniforms.uOpacity, {
            value: 0.5,
            duration,
            delay: 0.5,
            ease: 'power1.out',
        })
    }
}
