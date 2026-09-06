import Experience from './Experience.js'
import { isMobile } from './Utils/device.js'
import { isTyping } from './Utils/typing.js'
import { quality } from './Utils/flags.js'
import Menu from './Menu.js'
import Views from './Views.js'
import Tour from './Tour.js'
import { locale, strings, t } from './config/i18n.js'

const BAR_CELLS = 34
/**
 * What each phase is worth on the counter.
 *
 * The last one exists because the counter used to reach a hundred and then sit
 * there: downloading and building both report, and the two jobs after them —
 * compiling every shader, then measuring the frame to pick a quality — did
 * not. A bar at a hundred with a button that will not answer reads as broken,
 * and reads worse the more honest work is happening behind it.
 */
const WEIGHT = { downloaded: 0.6, built: 0.25, finishing: 0.15 }

/**
 * Marks a tab that has already been through the gate.
 *
 * Session storage, not local: the gate is part of the first impression and a
 * visitor who comes back tomorrow should get it whole. What this undoes is
 * narrower — the same tab reloading under the visitor. A refresh, or a heavy
 * background tab discarded by the browser and rebuilt on return: the room has
 * to be decoded and uploaded again either way, but being asked to knock a
 * second time is the part that reads as a first visit when it is not one.
 */
const STORAGE_KEY = 'basement.entered'

/**
 * HTML overlay: loading gate with a real progress counter, HUD and hints.
 * `?shot` in the URL skips the gate and hides the HUD (used for screenshots).
 */
export default class UI
{
    constructor()
    {
        this.experience = new Experience()
        this.camera = this.experience.camera
        this.controls = this.experience.controls
        this.world = this.experience.world
        this.resources = this.experience.resources
        this.time = this.experience.time

        this.loader = document.getElementById('loader')
        this.hud = document.getElementById('hud')
        this.countEl = document.getElementById('count')
        this.barEl = document.getElementById('bar')
        this.logEl = document.getElementById('log')
        this.enterButton = document.getElementById('enter')
        this.exploreButton = document.getElementById('explore')
        this.hint = document.getElementById('hint')

        if (isMobile) document.body.classList.add('mobile')
        if (!quality.blur) document.body.classList.add('no-blur')

        document.documentElement.style.setProperty('--accent', this.experience.theme.accent)

        this.entered = false
        this.shown = 0      // eased value driving the counter
        this.sceneReady = false

        // Two jobs run at once and the counter has to cover both, weighted by
        // how long each actually takes: building the room is a handful of
        // frames, downloading the models is megabytes.
        this.built = 0
        this.downloaded = 0
        this.finishing = 0

        this.shotMode = new URLSearchParams(window.location.search).has('shot')
        if (this.shotMode) this.hud.classList.add('hidden')

        // Read once, before anything can enter and write it back.
        this.returning = this.wasEntered()

        this.setLoading()
        this.setControls()
        this.setLanguage()

        // Built last: it reads the hotspots, and Interactions registers
        // those when the world finishes, which is after all of this.
        this.menu = new Menu()
        this.views = new Views()
        this.tour = new Tour()

        // The eggs are built as one of the world's steps, so they do not exist
        // yet when this runs.
        if (this.world.ready) this.setEggs()
        else this.world.on('ready', () => this.setEggs())

        this.time.on('tick', () => this.update())
    }

    // ------------------------------------------------------------------
    setLoading()
    {
        this.renderBar(0)

        this.world.on('step', (label) =>
        {
            // A build step is its own label rather than a dictionary key, so it
            // is kept whole and re-resolved if the language changes mid-load.
            this.step = label
            delete this.logEl?.dataset.i18n
            this.applyLanguage()
        })

        this.world.on('progress', (value) => { this.built = value })
        this.world.on('finishing', (value) => { this.finishing = value })
        this.resources.on('progress', (value) => { this.downloaded = value })

        this.world.on('dressed', () => this.onSceneReady())

        // Both may already be done: the world builds synchronously in
        // screenshot mode, and 'dressed' fires once.
        if (this.world.ready) this.built = 1
        if (this.resources.ready) this.downloaded = 1
        if (this.world.dressed) this.onSceneReady()

        this.enterButton.addEventListener('click', () => this.enter())
    }

