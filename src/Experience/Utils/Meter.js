/**
 * Frame times on screen, behind `?perf`.
 *
 * `?mem` writes to the console, which is exactly the instrument a phone does
 * not have — and the phone is where the complaint about stutter comes from.
 * Measuring it from a desktop is not a substitute: throttling the CPU here
 * leaves this machine's GPU untouched, and the run-to-run spread on the same
 * configuration turned out wider than the differences worth attributing.
 *
 * So: numbers on the glass, on the device that is actually slow. It reports
 * the median and the 95th percentile rather than an average, because an
 * average of sixty smooth frames and three terrible ones reads as fine and is
 * the exact case somebody means by "travado".
 */
const WINDOW = 180

export default class Meter
{
    constructor()
    {
        this.active = new URLSearchParams(window.location.search).has('perf')
        if (!this.active) return

        this.frames = []
        this.last = performance.now()
        this.until = 0

        this.el = document.createElement('div')
        this.el.className = 'meter'
        document.body.append(this.el)
    }

    /** Called once per frame, before anything is drawn. */
    tick()
    {
        if (!this.active) return

        const now = performance.now()
        this.frames.push(now - this.last)
        this.last = now
        if (this.frames.length > WINDOW) this.frames.shift()

        // Four times a second: rewriting text every frame is itself a cost,
        // and a number that changes sixty times a second cannot be read.
        if (now < this.until || this.frames.length < 20) return
        this.until = now + 250

        const sorted = [...this.frames].sort((a, b) => a - b)
        const median = sorted[Math.floor(sorted.length / 2)]
        const p95 = sorted[Math.floor(sorted.length * 0.95)]
        // Not draw calls: the composer resets that counter on every pass, so
        // what is readable here is the last pass alone. Pixels and programs
        // hold still and are the two that explain a slow frame — how much
        // there is to fill, and whether something compiled mid-visit.
        const renderer = this.renderer
        const sizes = renderer?.sizes
        const mp = sizes ? (sizes.width * sizes.pixelRatio * sizes.height * sizes.pixelRatio) / 1e6 : 0

        this.el.textContent = [
            `${Math.round(1000 / median)} fps`,
            `${median.toFixed(1)} ms · p95 ${p95.toFixed(1)} ms`,
            sizes ? `${mp.toFixed(2)} MP @ ${sizes.pixelRatio.toFixed(2)}x` : '',
            renderer ? `${renderer.instance.info.programs.length} programs` : '',
        ].filter(Boolean).join('\n')
    }
}
