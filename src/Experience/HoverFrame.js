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
const _corner = new THREE.Vector3()
const _anchor = new THREE.Vector3()
const _basis = new THREE.Matrix4()

/**
 * Everything about how this looks, in one place, in the units it is measured
 * in. Every one of them is on a slider at `#debug`, and the shader reads them
 * as uniforms rather than constants so a slider can move them while the patch
 * is on screen — a `#define` would need the shader recompiled to change.
 */
const LOOK = {
    /** Grown past the object, in metres, so it brackets rather than covers. */
    pad: 0.07,
    /** Clear of the surface, so it never fights the thing it is marking. */
    lift: 0.012,
    /** Distance between stripes, in metres on the surface. */
    pitch: 0.055,
    /** How much of that distance is stripe rather than gap, 0 to 1. */
    duty: 0.34,
    /** Weight of the hairline round the edge, in metres. */
    border: 0.008,
    /** How strong the stripes and the edge are, each 0 to 1. */
    hatch: 0.13,
    edge: 0.5,
    /** How much of the accent the edge takes, 0 to 1. */
    tint: 0.35,
}

export default class HoverFrame
{
    constructor()
    {
        this.experience = new Experience()
        this.sizes = this.experience.sizes
        this.theme = this.experience.theme

        this.labelEl = document.getElementById('hotspot-frame-label')
        this.hotspot = null

        // Copied rather than read straight from LOOK, so the sliders write
        // here and the defaults above stay the defaults.
        this.look = { ...LOOK }
        this.pinned = false

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
                uPitch: { value: LOOK.pitch },
                uDuty: { value: LOOK.duty },
                uBorder: { value: LOOK.border },
                uHatch: { value: LOOK.hatch },
                uEdge: { value: LOOK.edge },
                uTint: { value: LOOK.tint },
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
                uniform float uPitch;
                uniform float uDuty;
                uniform float uBorder;
                uniform float uHatch;
                uniform float uEdge;
                uniform float uTint;
                varying vec2 vUv;

                void main()
                {
                    // Position across the quad in metres, which is what makes
                    // the hatch belong to the wall instead of to the screen.
                    vec2 p = vUv * uSize;

                    float band = fract((p.x + p.y) / uPitch);
                    float w = max(fwidth(band), 0.001);
                    float hatch = 1.0 - smoothstep(uDuty - w, uDuty + w, band);

                    // A hairline round the edge, also measured in metres, so it
                    // stays a hairline on a wall two metres wide.
                    vec2 e = min(vUv, 1.0 - vUv) * uSize;
                    float d = min(e.x, e.y);
                    float edge = 1.0 - smoothstep(uBorder, uBorder + fwidth(d), d);

                    float a = max(hatch * uHatch, edge * uEdge) * uOpacity;
                    if (a < 0.004) discard;

                    gl_FragColor = vec4(mix(uColor, uAccent, edge * uTint), a);
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

        this.setDebug()
    }

    /**
     * Sliders for every number above, at `#debug`.
     *
     * Reading a value off a screenshot and typing it back into a file is a
     * slow way to answer "is that too strong": this answers it while looking
     * at it. Nothing here exists outside `#debug`.
     */
    setDebug()
    {
        const debug = this.experience.debug
        if (!debug.active) return

        const f = debug.ui.addFolder('Hover frame')
        const u = this.material.uniforms
        const bind = (key, min, max, step, name, uniform) =>
            f.add(this.look, key).min(min).max(max).step(step).name(name)
                .onChange((v) => { if (uniform) u[uniform].value = v })

        f.add(this, 'pinned').name('Fixar no ultimo')
        bind('pad', 0, 0.3, 0.005, 'Folga (m)')
        bind('lift', 0, 0.05, 0.001, 'Afastamento (m)')
        bind('pitch', 0.015, 0.16, 0.001, 'Passo da hachura (m)', 'uPitch')
        bind('duty', 0.05, 0.9, 0.01, 'Espessura da listra', 'uDuty')
        bind('border', 0.001, 0.03, 0.0005, 'Fio da borda (m)', 'uBorder')
        bind('hatch', 0, 0.6, 0.005, 'Forca da hachura', 'uHatch')
        bind('edge', 0, 1, 0.01, 'Forca da borda', 'uEdge')
        bind('tint', 0, 1, 0.01, 'Accent na borda', 'uTint')

        // Prints them in the shape they are written in the file, so a good set
        // goes back into LOOK without being transcribed by hand.
        f.add({
            copiar: () =>
            {
                const out = Object.entries(this.look)
                    .map(([k, v]) => `    ${k}: ${Number(v.toFixed(4))},`)
                    .join('\n')
                console.log(`const LOOK = {\n${out}\n}`)
            },
        }, 'copiar').name('Imprimir no console')
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
        // Pinned, it stays on the last thing it was on. Reaching a slider means
        // taking the pointer off the room, which would otherwise put away the
        // very thing being adjusted.
        if (this.pinned) return

        this.hotspot = null
        this.mesh.visible = false
        this.labelEl?.parentElement?.classList.add('hidden')
    }

    /**
     * Lays the quad on the plate the raycast hit.
     *
     * A plate is flat, so one of its three local axes is far shorter than the
     * other two: that short one is the way it faces, and the quad lies against
     * it.
     *
     * WHAT IT DOES NOT DO IS INHERIT THE PLATE'S TILT. The plates are pick
     * targets first, and one of them is deliberately tipped sixty degrees off
     * the desk so the camera station read from it comes out above the laptop
     * rather than level with it — see Workstation.js. Wearing that angle put a
     * leaning rectangle on a laptop that is lying flat, which is the tilt of
     * something nobody can see rather than of the thing being pointed at.
     *
     * So the quad stands up: the plate's facing with the tilt taken out of it,
     * and the room's own vertical. On a wall that changes nothing, because the
     * wall was already upright. Only a surface tilted for reasons of its own
     * notices, which is the point.
     *
     * Staying inside the plate's plane was not enough, and it took a
     * measurement to see why: the most vertical line inside a plane tilted
     * sixty degrees is still tilted sixty degrees. The quad has to leave the
     * plane to stand up.
     *
     * A plate facing the ceiling has no horizontal facing to fall back to, so
     * it keeps its own. There is no such hotspot today.
     *
     * The size is measured by projecting the plate's corners onto whichever
     * pair of axes came out of that, rather than by reading its width and
     * height off the axes it was built on. Those are the same thing only while
     * the two agree.
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

        axis(normal, _normal)
        _towards.copy(this.experience.camera.instance.position).sub(_centre)
        if (_normal.dot(_towards) < 0) _normal.negate()

        // Laid flat: the plate's facing with the tilt taken out of it.
        //
        // Keeping the quad inside the plate's own plane only gets it as upright
        // as that plane allows, and the laptop's plane is sixty degrees off the
        // desk — so it stayed a leaning rectangle, just leaning in a tidier
        // direction. It has to leave the plane to stand up.
        _normal.y = 0

        // Unless there was nothing but tilt: a plate facing the ceiling has no
        // horizontal facing to fall back to, so it keeps its own.
        if (_normal.lengthSq() < 0.02)
        {
            axis(normal, _normal)
            if (_normal.dot(_towards) < 0) _normal.negate()

            const leanA = Math.abs(axis(a, _towards).y)
            axis(Math.abs(axis(b, _towards).y) >= leanA ? b : a, _up)
            if (_up.y < 0) _up.negate()
            _up.addScaledVector(_normal, -_up.dot(_normal))
        }
        else _up.set(0, 1, 0)

        _normal.normalize()
        _up.normalize()

        // Right-handed, or the quad is mirrored and the hatch leans the wrong
        // way on half the room.
        _side.crossVectors(_up, _normal).normalize()

        // Measured against those axes rather than read off the ones the plate
        // was built on: with the tilt gone the two no longer agree.
        let halfW = 0
        let halfH = 0
        const box = object.geometry.boundingBox
        for (const cx of [box.min.x, box.max.x])
        {
            for (const cy of [box.min.y, box.max.y])
            {
                for (const cz of [box.min.z, box.max.z])
                {
                    _corner.set(cx, cy, cz).applyMatrix4(object.matrixWorld).sub(_centre)
                    halfW = Math.max(halfW, Math.abs(_corner.dot(_side)))
                    halfH = Math.max(halfH, Math.abs(_corner.dot(_up)))
                }
            }
        }

        const width = halfW * 2 + this.look.pad * 2
        const height = halfH * 2 + this.look.pad * 2

        _basis.makeBasis(_side, _up, _normal)
        this.mesh.quaternion.setFromRotationMatrix(_basis)
        this.mesh.position.copy(_centre).addScaledVector(_normal, this.look.lift)
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
