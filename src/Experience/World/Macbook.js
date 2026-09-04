import * as THREE from 'three'
import { makeLaptopScreen } from './Textures.js'

/**
 * The laptop that opens.
 *
 * Its GLB ships an animation that swings the lid, so nothing here rotates a
 * node by hand: the clip already knows the hinge, the arc and where the lid
 * stops. What this does is refuse to play it at its own pace. The clip runs
 * 16 seconds — open, hold, close — and a visitor who clicked a laptop is not
 * going to wait five seconds for a lid. So the action is paused and its time
 * is driven from a value this class eases, which turns a fixed animation into
 * one the interaction controls in both directions.
 */

// Where in the clip the lid sits at its widest. Sampled from the rotation
// track rather than guessed: it opens to about 120 degrees by here, holds
// until nine seconds, then closes itself, which is exactly what we do not want.
const OPEN_AT = 5.2

const SPEED = 2.4

export default class Macbook
{
    constructor(world, model, asset)
    {
        this.world = world
        this.model = model

        this.time = 0
        this.target = 0
        this.opened = false

        const clip = asset.animations?.[0]
        if (clip)
        {
            this.mixer = new THREE.AnimationMixer(model)
            this.action = this.mixer.clipAction(clip)
            this.action.play()
            // Paused, so mixer.update() applies whatever time we set without
            // advancing it on its own.
            this.action.paused = true
            this.apply(0)
        }

        this.dressScreen()
    }

    /**
     * The screen is one flat quad with its own material, so the wallpaper the
     * model shipped with can be swapped for something that belongs here. The
     * material is cloned first: it may be shared, and a shared material edited
     * in place turns other parts of the model into a screen too.
     */
    dressScreen()
    {
        this.model.traverse((child) =>
        {
            if (!child.isMesh || child.material?.name !== 'Material.002') return

            // Unlit, so the desk lamp cannot fall across it and the texture
            // shows the colours it was drawn in. toneMapped stays off for the
            // same reason: the room's exposure is not the screen's business.
            const texture = makeLaptopScreen()
            const material = new THREE.MeshBasicMaterial({
                map: texture,
                toneMapped: false,
            })
            material.color.setScalar(0)

            child.material = material
            this.screen = material
            this.screenTexture = texture
        })
    }

    /** Redraws the lock screen in the current language. */
    retext()
    {
        if (!this.screen) return

        const next = makeLaptopScreen()
        this.screenTexture?.dispose()
        this.screenTexture = next
        this.screen.map = next
        this.screen.needsUpdate = true
    }

    /** `instant` follows the camera: if it does not travel, neither does the lid. */
    open(instant = false)
    {
        this.opened = true
        this.target = OPEN_AT
        if (instant) this.snap()
    }

    close(instant = false)
    {
        this.opened = false
        this.target = 0
        if (instant) this.snap()
    }

    snap()
    {
        this.time = this.target
        this.apply(this.time)
        this.light()
    }

    apply(time)
    {
        if (!this.action) return
        this.action.time = time
        this.mixer.update(0)
    }

    update(clock)
    {
        if (Math.abs(this.target - this.time) < 0.001)
        {
            this.time = this.target
        }
        else
        {
            const step = SPEED * Math.min(clock.delta, 0.05) * OPEN_AT
            this.time += Math.sign(this.target - this.time) * Math.min(step, Math.abs(this.target - this.time))
            this.apply(this.time)
            // The only thing in the room that moves, so it is also the only
            // thing that has to ask for the shadow maps to be redrawn.
            this.world.experience.renderer.instance.shadowMap.needsUpdate = true
        }

        this.light()
    }

    /**
     * The screen wakes as the lid rises. On an unlit material the colour
     * multiplies the texture, so fading it from black is the whole effect.
     */
    light()
    {
        if (!this.screen) return
        const openness = OPEN_AT > 0 ? this.time / OPEN_AT : 0
        this.screen.color.setScalar(THREE.MathUtils.smoothstep(openness, 0.3, 0.85))
    }
}
