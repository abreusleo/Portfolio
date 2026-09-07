import { api } from './config/notes.js'
import { locale, strings, t } from './config/i18n.js'

/**
 * How many people are in the room, in the corner of the bar.
 *
 * The room is a single-player thing that nonetheless has a wall other people
 * have written on, and a head count is the cheapest way to say those people
 * were real. It is also the one number here that is true only right now, which
 * is why it is the only thing on screen that moves on its own.
 *
 * IT FAILS SILENTLY AND COMPLETELY. The count lives on the same box as the
 * notes, and that box is allowed to be down: a portfolio whose header shows a
 * broken widget is worse than one that never mentioned a count. Nothing is
 * shown until an answer arrives, and one failure puts it away for good rather
 * than retrying into a wall.
 *
 * The heartbeat is what does the counting — asking is how the server learns
 * somebody is here — so the interval is the resolution of the number, and the
 * server's own window is set wider than this so an ordinary visitor never
 * blinks out between two beats.
 */

/** Between beats. Slow enough to be nearly free, quick enough to be current. */
const EVERY = 25000

export default class Presence
{
    constructor()
    {
        this.root = document.getElementById('online')
        this.countEl = document.getElementById('online-count')
        this.labelEl = document.getElementById('online-label')
        this.count = null

        if (!this.root || !api) return

        this.beat()
        this.timer = window.setInterval(() => this.beat(), EVERY)

        // A tab in the background is not somebody in the room, and asking from
        // one keeps a closed laptop in the count. It catches up on return.
        document.addEventListener('visibilitychange', () =>
        {
            if (document.visibilityState === 'visible') this.beat()
        })

        locale.on('change', () => this.draw())
    }

    async beat()
    {
        if (this.gone || document.visibilityState !== 'visible') return

        try
        {
            const response = await fetch(`${api}/api/online`, { headers: { Accept: 'application/json' } })
            if (!response.ok) throw new Error(String(response.status))

            const body = await response.json()
            if (typeof body.online !== 'number') throw new Error('shape')

            this.count = body.online
            this.draw()
        }
        catch (error)
        {
            // Down, blocked, offline, or refused. Stop asking and stop showing.
            this.stop()
        }
    }

    draw()
    {
        if (this.count === null) return

        this.countEl.textContent = this.count
        this.labelEl.textContent = t(strings.online)
        this.root.classList.remove('hidden')
    }

    stop()
    {
        this.gone = true
        window.clearInterval(this.timer)
        this.root?.classList.add('hidden')
    }
}
