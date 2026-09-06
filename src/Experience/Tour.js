import Experience from './Experience.js'
import content from './config/content.js'
import { locale, strings, t } from './config/i18n.js'
import { quality } from './Utils/flags.js'
import stations from './config/stations.js'

/**
 * A first walk through the room, for somebody who has just arrived in one.
 *
 * The room says nothing about itself. Every object worth pressing looks
 * exactly like every object that is not, and the only thing that ever told
 * anybody otherwise was the mouse cursor — which a phone does not have. So a
 * visitor lands in a rendered room and is left to guess, which is what the
 * feedback said in other words.
 *
 * It does not open the panels. Six panels opening and closing in a row is a
 * lot of motion to sit through, and being lost is a question about where
 * things are rather than what they say. The camera walks to each place, a bar
 * names it, and reading stays the visitor's own choice — which also means the
 * tour is over the moment they press something themselves.
 */

/**
 * The order, and it is not the order the room was built in.
 *
 * What he made comes first because it is the substance, then the two that live
 * outside the server, then the work that pays for the rest, then the person,
 * then the shelf of small things — and the quote last, because it is the one
 * stop that is not an argument and it closes better than anything else here.
 *
 * The TV is deliberately absent. Every one of its six entries currently says
 * the demo is not published, and a first visit that culminates in a thing that
 * does not exist is worse than one stop shorter. It belongs back in this list
 * on the day there is a video.
 */
const STEPS = ['prints', 'products', 'work', 'about', 'pc', 'board']

const STORAGE_KEY = 'basement.toured'

export default class Tour
{
    constructor()
    {
        this.experience = new Experience()
        this.camera = this.experience.camera

        this.root = document.getElementById('tour')
        this.stepEl = document.getElementById('tour-step')
        this.eyebrowEl = document.getElementById('tour-eyebrow')
        this.titleEl = document.getElementById('tour-title')
        this.nextButton = document.getElementById('tour-next')
        this.skipButton = document.getElementById('tour-skip')
        if (!this.root) return

        this.at = -1
        this.running = false

        this.nextButton.addEventListener('click', () => this.advance())
        this.skipButton.addEventListener('click', () => this.stop(true))
        locale.on('change', () => { if (this.running) this.draw() })
    }

    /** Only somebody who has not been walked through before, and never for a shot. */
    get wanted()
    {
        if (!this.root || quality.shot) return false

        try
        {
            return window.localStorage.getItem(STORAGE_KEY) === null
        }
        catch (error)
        {
            // Storage blocked. Offering the walk again is a smaller cost than
            // never offering it, so it is offered.
            return true
        }
    }

    start()
    {
        if (!this.wanted) return

        this.running = true
        this.at = -1
        this.advance()
    }

    advance()
    {
        this.at++
        if (this.at >= STEPS.length) return this.stop(true)

        const id = STEPS[this.at]
        const hotspot = this.experience.interactions?.find(id)
        if (!hotspot?.station) return this.advance()

        this.camera.goTo(hotspot.station, this.at === 0 ? 1.8 : 1.4, 'power2.inOut')
        this.draw(hotspot)

        this.root.classList.remove('hidden')
        this.root.setAttribute('aria-hidden', 'false')
    }

    draw(hotspot = this.experience.interactions?.find(STEPS[this.at]))
    {
        // Most stops have panel copy to borrow a name from. The machine does
        // not — it opens a desktop rather than a panel — so its hotspot label
        // is the name, and it goes without the line above it rather than
        // inheriting the previous stop's, which is what a bare early return
        // left on screen.
        const entry = content[STEPS[this.at]]

        this.eyebrowEl.textContent = entry ? (t(entry.eyebrow) ?? '') : ''
        this.titleEl.textContent = entry ? (t(entry.title) ?? '') : (t(hotspot?.label) ?? '')
        this.stepEl.textContent = `${this.at + 1}/${STEPS.length}`

        const last = this.at === STEPS.length - 1
        this.nextButton.textContent = t(last ? strings.tourDone : strings.tourNext)
        this.skipButton.hidden = last
    }

    /**
     * Ends it, and remembers that it ended.
     *
     * Finishing or skipping walks back to where the room opens, because that
     * is the handover: the last stop is a station framed on one object, the
     * arrows barely turn from there, and leaving somebody parked against a
     * wall is not giving them the room. Pressing something in the scene ends
     * it too and does not walk anywhere — they have already chosen where to be.
     */
    stop(home = false)
    {
        if (!this.running) return

        this.running = false
        if (home) this.camera.goTo(stations.overview, 1.4, 'power2.inOut')
        this.root.classList.add('hidden')
        this.root.setAttribute('aria-hidden', 'true')

        try
        {
            window.localStorage.setItem(STORAGE_KEY, '1')
        }
        catch (error)
        {
            // Then it is offered again next time, which is the safe way round.
        }
    }
}
