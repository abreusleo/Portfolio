import * as THREE from 'three'
import { deskTop } from '../config/layout.js'
import { box, cylinder, plane, screenMaterial } from './utils.js'
import { makeCodeScreen } from './Textures.js'

/**
 * L-shaped desk against the slat wall, curved ultrawide monitor,
 * a portrait monitor on an arm, speakers, lamp and a tidy tower.
 */
export default class Workstation
{
    constructor(world)
    {
        this.world = world
        this.scene = world.scene
        this.m = world.materials
        this.theme = world.theme

        this.group = new THREE.Group()
        this.group.name = 'workstation'
        this.scene.add(this.group)

        this.buildDesk()
        this.buildMainMonitor()
        this.buildSideMonitor()
        this.buildDeskItems()
        this.buildLamp()
        this.buildChair(1.55, -1.45, 0.22)
    }

    // ------------------------------------------------------------------
    buildDesk()
    {
        const m = this.m
        const g = this.group
        const t = deskTop
        const th = 0.04

        // Long run: from the left, all the way into the corner
        box(4.82, th, 0.84, m.deskWood, 1.09, t - th / 2, -2.58, g)
        // Return: continues down the right wall, closing the L
        box(0.84, th, 1.16, m.deskWood, 3.08, t - th / 2, -1.58, g)

        // Black square-profile legs
        const legH = t - th
        for (const [x, z] of [[-1.15, -2.9], [-1.15, -2.28], [2.85, -1.15], [3.35, -1.15]])
        {
            box(0.05, legH, 0.05, m.metal, x, legH / 2, z, g)
        }
        // Rails tying the legs together
        box(0.035, 0.035, 0.6, m.metal, -1.15, 0.12, -2.59, g)
        box(0.46, 0.035, 0.035, m.metal, 3.1, 0.12, -1.15, g)

        // Modesty panel + under-desk LED strip
        box(4.66, 0.18, 0.02, m.metalSoft, 1.09, t - 0.17, -2.97, g)
        const strip = box(4.4, 0.012, 0.012, m.ledSoft, 1.05, t - 0.075, -2.19, g)
        strip.castShadow = false
    }

    // ------------------------------------------------------------------
    buildMainMonitor()
    {
        const m = this.m
        const R = 1.5
        const arc = 0.88
        const height = 0.54
        const cx = 1.62
        const cy = deskTop + 0.42
        const cz = -2.76

        const g = new THREE.Group()
        g.name = 'monitor.main'
        g.position.set(cx, cy, cz + R)
        this.group.add(g)

        const tex = this.world.desktopScreen.texture
        tex.wrapS = THREE.ClampToEdgeWrapping
        tex.repeat.x = -1
        tex.offset.x = 1

        const screenMat = screenMaterial(tex, 1.15)
        screenMat.side = THREE.BackSide
        const screen = new THREE.Mesh(
            new THREE.CylinderGeometry(R, R, height, 64, 1, true, Math.PI - arc / 2, arc),
            screenMat,
        )
        screen.name = 'screen.main'
        g.add(screen)

        // Slim bezel
        const bezel = new THREE.Mesh(
            new THREE.CylinderGeometry(R + 0.012, R + 0.012, height + 0.024, 64, 1, true, Math.PI - arc / 2 - 0.012, arc + 0.024),
            m.plasticBack,
        )
        g.add(bezel)

        // Stand: flat plate + slim post
        box(0.055, 0.3, 0.05, m.metal, cx, deskTop + 0.15, cz - 0.06, this.group)
        box(0.38, 0.014, 0.2, m.metal, cx, deskTop + 0.007, cz - 0.05, this.group)
    }

    // ------------------------------------------------------------------
    buildSideMonitor()
    {
        const m = this.m
        const g = new THREE.Group()
        g.name = 'monitor.side'
        g.position.set(0.5, 1.26, -2.66)
        g.rotation.y = 0.5
        this.group.add(g)

        box(0.44, 0.68, 0.028, m.plastic, 0, 0, 0, g)
        const tex = makeCodeScreen({ accent: this.theme.accent })
        const screen = plane(0.405, 0.645, screenMaterial(tex, 0.85), 0, 0, 0.016, g)
        screen.name = 'screen.side'

        // Arm
        box(0.032, 0.032, 0.34, m.metal, 0, 0, -0.18, g)
        box(0.032, 0.56, 0.032, m.metal, 0.62, -0.4, -0.22, this.group)
        cylinder(0.075, 0.075, 0.022, m.metal, 0.62, deskTop + 0.013, -2.88, this.group, 16)
    }

