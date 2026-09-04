import Experience from './Experience.js'
import { quality as flags } from './Utils/flags.js'

/**
 * How much room to draw, decided by drawing it and looking at the clock.
 *
 * There is no usable way to ask a browser what it is running on. deviceMemory
 * is Chromium-only and absent on the Safari most phones are; hardwareConcurrency
 * counts CPU cores and says nothing about the GPU; the WebGL renderer string is
 * being restricted for fingerprinting and comes back generic or blocked. And a
 * correct answer would still need a table mapping every chip to a frame budget,
 * which nobody maintains and which is already wrong for the phone released
 * after the table was written.
 *
 * So it is measured. Measuring also catches what no table could: a phone that
 * is fine for two minutes and then thermally throttles, and a device in a
 * low-power mode.
 *
 * THE CALIBRATION HAPPENS BEHIND THE LOADER. Stepping down while somebody is
 * watching means the first thing they see is the bad version — which, on a
 * portfolio, is the version that counts. The room is already built and already
 * drawing by the time prewarm resolves, and the loader is still covering the
 * canvas, so the ladder is walked there and the visitor enters at the tier that
 * already fits. What runs afterwards is only a safety net, and it only ever
 * descends.
 */

/**
 * Ordered best to worst. `dpr` is a multiplier on the ratio Sizes already
 * decided, so the pixel budget and the device's own ratio still have the last
 * word about size and this only says how much of it to use.
 */
const TIERS = [
    { id: 'full', dpr: 1, samples: 2, bloom: true, blur: true },
    { id: 'high', dpr: 0.85, samples: 0, bloom: true, blur: true },
    { id: 'medium', dpr: 0.72, samples: 0, bloom: true, blur: false },
    { id: 'low', dpr: 0.6, samples: 0, bloom: false, blur: false },
]

/**
 * The frame this aims at, in milliseconds.
 *
 * Twenty and not sixteen point seven: chasing a perfect sixty on a phone that
 * cannot hold it walks the whole ladder down and hands over the ugliest room
 * for a target it was never going to reach. Twenty is a smooth fifty, and the
 * step above it usually looks meaningfully better.
 */
const BUDGET = 20

/** Frames per rung. Enough to average out a hitch, few enough to be quick. */
const SAMPLES = 24

/** Long enough to be throttling rather than one bad second. */
const GUARD = { over: 45, seconds: 4 }

const STORAGE_KEY = 'basement.quality'

export default class Quality
{
    constructor()
    {
        this.experience = new Experience()
        this.sizes = this.experience.sizes
        this.renderer = this.experience.renderer

        // A switch given by hand means the visitor is driving. Measuring on
        // top of that would fight them, and the switches exist to be tested
        // against.
        this.auto = !flags.shot
            && flags.pixelRatio === null
            && flags.samples === null
            && flags.bloom
            && flags.blur

        this.at = 0
        this.frames = []
        this.overSince = null
    }

    get tier()
    {
        return TIERS[this.at]
    }

    apply()
    {
        const tier = this.tier

        this.sizes.scale = tier.dpr
        this.sizes.measure()
        this.renderer.resize()
        this.renderer.setSamples(tier.samples)
        this.renderer.bloomPass.enabled = tier.bloom
        document.body.classList.toggle('no-blur', !tier.blur)
    }

    /**
     * Walks down until a rung fits, behind the loader, before anybody looks.
     *
     * Each rung is measured rather than predicted. A cost model would have to
     * know what this scene costs on hardware it has never seen, which is the
     * same guess in a different hat.
     */
    async calibrate()
    {
        if (!this.auto) return

        const remembered = this.read()
        if (remembered !== null)
        {
            // Already walked on this device. Walking it again every visit
            // spends a second and reaches the same rung.
            this.at = remembered
            this.apply()
            return
        }

        for (this.at = 0; this.at < TIERS.length; this.at++)
        {
            this.apply()
            const median = await this.measure(SAMPLES)
            if (median <= BUDGET) break
        }

        this.at = Math.min(this.at, TIERS.length - 1)
        this.apply()
        this.write()
    }

    /** Median of the next `count` frames. Median, so one hitch cannot decide. */
    measure(count)
    {
        return new Promise((resolve) =>
        {
            const times = []
            let last = performance.now()

            const tick = (now) =>
            {
                times.push(now - last)
                last = now
                if (times.length < count) return requestAnimationFrame(tick)

                // The first few are the reallocation this rung just caused.
                const settled = times.slice(4).sort((a, b) => a - b)
                resolve(settled[Math.floor(settled.length / 2)])
            }

            requestAnimationFrame(tick)
        })
    }

    /**
     * The safety net, once the room is running: a phone that was fine when it
     * was cold. It only ever goes down. Climbing back would need the room to
     * get visibly better and then worse again, repeatedly, which reads as the
     * page being broken rather than as it being clever.
     */
    update(delta)
    {
        if (!this.auto || this.at >= TIERS.length - 1) return

        this.frames.push(delta * 1000)
        if (this.frames.length > 120) this.frames.shift()
        if (this.frames.length < 60) return

        const sorted = [...this.frames].sort((a, b) => a - b)
        const p95 = sorted[Math.floor(sorted.length * 0.95)]

        if (p95 <= GUARD.over)
        {
            this.overSince = null
            return
        }

        const now = performance.now()
        if (this.overSince === null) this.overSince = now
        if (now - this.overSince < GUARD.seconds * 1000) return

        this.at++
        this.apply()
        this.write()
        this.frames.length = 0
        this.overSince = null
    }

    read()
    {
        try
        {
            const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY))
            // Stamped with the ladder it was measured against: changing the
            // rungs has to invalidate an answer measured on the old ones.
            if (!raw || raw.rungs !== TIERS.length) return null
            return Math.min(Math.max(raw.at, 0), TIERS.length - 1)
        }
        catch (error)
        {
            return null
        }
    }

    write()
    {
        try
        {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ at: this.at, rungs: TIERS.length }))
        }
        catch (error)
        {
            // Private windows, blocked storage. The ladder is walked again
            // next visit, which costs a second and is not worth a word.
        }
    }
}
