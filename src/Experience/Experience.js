import * as THREE from 'three'

import Debug from './Utils/Debug.js'
import Sizes from './Utils/Sizes.js'
import Time from './Utils/Time.js'
import Resources from './Utils/Resources.js'
import sources from './sources.js'

import Camera from './Camera.js'
import Renderer from './Renderer.js'
import FreeFlyControls from './Controls/FreeFlyControls.js'
import World from './World/World.js'
import Interactions from './Interactions.js'
import UI from './UI.js'
import Meter from './Utils/Meter.js'
import Quality from './Quality.js'
import { pickTheme } from './World/Themes.js'

let instance = null

export default class Experience
{
    constructor(canvas)
    {
        if (instance) return instance
        instance = this
        window.experience = this

        this.canvas = canvas

        // Utils
        this.debug = new Debug()
        this.sizes = new Sizes()
        this.time = new Time()

        // Scene
        this.theme = pickTheme()
        this.scene = new THREE.Scene()
        this.scene.background = new THREE.Color(this.theme.background)
        this.scene.fog = new THREE.Fog(this.theme.background, this.theme.fog[0], this.theme.fog[1])

        if (this.debug.active)
        {
            const f = this.debug.ui.addFolder('Scene')
            f.addColor(this.scene, 'background').name('Background').onChange((v) => this.scene.fog.color.copy(v))
            f.add(this.scene.fog, 'near').min(0).max(20).step(0.1).name('Fog near')
            f.add(this.scene.fog, 'far').min(0).max(40).step(0.1).name('Fog far')
        }

        // Core
        this.camera = new Camera()
        this.renderer = new Renderer()
        this.resources = new Resources(sources)
        this.controls = new FreeFlyControls()
        this.world = new World()
        this.interactions = new Interactions()
        this.quality = new Quality()
        this.meter = new Meter()
        this.meter.renderer = this.renderer
        this.ui = new UI()

        // Events
        this.sizes.on('resize', () => this.resize())
        this.time.on('tick', () => this.update())
    }

    resize()
    {
        this.camera.resize()
        this.interactions?.markers?.resize()
        this.renderer.resize()
    }

    update()
    {
        this.meter.tick()
        this.quality.update(this.time.delta)
        this.controls.update(this.time.delta)
        this.camera.update()
        this.world.update()
        this.interactions.update()
        this.renderer.update()
    }
}