    // ------------------------------------------------------------------
    buildDeskItems()
    {
        const m = this.m
        const g = this.group
        const t = deskTop

        // Desk mat, kept clear of the front edge
        const mat = plane(1.45, 0.5, m.fabricDark, 1.62, t + 0.003, -2.44, g)
        mat.rotation.x = -Math.PI / 2

        // Low-profile keyboard + mouse, each in its own group so a loaded
        // model can take the whole thing over by name
        const keyboard = new THREE.Group()
        keyboard.name = 'blockout.keyboard'
        g.add(keyboard)
        box(0.38, 0.016, 0.13, m.metalSoft, 1.52, t + 0.012, -2.34, keyboard)
        box(0.36, 0.004, 0.115, m.plastic, 1.52, t + 0.022, -2.34, keyboard)

        const mouse = box(0.058, 0.026, 0.095, m.plastic, 1.95, t + 0.017, -2.34, g)
        mouse.name = 'blockout.mouse'
        mouse.rotation.y = 0.15

        // Speakers
        for (const [x, ry] of [[0.98, -0.3], [2.42, 0.32]])
        {
            const s = new THREE.Group()
            s.position.set(x, t, -2.72)
            s.rotation.y = ry
            g.add(s)
            box(0.1, 0.19, 0.1, m.plastic, 0, 0.095, 0, s)
            const cone = cylinder(0.032, 0.032, 0.008, m.metalSoft, 0, 0.11, 0.051, s, 16)
            cone.rotation.x = Math.PI / 2
        }

        // Mug, in its own group so the tumbler can take it over by name
        const mug = new THREE.Group()
        mug.name = 'blockout.mug'
        g.add(mug)
        cylinder(0.038, 0.033, 0.09, m.white, 2.28, t + 0.045, -2.36, mug, 16)
        const handle = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.006, 6, 12, Math.PI), m.white)
        handle.position.set(2.32, t + 0.048, -2.36)
        handle.rotation.z = -Math.PI / 2
        mug.add(handle)

        // Closed laptop under the lamp, with the work badge dropped beside it
        this.laptop(3.02, t, -1.76, -0.28, g)
        this.badge(2.83, t, -1.45, 0.35, g)

        // Single tidy cable from the monitor down the back
        const curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(1.62, deskTop - 0.02, -2.85),
            new THREE.Vector3(1.68, 0.45, -2.92),
            new THREE.Vector3(1.75, 0.12, -2.89),
            new THREE.Vector3(1.9, 0.012, -2.76),
        ])
        g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.008, 6, false), m.cable))
    }

    /**
      * Closed laptop: aluminium slab with a lid seam and a rubber foot line.
      *
      * The pick target is deliberately a sibling rather than a child. It has
      * to survive the model swap, and everything inside this group is thrown
      * away the moment the real MacBook arrives.
      */
    laptop(x, y, z, rotation, parent)
    {
        const m = this.m

        const anchor = new THREE.Group()
        anchor.position.set(x, y, z)
        anchor.rotation.y = rotation
        parent.add(anchor)

        const g = new THREE.Group()
        g.name = 'blockout.laptop'
        g.position.set(x, y, z)
        g.rotation.y = rotation
        parent.add(g)

        const shell = new THREE.MeshStandardMaterial({ color: '#8f959c', roughness: 0.36, metalness: 0.82 })
        const seam = new THREE.MeshStandardMaterial({ color: '#4a4f56', roughness: 0.5, metalness: 0.6 })

        // Base and lid, with a hairline gap between them
        box(0.32, 0.009, 0.225, shell, 0, 0.006, 0, g)
        box(0.318, 0.001, 0.223, seam, 0, 0.0115, 0, g)
        box(0.32, 0.007, 0.225, shell, 0, 0.0155, 0, g)

        // Rounded front lip and the notch you lift it by
        const lip = cylinder(0.0045, 0.0045, 0.3, shell, 0, 0.0115, 0.111, g, 10)
        lip.rotation.z = Math.PI / 2
        box(0.05, 0.004, 0.006, seam, 0, 0.0115, 0.113, g)

        // Feet
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]])
        {
            box(0.02, 0.002, 0.02, seam, sx * 0.13, 0.001, sz * 0.085, g)
        }

        // Invisible plate over the lid, tipped towards the room. It is both
        // the pick target and the surface the camera station is read from,
        // so the framing comes out above the desk instead of level with it.
        const proxy = new THREE.Mesh(
            new THREE.PlaneGeometry(0.36, 0.24),
            new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
        )
        proxy.position.set(0, 0.075, 0.01)
        proxy.rotation.x = -Math.PI / 2 + 1.05
        proxy.name = 'hotspot.laptop'
        proxy.userData.noWire = true
        proxy.renderOrder = -1
        anchor.add(proxy)

        return g
    }

    /** Work badge in its holder, cord left where it fell. */
    badge(x, y, z, rotation, parent)
    {
        const g = new THREE.Group()
        g.position.set(x, y, z)
        g.rotation.y = rotation
        parent.add(g)

        const holder = new THREE.MeshStandardMaterial({ color: '#aeb4bc', roughness: 0.3, metalness: 0.15 })
        const card = new THREE.MeshStandardMaterial({ color: '#e6e8ec', roughness: 0.85 })
        const band = new THREE.MeshStandardMaterial({ color: this.theme.accent, roughness: 0.7 })
        const cord = new THREE.MeshStandardMaterial({ color: '#20242c', roughness: 0.95 })

        box(0.058, 0.002, 0.09, holder, 0, 0.001, 0, g)
        box(0.05, 0.0016, 0.078, card, 0, 0.0026, 0.002, g)
        box(0.05, 0.0018, 0.016, band, 0, 0.0032, -0.026, g)
        box(0.014, 0.0025, 0.006, holder, 0, 0.0035, -0.048, g)

        // The lanyard, dropped in a loose loop
        const curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, 0.004, -0.05),
            new THREE.Vector3(0.04, 0.004, -0.105),
            new THREE.Vector3(0.115, 0.004, -0.115),
            new THREE.Vector3(0.145, 0.004, -0.05),
            new THREE.Vector3(0.105, 0.004, -0.005),
        ])
        g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 28, 0.004, 5, false), cord))
    }

    /** Small snake plant: concrete pot + tapered blades. */
    plant(x, y, z, scale, parent)
    {
        const m = this.m
        const g = new THREE.Group()
        g.position.set(x, y, z)
        g.scale.setScalar(scale)
        parent.add(g)

        cylinder(0.075, 0.062, 0.16, m.pot, 0, 0.08, 0, g, 16)
        const soil = cylinder(0.068, 0.068, 0.01, m.soil, 0, 0.158, 0, g, 16)
        soil.castShadow = false

        for (let i = 0; i < 7; i++)
        {
            const a = (i / 7) * Math.PI * 2 + 0.4
            const h = 0.3 + (i % 3) * 0.12
            const blade = cylinder(0.004, 0.026, h, m.leaf, Math.cos(a) * 0.03, 0.16 + h / 2, Math.sin(a) * 0.03, g, 4)
            blade.rotation.z = Math.cos(a) * 0.22
            blade.rotation.x = -Math.sin(a) * 0.22
            blade.scale.z = 0.35
        }
        return g
    }

    // ------------------------------------------------------------------
    buildLamp()
    {
        const m = this.m
        // Turned around so the head reaches over the laptop
        const g = new THREE.Group()
        g.name = 'blockout.desklamp'
        g.position.set(3.3, deskTop, -1.42)
        g.rotation.y = Math.PI
        this.group.add(g)

        cylinder(0.09, 0.09, 0.018, m.metal, 0, 0.009, 0, g, 20)
        box(0.022, 0.52, 0.022, m.metal, 0, 0.27, 0, g)
        box(0.022, 0.022, 0.34, m.metal, 0, 0.525, 0.16, g)

        const shade = cylinder(0.055, 0.055, 0.05, m.metal, 0, 0.5, 0.32, g, 18)
        const bulb = plane(0.09, 0.09, m.ledWarm, 0, 0.474, 0.32, g)
        bulb.rotation.x = Math.PI / 2

        const light = new THREE.SpotLight(this.theme.lightWarm, 2.9, 2.4, 0.78, 0.55, 2)
        light.position.set(3.3, deskTop + 0.47, -1.74)
        light.target.position.set(3.04, deskTop, -1.82)
        this.scene.add(light)
        this.scene.add(light.target)
    }

    // ------------------------------------------------------------------
    buildChair(x, z, ry)
    {
        const m = this.m
        const g = new THREE.Group()
        g.name = 'blockout.chair'
        g.position.set(x, 0, z)
        g.rotation.y = ry
        this.group.add(g)

        // Five-star base
        for (let i = 0; i < 5; i++)
        {
            const a = (i / 5) * Math.PI * 2
            const arm = box(0.3, 0.028, 0.045, m.metalSoft, Math.cos(a) * 0.15, 0.045, Math.sin(a) * 0.15, g)
            arm.rotation.y = -a
            const caster = cylinder(0.026, 0.026, 0.02, m.plastic, Math.cos(a) * 0.29, 0.026, Math.sin(a) * 0.29, g, 10)
            caster.rotation.x = Math.PI / 2
        }

        cylinder(0.028, 0.028, 0.4, m.metalSoft, 0, 0.25, 0, g, 12)

        // Seat
        const seat = box(0.46, 0.07, 0.44, m.fabricDark, 0, 0.47, 0, g)
        seat.rotation.x = 0.04

        // Mesh back
        const back = box(0.44, 0.56, 0.05, m.fabricDark, 0, 0.79, -0.2, g)
        back.rotation.x = -0.12
        box(0.46, 0.05, 0.06, m.metalSoft, 0, 1.06, -0.24, g).rotation.x = -0.12

        // Armrests
        for (const sx of [-1, 1])
        {
            box(0.05, 0.028, 0.26, m.plastic, sx * 0.25, 0.66, -0.02, g)
            box(0.028, 0.16, 0.028, m.metalSoft, sx * 0.25, 0.57, -0.06, g)
        }
    }

    update()
    {
        // Static by design: the modern room stays calm.
    }
}
