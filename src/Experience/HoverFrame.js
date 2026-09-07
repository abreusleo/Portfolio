import * as THREE from 'three'

import Experience from './Experience.js'
import { t } from './config/i18n.js'

/**
 * A bracket drawn around whatever the pointer is on, with its name beside it.
 *
 * The room's problem has always been that nothing in it looks pressable. Three
 * attempts to solve that by lighting the objects failed, and the fourth — real
 * fixtures, in Lights.js — solves a different problem: it says "look here", not
 * "this opens". Saying the second one needs to answer the pointer, which means
 * it can only exist where there is a pointer.
 *
 * So this is a mouse-only thing, and it is deliberately drawn rather than lit:
 * a hatched rectangle over the object's extent and a label on the side. The
 * hatch is what keeps it from reading as a solid panel covering the thing —
 * you can see straight through it to what it is bracketing, which is the whole
 * job.
 *
 * It is HTML over the canvas rather than anything in the scene. What it frames
 * is a screen-space rectangle, the label has to stay upright and legible at any
 * distance, and both of those are free in the DOM and awkward in a shader.
 *
 * The eggs are not framed. eggs.js is explicit that a hidden thing is never
 * drawn, and this is driven by the hotspot the raycast returns, which is a
 * different list on purpose.
 */

const _box = new THREE.Box3()
const _corner = new THREE.Vector3()

/** The eight corners of a box, as multipliers to pick min or max per axis. */
const CORNERS = [
    [0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0],
    [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1],
]

/** Breathing room around the object, in pixels. */
const PAD = 10

/** Below this the bracket is smaller than the thing it explains. */
const MIN_SIDE = 26

export default class HoverFrame
{
    constructor()
    {
        this.experience = new Experience()
        this.sizes = this.experience.sizes

        this.root = document.getElementById('hotspot-frame')
        this.labelEl = document.getElementById('hotspot-frame-label')
        this.hotspot = null
    }

    show(hotspot)
    {
        if (!this.root) return

        this.hotspot = hotspot
        this.labelEl.textContent = t(hotspot.label) ?? ''
        this.update()
        this.root.classList.remove('hidden')
    }

    hide()
    {
        this.hotspot = null
        this.root?.classList.add('hidden')
    }

    /**
     * Where the object lands on screen this frame.
     *
     * Every frame, not once on hover: the parked camera drifts with the pointer
     * and the bracket has to drift with it, or it slides off the thing it is
     * supposed to be pointing at.
     */
    update()
    {
        if (!this.hotspot || !this.root) return

        const camera = this.experience.camera.instance
        _box.setFromObject(this.hotspot.object)

        let minX = Infinity
        let minY = Infinity
        let maxX = -Infinity
        let maxY = -Infinity
        let behind = 0

        for (const [ix, iy, iz] of CORNERS)
        {
            _corner.set(
                ix ? _box.max.x : _box.min.x,
                iy ? _box.max.y : _box.min.y,
                iz ? _box.max.z : _box.min.z,
            ).project(camera)

            // A corner behind the lens projects mirrored, which would stretch
            // the rectangle across the whole screen.
            if (_corner.z > 1) { behind++; continue }

            minX = Math.min(minX, _corner.x)
            maxX = Math.max(maxX, _corner.x)
            minY = Math.min(minY, _corner.y)
            maxY = Math.max(maxY, _corner.y)
        }

        if (behind > 0 || minX === Infinity) return this.hide()

        const w = this.sizes.width
        const h = this.sizes.height
        const left = (minX * 0.5 + 0.5) * w - PAD
        const right = (maxX * 0.5 + 0.5) * w + PAD
        // Clip space counts up, the screen counts down.
        const top = (-maxY * 0.5 + 0.5) * h - PAD
        const bottom = (-minY * 0.5 + 0.5) * h + PAD

        const width = Math.max(right - left, MIN_SIDE)
        const height = Math.max(bottom - top, MIN_SIDE)

        const style = this.root.style
        style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`
        style.width = `${Math.round(width)}px`
        style.height = `${Math.round(height)}px`

        // The label goes outside the bracket, and swaps sides rather than
        // running off the screen when the object is against the right edge.
        this.root.classList.toggle('flip', left + width + 220 > w)
    }

    /** The language can change while something is hovered. */
    retext()
    {
        if (this.hotspot) this.labelEl.textContent = t(this.hotspot.label) ?? ''
    }
}
