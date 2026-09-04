import EventEmitter from './EventEmitter.js'

export default class Time extends EventEmitter
{
    constructor()
    {
        super()

        this.start = performance.now()
        this.current = this.start
        this.elapsed = 0
        this.delta = 16 / 1000

        window.requestAnimationFrame(() => this.tick())
    }

    tick()
    {
        const now = performance.now()
        this.delta = Math.min((now - this.current) / 1000, 0.1)
        this.current = now
        this.elapsed = (now - this.start) / 1000

        this.trigger('tick')

        window.requestAnimationFrame(() => this.tick())
    }
}