    /** The room is standing and the models are in it. */
    onSceneReady()
    {
        this.built = 1
        this.downloaded = 1
        this.finishing = 1
        this.sceneReady = true
        if (this.shotMode || this.returning) this.enter(true)
    }

    get target()
    {
        return this.built * WEIGHT.built
            + this.downloaded * WEIGHT.downloaded
            + this.finishing * WEIGHT.finishing
    }

    renderBar(ratio)
    {
        const filled = Math.round(ratio * BAR_CELLS)
        this.barEl.textContent = '█'.repeat(filled) + '░'.repeat(BAR_CELLS - filled)
    }

    // ------------------------------------------------------------------
    setControls()
    {
        document.addEventListener('keydown', (e) =>
        {
            if (e.code !== 'KeyF' || isMobile || !this.entered || isTyping()) return
            if (this.camera.mode === 'overview') this.controls.enable()
        })

        // Removed from the phone for now; free flight is still F on a
        // keyboard, and this survives the button not being there.
        this.exploreButton?.addEventListener('click', () =>
        {
            if (this.controls.active) this.controls.disable()
            else if (this.camera.mode === 'overview') this.controls.enable()
        })

        this.controls.on('start', () =>
        {
            this.camera.startFly()
            this.flying = true
            this.applyLanguage()
        })

        this.controls.on('end', () =>
        {
            this.flying = false
            this.applyLanguage()
            this.camera.endFly()
        })
    }

    // ------------------------------------------------------------------
    /**
     * The tally in the corner.
     *
     * Hidden at zero, on purpose. A counter reading nought out of something
     * turns the room into a checklist and tells every visitor there are things
     * to hunt before they have stumbled into one. It appears the moment the
     * first is found and never says how many are left.
     */
    setEggs()
    {
        this.eggs = this.experience.world.eggs
        if (!this.eggs) return

        this.eggsEl = document.getElementById('eggs')
        this.eggsCount = document.getElementById('eggs-count')

        this.renderEggs(this.eggs.count)
        this.eggs.on('found', (id, count, at) => this.celebrateEgg(count, at))
        this.eggs.on('reset', () => this.renderEggs(0))
    }

    eggsTitle(count)
    {
        return `${count} ${t(count === 1 ? strings.eggsLabelOne : strings.eggsLabelMany)}`
    }

    /**
     * Carries the find from the pointer up to the corner.
     *
     * The counter is a long way from wherever the visitor just pressed, and a
     * number quietly going up over there does not read as a consequence of
     * anything done over here. So an egg leaves the click, flies to the
     * counter, and the counter takes the hit: two ends of the room joined by
     * one movement, which is the whole job of the animation.
     */
    celebrateEgg(count, at)
    {
        // The counter has to be on screen before anything can fly to it.
        this.renderEggs(count)

        if (!at || !this.eggsEl || window.matchMedia('(prefers-reduced-motion: reduce)').matches)
        {
            this.popEggs()
            return
        }

        const fly = document.createElement('span')
        fly.className = 'egg-fly'
        fly.innerHTML = this.eggsEl.querySelector('svg').outerHTML
        fly.style.left = `${at.x}px`
        fly.style.top = `${at.y}px`

        const ring = document.createElement('span')
        ring.className = 'egg-ring'
        ring.style.left = `${at.x}px`
        ring.style.top = `${at.y}px`

        document.body.append(ring, fly)

        const target = this.eggsEl.getBoundingClientRect()
        const dx = target.left + target.width / 2 - at.x
        const dy = target.top + target.height / 2 - at.y

        // One frame at the start position, or the browser has nothing to
        // animate from and the egg simply appears at the counter.
        window.requestAnimationFrame(() =>
        {
            fly.style.transform = `translate(-50%, -50%) translate(${dx}px, ${dy}px) scale(0.4)`
            fly.style.opacity = '0.1'
        })

        window.setTimeout(() =>
        {
            fly.remove()
            ring.remove()
            this.popEggs()
        }, 640)
    }

