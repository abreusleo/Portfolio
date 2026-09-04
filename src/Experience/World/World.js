import EventEmitter from '../Utils/EventEmitter.js'
import Experience from '../Experience.js'
import Materials from './Materials.js'
import Room from './Room.js'
import Lights from './Lights.js'
import Workstation from './Workstation.js'
import Pc from './Pc.js'
import Shelves from './Shelves.js'
import Tv from './Tv.js'
import Credenza from './Credenza.js'
import GlassBoard from './GlassBoard.js'
import FramedPrints from './FramedPrints.js'
import Props from './Props.js'
import Personal from './Personal.js'
import Notes from './Notes.js'
import DesktopScreen from './DesktopScreen.js'
import Wireframe from './Wireframe.js'
import Eggs from './Eggs.js'
import Models from './Models.js'
import { locale } from '../config/i18n.js'

/**
 * The basement. Built one step per frame so the loader can report real
 * progress. Each part is its own module, ready to be swapped for the
 * Blender GLB piece by piece.
 */
export default class World extends EventEmitter
{
    constructor()
    {
        super()

        this.experience = new Experience()
        this.scene = this.experience.scene
        this.time = this.experience.time
        this.resources = this.experience.resources
        this.theme = this.experience.theme

        // Words are drawn into canvases all over this room, so a language change
        // has to reach further than the DOM. Registered here rather than after
        // the models land: a visitor can switch while the room is still
        // loading, and 'change' fires once.
        locale.on('change', () => this.retext())

        this.ready = false
        this.dressed = false
        this.updatables = []

        this.steps = [
            [{ pt: 'materiais', en: 'materials' }, () =>
            {
                const maxAniso = this.experience.renderer.instance.capabilities.getMaxAnisotropy()
                this.materials = new Materials(this.theme, Math.min(8, maxAniso))
            }],
            [{ pt: 'sala', en: 'room' }, () => { this.room = new Room(this) }],
            [{ pt: 'luzes', en: 'lights' }, () => { this.lights = new Lights(this) }],
            [{ pt: 'tela', en: 'screen' }, () => { this.desktopScreen = new DesktopScreen() }],
            [{ pt: 'mesa', en: 'desk' }, () => { this.workstation = new Workstation(this) }],
            [{ pt: 'pc', en: 'pc' }, () => { this.pc = new Pc(this) }],
            [{ pt: 'prateleiras', en: 'shelves' }, () => { this.shelves = new Shelves(this) }],
            [{ pt: 'telas', en: 'screens' }, () => { this.tv = new Tv(this); this.credenza = new Credenza(this) }],
            [{ pt: 'quadros', en: 'frames' }, () => { this.glassBoard = new GlassBoard(this); this.prints = new FramedPrints(this) }],
            [{ pt: 'objetos', en: 'objects' }, () => { this.props = new Props(this); this.personal = new Personal(this) }],
            [{ pt: 'recados', en: 'notes' }, () => { this.notes = new Notes(this) }],
            [{ pt: 'segredos', en: 'secrets' }, () => { this.eggs = new Eggs(this) }],
        ]

        // Screenshot mode builds in one go so headless captures a finished frame.
        if (new URLSearchParams(window.location.search).has('shot')) this.buildNow()
        else this.build()
    }

    buildNow()
    {
        for (const [, fn] of this.steps) fn()
        this.finish()
        this.trigger('progress', 1)
        this.trigger('ready')
    }

    finish()
    {
        this.updatables = [this.lights, this.workstation, this.credenza, this.desktopScreen]
        this.ready = true

        // The files may already be in: 'ready' fires once and this listener
        // would be too late for it.
        if (this.resources.ready) this.onResourcesReady()
        else this.resources.on('ready', () => this.onResourcesReady())
    }

    /** Runs one construction step per frame, emitting progress in [0, 1]. */
    build()
    {
        let i = 0
        const run = () =>
        {
            const step = this.steps[i]
            this.trigger('step', step[0])
            step[1]()
            i++
            this.trigger('progress', i / this.steps.length)

            if (i < this.steps.length)
            {
                window.requestAnimationFrame(run)
                return
            }

            this.finish()
            this.trigger('ready')
        }
        window.requestAnimationFrame(run)
    }

    /**
      * Swap the blockouts for the downloaded models, then bake the edge
      * overlay. That order matters: the wireframe merges every edge in the
      * scene into one buffer, so baking it first would draw the room the
      * models have just replaced.
      */
    /**
     * Every surface in the room that has words on it.
     *
     * Each one is isolated. These run from an event, and an exception thrown
     * inside a listener takes the listeners after it down with it — which is
     * how a single broken texture once left half the room translated and the
     * buttons in the other language.
     */
    retext()
    {
        for (const [name, part] of Object.entries({
            prints: this.prints,
            tv: this.tv,
            shelves: this.shelves,
            macbook: this.macbook,
        }))
        {
            try
            {
                part?.retext?.()
            }
            catch (error)
            {
                console.warn(`[i18n] ${name} could not be redrawn`, error)
            }
        }
    }

    async onResourcesReady()
    {
        this.models = new Models(this)
        this.wireframe = new Wireframe(this)

        // Every shader and texture in the room, ready before the first frame
        // is drawn: the renderer has been holding off until now. The counter
        // is already at a hundred by this point, so the step label is what
        // says the wait is real.
        this.trigger('step', { pt: 'shaders', en: 'shaders' })
        await this.experience.renderer.prewarm()

        // The shadow maps are frozen by design; this is the one pass that
        // draws them, with the models in.
        this.experience.renderer.instance.shadowMap.needsUpdate = true

        // Drawing starts here, and the gate opens four lines further down.
        // Between the two the room is rendering full frames with the loader
        // still over the canvas — which is the only moment the ladder can be
        // walked without the visitor watching it happen. Stepping down in
        // front of somebody means the first thing they are shown is the
        // version that had to be abandoned, and on a portfolio the first
        // thing shown is the whole point.
        this.dressed = true
        this.experience.renderer.world = this

        this.trigger('step', { pt: 'ajustando', en: 'tuning' })
        await this.experience.quality.calibrate()

        this.trigger('dressed')
    }

    update()
    {
        if (!this.ready) return
        for (const u of this.updatables) u.update(this.time)
    }
}
