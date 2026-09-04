import * as THREE from 'three'
import { room } from '../config/layout.js'
import { box, cylinder, plane } from './utils.js'

/**
 * Architectural lighting for the modern basement:
 * two surface-mounted linear LED bars, track spots washing the art wall,
 * bias light behind the monitor and an under-desk strip.
 * Baked lighting replaces most of this in the Blender phase.
 */
export default class Lights
{
    constructor(world)
    {
        this.world = world
        this.scene = world.scene
        this.m = world.materials
        this.theme = world.theme
        this.debug = world.experience.debug

        const mul = this.theme.lightMul

        this.params = {
            hemisphere: 0.22 * mul,
            bar: 5.5 * mul,
            barSpot: 9 * mul,
            wash: 7 * mul,
            bias: 2.4,
            underDesk: 1.6,
        }

        this.group = new THREE.Group()
        this.group.name = 'lights'
        this.scene.add(this.group)

        this.hemisphere = new THREE.HemisphereLight('#3b4152', '#0a0b0c', this.params.hemisphere)
        this.group.add(this.hemisphere)

        this.bars = [
            this.createBar(0.8, -1.95, 4.0, true),
            this.createBar(-0.3, 0.7, 3.2, false),
        ]

        this.createTrack()
        this.createBias()
        this.createUnderDesk()

        this.setDebug()
    }

    /** Surface-mounted linear luminaire running along X. */
    createBar(x, z, length, withShadow)
    {
        const { height: H } = room
        const m = this.m
        const y = H - 0.06

        const g = new THREE.Group()
        g.position.set(x, 0, z)
        this.group.add(g)

        box(length, 0.075, 0.085, m.metal, 0, y, 0, g)
        const diffuser = box(length - 0.06, 0.02, 0.055, m.ledWarm, 0, y - 0.05, 0, g)
        diffuser.castShadow = false

        const rect = new THREE.RectAreaLight(this.theme.lightWarm, this.params.bar, length - 0.06, 0.07)
        rect.position.set(0, y - 0.06, 0)
        g.add(rect)
        rect.lookAt(x, 0, z)

        let spot = null
        if (withShadow)
        {
            spot = new THREE.SpotLight(this.theme.lightWarm, this.params.barSpot, 9, 1.05, 0.95, 1.4)
            spot.position.set(0, y - 0.06, 0)
            spot.target.position.set(0.2, 0, 0.3)
            spot.castShadow = true
            spot.shadow.mapSize.set(1024, 1024)
            spot.shadow.bias = -0.0004
            spot.shadow.normalBias = 0.02
            spot.shadow.camera.near = 0.3
            spot.shadow.camera.far = 8
            g.add(spot)
            g.add(spot.target)
        }

        return { group: g, rect, spot, diffuser }
    }

    /** Ceiling track with three heads washing the art on the right wall. */
    createTrack()
    {
        const { width: W, height: H } = room
        const m = this.m
        const x = W / 2 - 0.55
        const zs = [0.75, 1.35, 1.95]

        const rail = box(0.05, 0.035, 1.8, m.metal, x, H - 0.02, 1.35, this.group)
        rail.castShadow = false

        for (const z of zs)
        {
            const head = new THREE.Group()
            head.position.set(x, H - 0.13, z)
            head.rotation.z = -0.55
            this.group.add(head)
            cylinder(0.045, 0.05, 0.14, m.metal, 0, 0, 0, head, 12)
            plane(0.07, 0.07, m.ledNeutral, 0, -0.072, 0, head).rotation.x = Math.PI / 2
        }

        this.wash = new THREE.SpotLight(this.theme.lightNeutral, this.params.wash, 6, 0.7, 0.9, 1.3)
        this.wash.position.set(x, H - 0.15, 1.4)
        this.wash.target.position.set(W / 2, 1.5, 1.5)
        this.group.add(this.wash)
        this.group.add(this.wash.target)

        // Small grazing light for the shelves and prints on the slat wall
        this.shelfWash = new THREE.SpotLight(this.theme.lightWarm, 4.5 * this.theme.lightMul, 5, 0.75, 0.95, 1.4)
        this.shelfWash.position.set(-0.6, H - 0.12, -2.3)
        this.shelfWash.target.position.set(-0.7, 1.8, -3)
        this.group.add(this.shelfWash)
        this.group.add(this.shelfWash.target)
    }

    /** Warm bias light behind the main monitor, bouncing off the slat wall. */
    createBias()
    {
        const { depth: D } = room
        this.bias = new THREE.RectAreaLight(this.theme.accent, this.params.bias, 1.6, 0.45)
        this.bias.position.set(1.62, 1.32, -D / 2 + 0.2)
        this.bias.lookAt(1.62, 1.4, -D / 2)
        this.group.add(this.bias)
    }

    /** LED strip under the desk lip, grazing the floor. */
    createUnderDesk()
    {
        const strip = new THREE.PointLight(this.theme.lightWarm, this.params.underDesk, 3.2, 2)
        strip.position.set(0.9, 0.62, -2.35)
        this.group.add(strip)
        this.underDesk = strip
    }

    setDebug()
    {
        if (!this.debug.active) return
        const f = this.debug.ui.addFolder('Lights')
        f.add(this.params, 'hemisphere').min(0).max(1.5).step(0.01).onChange((v) => { this.hemisphere.intensity = v })
        f.add(this.params, 'bar').min(0).max(20).step(0.1).name('Linear bars').onChange((v) => { for (const b of this.bars) b.rect.intensity = v })
        f.add(this.params, 'barSpot').min(0).max(40).step(0.1).name('Bar spot').onChange((v) => { for (const b of this.bars) if (b.spot) b.spot.intensity = v })
        f.add(this.params, 'wash').min(0).max(30).step(0.1).name('Wall wash').onChange((v) => { this.wash.intensity = v })
        f.add(this.params, 'bias').min(0).max(10).step(0.1).name('Monitor bias').onChange((v) => { this.bias.intensity = v })
        f.add(this.params, 'underDesk').min(0).max(6).step(0.1).name('Under desk').onChange((v) => { this.underDesk.intensity = v })
    }

    update()
    {
        // Architectural lighting is steady on purpose — no flicker.
    }
}
