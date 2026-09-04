import EventEmitter from './EventEmitter.js'

/**
 * How many pixels the framebuffer is allowed to be, before the pixel ratio is
 * applied to it.
 *
 * The framebuffer is by far the largest allocation this scene makes, and it
 * grows with the SQUARE of the pixel ratio. The composer keeps two half-float
 * targets and multisamples both, so a single screen pixel is paid for eight
 * times over: 2 buffers x 8 bytes x the sample count. A 1920x1080 window at a
 * ratio of 2 is a 4K buffer and roughly half a gigabyte of video memory.
 *
 * Capping the ratio alone does not work, because the same ratio costs four
 * times as much on a large monitor as on a small one. Capping the total does:
 * a small window still gets the full ratio and a sharp image, and a large one
 * stops before the buffer runs away.
 */
const PIXEL_BUDGET = 5.5e6

export default class Sizes extends EventEmitter
{
    constructor()
    {
        super()

        this.measure()

        window.addEventListener('resize', () =>
        {
            this.measure()
            this.trigger('resize')
        })
    }

    measure()
    {
        this.width = window.innerWidth
        this.height = window.innerHeight
        this.pixelRatio = this.pickPixelRatio()
    }

    pickPixelRatio()
    {
        const wanted = Math.min(window.devicePixelRatio || 1, 2)
        const area = this.width * this.height
        if (area <= 0) return wanted

        // Never below 1: a blurry scene is worse than a heavy one.
        return Math.max(1, Math.min(wanted, Math.sqrt(PIXEL_BUDGET / area)))
    }
}
