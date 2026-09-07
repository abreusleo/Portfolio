import * as THREE from 'three'

import Experience from './Experience.js'
import { t } from './config/i18n.js'
import { isMobile } from './Utils/device.js'

/**
 * A hatched patch laid over whatever the pointer is on, with its name beside it.
 *
 * The room's problem has always been that nothing in it looks pressable. The
 * fixtures in Lights.js do not solve that — light says "look here", not "this
 * opens" — and saying the second thing means answering the pointer, so this
 * exists only where there is one.
 *
 * IT LIVES IN THE ROOM, NOT ON THE SCREEN. The first version was a rectangle in
 * the DOM sized to the object's projected bounds, and a screen-aligned
 * rectangle over a room seen at an angle reads as a box floating in front of
 * the room. This one is a quad lying on the surface, taking its angle and its
 * perspective, so the patch skews with the wall it is on. The stripes are
 * spaced in metres rather than pixels for the same reason: a hatch that keeps
 * its spacing as the wall recedes is printed on the screen, and one that
 * narrows with the wall is printed on the wall.
 *
 * Hatched and not filled, because a solid patch over an object hides the
 * object, and the object is the thing being pointed at.
 *
 * The label stays in the DOM. It has to be upright and the same size at any
 * distance, which is what a caption is, and both are free there and awkward in
 * a scene. It is anchored to the edge of the quad rather than to the cursor, so
 * it belongs to the thing rather than to the hand.
 *
 * The eggs are not framed. eggs.js is explicit that a hidden thing is never
 * drawn, and this is driven by the hotspot the raycast returns, which is a
 * different list on purpose.
 */

const _size = new THREE.Vector3()
const _centre = new THREE.Vector3()
const _scale = new THREE.Vector3()
const _side = new THREE.Vector3()
const _up = new THREE.Vector3()
const _normal = new THREE.Vector3()
const _towards = new THREE.Vector3()
const _anchor = new THREE.Vector3()
const _basis = new THREE.Matrix4()

/** Grown past the object, in metres, so it brackets rather than covers. */
const PAD = 0.07

/** Clear of the surface, so it never fights the thing it is marking. */
const LIFT = 0.012

