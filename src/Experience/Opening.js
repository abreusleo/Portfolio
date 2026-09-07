import gsap from 'gsap'

import Experience from './Experience.js'
import stations from './config/stations.js'
import { strings, t } from './config/i18n.js'
import { isMobile } from './Utils/device.js'
import { quality } from './Utils/flags.js'

/**
 * The way in: one move through the room, with the name over it.
 *
 * What used to happen was that the room finished assembling and the guided
 * visit started in the same instant, so the first framing anybody saw was a
 * shelf at arm's length. The best thing the project has — a room — was spent
 * before it landed, and the only thing saying what the site was is a wordmark
 * in twelve pixels in a corner.
 *
 * So the arrival became a travelling shot. It starts on the door, because that
 * is where somebody would come in, crosses the printed wall, opens onto the
 * whole room, and settles into the station the rest of the navigation is
 * authored from.
 *
 * IT CAN BE STOPPED AT ANY POINT. A visitor who already knows the room should
 * not have to watch it, and one who came to press something should not be made
 * to wait: any tap, click or key cuts to the end. That is what makes six
 * seconds affordable, and it is also why the card says so.
 *
 * Once per person, not once per visit. It is remembered, and everybody who has
 * already been walked in gets the short settle the arrival always was.
 */

/**
 * Where the camera goes and what it looks at on the way.
 *
 * Measured rather than composed: each of these was put on screen and looked at,
 * and the positions where each hotspot lands were read back, before any of it
 * was written down. The last one is the overview station itself, verbatim,
 * because the move has to end where the room's own navigation begins.
 */
const PATH = [
    { position: [-2.72, 1.86, 2.28], target: [-2.58, 1.32, -2.91], fov: 58 },
    { position: [-2.55, 1.82, 2.10], target: [1.10, 1.78, -2.94], fov: 54 },
    { position: [-2.35, 1.74, 1.88], target: [2.95, 1.42, -1.90], fov: 51 },
    stations.overview,
]

/** Long enough to read the room, short enough that skipping is a choice. */
const DURATION = 6.6

/** Marks somebody who has already been walked in. */
const STORAGE_KEY = 'basement.opened'

export default class Opening
{
    constructor()
    {
        this.experience = new Experience()
        this.camera = this.experience.camera

        this.root = document.getElementById('opening')
        this.running = false
        this.seen = this.wasSeen()

        // Named for the gesture the visitor actually has. The key is left on
        // the node so a language change afterwards still finds the right one.
        const skip = this.root?.querySelector('.opening-skip')
        if (skip)
        {
            skip.dataset.i18n = isMobile ? 'openingSkip' : 'openingSkipDesk'
            skip.textContent = t(strings[skip.dataset.i18n])
        }
    }

    /** Nobody sees this twice, and no screenshot ever sees it. */
    get wanted()
    {
        return !!this.root && !this.seen && !quality.shot
    }

    /**
     * Returns when the camera is parked, however it got there.
     *
     * The caller has work waiting on the arrival either way — the guided visit
     * is offered after it — and that work should not have to know whether this
     * ran, was skipped, or was never wanted.
     */
    run()
    {
        if (!this.wanted) return this.camera.enter(2.8)

        this.running = true
        this.remember()
        this.listen()

        this.show()
        return this.camera.flyThrough(PATH, DURATION).then(() => this.done())
    }

    /**
     * Any input at all ends it. Not a button: a button is one small target in
     * a frame that is otherwise asking to be touched, and somebody reaching for
     * the room is already saying they would rather be in it.
     */
    listen()
    {
        this.skip = () =>
        {
            if (!this.running) return
            this.camera.stopTravel()
            this.camera.goTo(stations.overview, 0.9, 'power2.out').then(() => this.done())
        }

        this.onKey = (e) =>
        {
            // Not the language and view switches in the corner, which are the
            // one thing somebody might legitimately press on the way in.
            if (e.key === 'Tab' || e.key === 'Shift') return
            this.skip()
        }

        window.addEventListener('pointerdown', this.skip, { once: true })
        window.addEventListener('keydown', this.onKey, { once: true })
    }

    done()
    {
        if (!this.running) return
        this.running = false

        window.removeEventListener('pointerdown', this.skip)
        window.removeEventListener('keydown', this.onKey)
        this.hide()
    }

    show()
    {
        this.root.classList.remove('hidden')
        document.body.classList.add('opening-running')
        gsap.fromTo(
            this.root,
            { opacity: 0 },
            { opacity: 1, duration: 1.1, delay: 0.9, ease: 'power1.out' },
        )
    }

    hide()
    {
        document.body.classList.remove('opening-running')
        gsap.to(this.root, {
            opacity: 0,
            duration: 0.7,
            ease: 'power1.out',
            onComplete: () => this.root.classList.add('hidden'),
        })
    }

    wasSeen()
    {
        try
        {
            return window.localStorage.getItem(STORAGE_KEY) === '1'
        }
        catch (error)
        {
            // Blocked storage. Showing it again costs somebody six seconds they
            // can end with a finger; refusing to show it costs the entrance.
            return false
        }
    }

    remember()
    {
        try
        {
            window.localStorage.setItem(STORAGE_KEY, '1')
        }
        catch (error)
        {
            // Nothing to do and nothing worth saying.
        }
    }
}