    /** One bump on the counter, restartable so a second find is not silent. */
    popEggs()
    {
        if (!this.eggsEl) return

        this.eggsEl.classList.remove('found')
        void this.eggsEl.offsetWidth
        this.eggsEl.classList.add('found')
    }

    renderEggs(count, celebrate = false)
    {
        if (!this.eggsEl) return

        this.eggsFound = count
        this.eggsCount.textContent = count
        this.eggsEl.classList.toggle('hidden', count === 0)
        this.eggsEl.title = this.eggsTitle(count)

        if (celebrate) this.popEggs()
    }

    // ------------------------------------------------------------------
    setLanguage()
    {
        this.flying = false
        this.langButtons = [...document.querySelectorAll('.lang-toggle button')]

        for (const button of this.langButtons)
        {
            button.addEventListener('click', () => locale.set(button.dataset.lang))
        }

        locale.on('change', () => this.applyLanguage())
        this.applyLanguage()
    }

    /**
     * Rewrites every node that carries a dictionary key, plus the two labels
     * that depend on what the camera is doing.
     */
    applyLanguage()
    {
        for (const node of document.querySelectorAll('[data-i18n]'))
        {
            const value = strings[node.dataset.i18n]
            if (value) node.textContent = t(value)
        }

        if (this.step && this.logEl && !this.logEl.dataset.i18n) this.logEl.textContent = t(this.step)
        if (this.eggsEl) this.eggsEl.title = this.eggsTitle(this.eggsFound ?? 0)
        if (this.hint) this.hint.textContent = t(this.flying ? strings.hintFly : strings.hintIdle)
        if (this.exploreButton) this.exploreButton.textContent = t(this.flying ? strings.exploreBack : strings.explore)

        for (const button of this.langButtons ?? [])
        {
            button.classList.toggle('active', button.dataset.lang === locale.current)
        }
    }

    enter(instant = false)
    {
        if (this.entered) return
        this.entered = true
        this.remember()

        this.loader.classList.add('hidden')
        if (!this.shotMode) this.hud.classList.remove('hidden')
        this.camera.enter(instant ? 0 : 2.8).then(() =>
        {
            // After the arrival, not during it: a bar appearing over a camera
            // still moving reads as part of the loading rather than as an offer.
            if (!instant) this.tour?.start()
        })
        this.experience.renderer.reveal(instant ? 0 : 2.6)
    }

    wasEntered()
    {
        try
        {
            return window.sessionStorage.getItem(STORAGE_KEY) === '1'
        }
        catch (error)
        {
            // Private windows, blocked storage. The safe answer is no: one
            // extra click costs a second, a thrown error costs the room.
            return false
        }
    }

    remember()
    {
        try
        {
            window.sessionStorage.setItem(STORAGE_KEY, '1')
        }
        catch (error)
        {
            // Nothing to do and nothing worth saying.
        }
    }

    update()
    {
        if (this.entered) return

        // Never run ahead of the real work; just smooth it out, with a floor
        // so the counter always keeps moving.
        const rate = Math.max(0.12, (this.target - this.shown) * 2.4)
        this.shown = Math.min(this.target, this.shown + rate * this.time.delta)
        if (this.target - this.shown < 0.002) this.shown = this.target

        const pct = Math.floor(this.shown * 100)
        this.countEl.textContent = pct
        this.renderBar(this.shown)

        if (this.sceneReady && pct >= 100 && this.enterButton.disabled)
        {
            this.enterButton.disabled = false
            this.step = null
            this.logEl.dataset.i18n = 'ready'
            this.logEl.textContent = t(strings.ready)
        }
    }
}