export default class HoverFrame
{
    constructor()
    {
        this.experience = new Experience()
        this.sizes = this.experience.sizes
        this.theme = this.experience.theme

        this.labelEl = document.getElementById('hotspot-frame-label')
        this.hotspot = null

        this.material = new THREE.ShaderMaterial({
            transparent: true,
            // Over everything, always. It only exists while the pointer is on
            // the thing, so it can never be marking something behind a wall,
            // and a patch half-eaten by the objects it brackets marks nothing.
            depthTest: false,
            depthWrite: false,
            side: THREE.DoubleSide,
            uniforms: {
                uColor: { value: new THREE.Color('#e9e7e3') },
                uAccent: { value: new THREE.Color(this.theme.accent) },
                uSize: { value: new THREE.Vector2(1, 1) },
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
                uniform vec3 uAccent;
                uniform vec2 uSize;
                uniform float uOpacity;
                varying vec2 vUv;

                /** Stripe pitch and border weight, both in metres. */
                #define PITCH 0.055
                #define DUTY 0.34
                #define BORDER 0.008

                void main()
                {
                    // Position across the quad in metres, which is what makes
                    // the hatch belong to the wall instead of to the screen.
                    vec2 p = vUv * uSize;

                    float band = fract((p.x + p.y) / PITCH);
                    float w = max(fwidth(band), 0.001);
                    float hatch = 1.0 - smoothstep(DUTY - w, DUTY + w, band);

                    // A hairline round the edge, also measured in metres, so it
                    // stays a hairline on a wall two metres wide.
                    vec2 e = min(vUv, 1.0 - vUv) * uSize;
                    float d = min(e.x, e.y);
                    float edge = 1.0 - smoothstep(BORDER, BORDER + fwidth(d), d);

                    float a = max(hatch * 0.13, edge * 0.5) * uOpacity;
                    if (a < 0.004) discard;

                    gl_FragColor = vec4(mix(uColor, uAccent, edge * 0.35), a);
                }
            `,
        })

        this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.material)
        this.mesh.name = 'hotspot.frame'
        this.mesh.frustumCulled = false
        this.mesh.renderOrder = 30
        this.mesh.raycast = () => {}
        this.mesh.visible = false
        this.experience.scene.add(this.mesh)
    }

    show(hotspot)
    {
        // No pointer, no patch. A phone would leave it stuck on whatever was
        // tapped last, which is the bug the trailing labels already had there.
        if (isMobile || !hotspot?.object?.geometry) return this.hide()

        this.hotspot = hotspot
        if (this.labelEl) this.labelEl.textContent = t(hotspot.label) ?? ''
        this.place()
        this.mesh.visible = true
        this.material.uniforms.uOpacity.value = 1
        this.labelEl?.parentElement?.classList.remove('hidden')
    }

    hide()
    {
        this.hotspot = null
        this.mesh.visible = false
        this.labelEl?.parentElement?.classList.add('hidden')
    }

    /**
     * Lays the quad on the plate the raycast hit.
     *
     * A plate is flat, so one of its three local axes is far shorter than the
     * other two: that short one is the way it faces, and the quad spans the
     * other two. Which is what makes the patch on the tilted laptop lid lean
     * with the lid rather than stand upright in front of it.
     */
    place()
    {
        const object = this.hotspot.object
        object.updateWorldMatrix(true, false)
        object.geometry.computeBoundingBox()

        _scale.setFromMatrixScale(object.matrixWorld)
        object.geometry.boundingBox.getSize(_size)
        object.geometry.boundingBox.getCenter(_centre)
        _centre.applyMatrix4(object.matrixWorld)

        const axis = (i, out) => out.set(0, 0, 0).setComponent(i, 1).transformDirection(object.matrixWorld)
        const metres = (i) => _size.getComponent(i) * _scale.getComponent(i)

        const [normal, a, b] = [0, 1, 2].sort((x, y) => metres(x) - metres(y))

        // Of the two that are left, the one pointing nearest the ceiling is
        // the quad's up, so the hatch leans the same way on every surface in
        // the room instead of following whichever axis the model was built on.
        const leanA = Math.abs(axis(a, _towards).y)
        const leanB = Math.abs(axis(b, _towards).y)
        const upIsB = leanB >= leanA
        axis(upIsB ? b : a, _up)
        if (_up.y < 0) _up.negate()

        axis(normal, _normal)
        _towards.copy(this.experience.camera.instance.position).sub(_centre)
        if (_normal.dot(_towards) < 0) _normal.negate()

        // Right-handed, or the quad is mirrored and the hatch leans the wrong
        // way on half the room.
        _side.crossVectors(_up, _normal).normalize()

        const width = metres(upIsB ? a : b) + PAD * 2
        const height = metres(upIsB ? b : a) + PAD * 2

        _basis.makeBasis(_side, _up, _normal)
        this.mesh.quaternion.setFromRotationMatrix(_basis)
        this.mesh.position.copy(_centre).addScaledVector(_normal, LIFT)
        this.mesh.scale.set(width, height, 1)
        this.material.uniforms.uSize.value.set(width, height)

        // The caption hangs off the edge the quad presents to the camera.
        _anchor.copy(_centre).addScaledVector(_side, width / 2)
        this.moveLabel(_anchor)
    }

    /** Puts the caption beside the quad, in pixels. */
    moveLabel(world)
    {
        if (!this.labelEl) return

        _towards.copy(world).project(this.experience.camera.instance)
        const x = (_towards.x * 0.5 + 0.5) * this.sizes.width
        const y = (-_towards.y * 0.5 + 0.5) * this.sizes.height

        // Against the right edge it swaps sides rather than leaving the screen.
        const flip = x + 220 > this.sizes.width
        this.labelEl.parentElement.classList.toggle('flip', flip)
        this.labelEl.parentElement.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`
    }

    /** Followed every frame: the parked camera drifts, and so does the caption. */
    update()
    {
        if (this.hotspot) this.place()
    }

    /** The language can change while something is hovered. */
    retext()
    {
        if (this.hotspot && this.labelEl) this.labelEl.textContent = t(this.hotspot.label) ?? ''
    }
}
