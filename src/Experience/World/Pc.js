import * as THREE from 'three'
import { deskTop } from '../config/layout.js'
import { box, cylinder, plane } from './utils.js'
import { makeHexMesh, makePumpDisplay } from './Textures.js'

/**
 * White "fishtank" tower on the desk, modelled on the reference photo:
 * glass on the front and left side, white frame, angular LED strips,
 * AIO with a round pump readout, white GPU and vertical RAM.
 */
export default class Pc
{
    constructor(world, x = 3.02, z = -2.62, rotation = -0.52)
    {
        this.world = world
        this.scene = world.scene
        this.m = world.materials

        this.W = 0.27    // X
        this.H = 0.53    // Y
        this.D = 0.5     // Z

        this.group = new THREE.Group()
        this.group.name = 'pc'
        this.group.position.set(x, deskTop, z)
        this.group.rotation.y = rotation
        this.scene.add(this.group)

        this.setMaterials()
        this.buildPickTarget()
        this.buildChassis()
        this.buildMotherboard()
        this.buildCooling()
        this.buildGpu()
        this.buildLighting()
        this.buildGlass()
    }

    /** Invisible box around the tower, so the whole machine is clickable. */
    buildPickTarget()
    {
        const target = new THREE.Mesh(
            new THREE.BoxGeometry(this.W + 0.04, this.H + 0.02, this.D + 0.04),
            new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
        )
        target.position.set(0, this.H / 2, 0)
        target.name = 'hotspot.pc'
        target.userData.noWire = true
        target.renderOrder = -1
        this.group.add(target)
    }

    setMaterials()
    {
        this.white = new THREE.MeshStandardMaterial({ color: '#eceef0', roughness: 0.42, metalness: 0.12 })
        this.whiteSoft = new THREE.MeshStandardMaterial({ color: '#c9ced4', roughness: 0.62, metalness: 0.08 })
        this.inner = new THREE.MeshStandardMaterial({ color: '#0d0f13', roughness: 0.78, metalness: 0.1 })
        this.pcb = new THREE.MeshStandardMaterial({ color: '#12161c', roughness: 0.55, metalness: 0.3 })
        this.dark = new THREE.MeshStandardMaterial({ color: '#1b1f25', roughness: 0.7, metalness: 0.25 })

        const hex = makeHexMesh({ cols: 30 })
        hex.repeat.set(2, 2)
        this.mesh = new THREE.MeshStandardMaterial({ map: hex, roughness: 0.7, metalness: 0.2 })

        this.led = new THREE.MeshStandardMaterial({
            color: '#000000', emissive: '#cfe4f7', emissiveIntensity: 1.45, roughness: 0.4,
        })
        this.ledRam = new THREE.MeshStandardMaterial({
            color: '#000000', emissive: '#9dffc0', emissiveIntensity: 2.0, roughness: 0.4,
        })
    }

    // ------------------------------------------------------------------
    buildChassis()
    {
        const { W, H, D } = this
        const g = this.group

        // Outer shell
        box(W, 0.016, D, this.white, 0, H - 0.008, 0, g)
        box(W, 0.016, D, this.white, 0, 0.008, 0, g)
        box(0.014, H, D, this.white, W / 2 - 0.007, H / 2, 0, g)
        box(W, H, 0.014, this.white, 0, H / 2, -D / 2 + 0.007, g)

        // Interior linings: perforated tray on the right, flat panel at the back
        box(0.004, H - 0.03, D - 0.03, this.mesh, W / 2 - 0.016, H / 2, 0, g)
        box(W - 0.03, H - 0.03, 0.004, this.inner, 0, H / 2, -D / 2 + 0.017, g)

        // Corner posts along the glass edges
        for (const [px, pz] of [[-W / 2 + 0.009, D / 2 - 0.009], [-W / 2 + 0.009, -D / 2 + 0.009], [W / 2 - 0.009, D / 2 - 0.009]])
        {
            box(0.018, H - 0.02, 0.018, this.white, px, H / 2, pz, g)
        }

        // Feet
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]])
        {
            box(0.032, 0.016, 0.032, this.whiteSoft, sx * (W / 2 - 0.035), -0.008, sz * (D / 2 - 0.045), g)
        }

        // PSU shroud dividing the lower chamber, with a vent slot
        box(W - 0.03, 0.016, D - 0.05, this.inner, 0, 0.152, 0, g)
        box(0.09, 0.004, D - 0.12, this.dark, -0.04, 0.161, 0, g)

        // Rear I/O
        box(0.008, 0.17, 0.17, this.dark, W / 2 - 0.024, 0.4, -D / 2 + 0.04, g)
    }

    // ------------------------------------------------------------------
    buildMotherboard()
    {
        const { W, D } = this
        const g = this.group
        const x = W / 2 - 0.02

        const mobo = plane(D - 0.09, 0.33, this.pcb, x, 0.335, -0.01, g)
        mobo.rotation.y = -Math.PI / 2

        // Chipset and VRM heatsinks
        box(0.016, 0.09, 0.06, this.whiteSoft, x - 0.008, 0.45, -0.15, g)
        box(0.016, 0.055, 0.1, this.whiteSoft, x - 0.008, 0.21, -0.11, g)
        box(0.014, 0.04, 0.13, this.dark, x - 0.007, 0.2, 0.09, g)

        // Vertical RAM sticks with a lit top edge
        for (let i = 0; i < 4; i++)
        {
            const z = 0.05 + i * 0.024
            box(0.028, 0.105, 0.009, this.dark, x - 0.016, 0.415, z, g)
            box(0.029, 0.007, 0.009, this.ledRam, x - 0.016, 0.472, z, g)
        }

        // A couple of sleeved cables running to the shroud
        for (const dz of [-0.19, 0.19])
        {
            const curve = new THREE.CatmullRomCurve3([
                new THREE.Vector3(x - 0.01, 0.2, dz),
                new THREE.Vector3(x - 0.03, 0.185, dz * 1.02),
                new THREE.Vector3(x - 0.02, 0.166, dz * 0.9),
            ])
            g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.007, 6, false), this.dark))
        }
    }

    // ------------------------------------------------------------------
    buildCooling()
    {
        const { W, H, D } = this
        const g = this.group

        // Radiator under the top panel
        box(W - 0.05, 0.038, D - 0.13, this.dark, 0, H - 0.055, 0, g)
        for (let i = 0; i < 3; i++)
        {
            this.fan(0, H - 0.105, -0.135 + i * 0.135, g)
            this.fan(0, 0.058, -0.135 + i * 0.135, g)
        }

        // Pump block on the CPU, display facing the glass side
        const pump = cylinder(0.052, 0.052, 0.036, this.whiteSoft, W / 2 - 0.055, 0.33, -0.04, g, 24)
        pump.rotation.z = Math.PI / 2

        const pumpTex = makePumpDisplay({ temp: 39 })
        const disc = plane(0.078, 0.078, new THREE.MeshStandardMaterial({
            map: pumpTex,
            emissive: '#ffffff',
            emissiveMap: pumpTex,
            emissiveIntensity: 0.8,
            roughness: 0.3,
        }), W / 2 - 0.075, 0.33, -0.04, g)
        disc.rotation.y = -Math.PI / 2

        // Braided tubes from the pump up to the radiator
        for (const dz of [-0.055, 0.03])
        {
            const curve = new THREE.CatmullRomCurve3([
                new THREE.Vector3(W / 2 - 0.06, 0.36, -0.04 + dz),
                new THREE.Vector3(W / 2 - 0.085, 0.43, -0.06 + dz * 1.4),
                new THREE.Vector3(W / 2 - 0.06, H - 0.13, -0.02 + dz),
            ])
            g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.0095, 8, false), this.dark))
        }
    }

    /** Fan: dark hub, white blades hinted by a ring, lit rim. */
    fan(x, y, z, parent)
    {
        const frame = box(0.11, 0.024, 0.11, this.dark, x, y, z, parent)
        frame.castShadow = false
        cylinder(0.05, 0.05, 0.026, this.inner, x, y, z, parent, 20)

        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.005, 6, 24), this.led)
        ring.position.set(x, y + 0.013, z)
        ring.rotation.x = Math.PI / 2
        parent.add(ring)

        cylinder(0.016, 0.016, 0.028, this.whiteSoft, x, y, z, parent, 12)
        for (let i = 0; i < 7; i++)
        {
            const a = (i / 7) * Math.PI * 2
            const blade = box(0.036, 0.006, 0.014, this.dark, x + Math.cos(a) * 0.03, y + 0.006, z + Math.sin(a) * 0.03, parent)
            blade.rotation.y = -a
            blade.castShadow = false
        }
    }

    // ------------------------------------------------------------------
    buildGpu()
    {
        const { W } = this
        const g = this.group
        const y = 0.235

        // Body + white shroud + backplate
        box(0.16, 0.055, 0.32, this.dark, -0.005, y, 0.02, g)
        box(0.152, 0.016, 0.305, this.white, -0.005, y + 0.032, 0.02, g)
        box(0.006, 0.05, 0.3, this.whiteSoft, 0.078, y, 0.02, g)

        // Two fans seen through the shroud
        for (const dz of [-0.07, 0.09])
        {
            cylinder(0.044, 0.044, 0.008, this.inner, -0.005, y + 0.041, 0.02 + dz, g, 18)
            cylinder(0.012, 0.012, 0.012, this.whiteSoft, -0.005, y + 0.045, 0.02 + dz, g, 10)
        }

        // Bracket into the board and an anti-sag support
        box(0.03, 0.05, 0.06, this.dark, 0.1, y, -0.1, g)
        box(0.014, 0.075, 0.014, this.whiteSoft, -0.06, 0.19, 0.15, g)
    }

    // ------------------------------------------------------------------
    /** Angular LED runs, like the chevrons in the reference photo. */
    buildLighting()
    {
        const { W, H } = this
        const g = this.group

        for (let i = 0; i < 2; i++)
        {
            const z = -0.1 + i * 0.2
            box(0.012, 0.009, 0.15, this.led, -W / 2 + 0.034, H - 0.026, z, g)
            box(0.012, 0.009, 0.15, this.led, -W / 2 + 0.034, 0.026, z, g)
        }

        // Chevrons on the perforated tray
        for (let i = 0; i < 2; i++)
        {
            const zc = -0.08 + i * 0.18
            for (const dir of [-1, 1])
            {
                const bar = box(0.008, 0.008, 0.12, this.led, W / 2 - 0.024, 0.26 + i * 0.1 + dir * 0.03, zc + dir * 0.055, g)
                bar.rotation.x = dir * 0.6
            }
        }

        this.glow = new THREE.PointLight('#cfe4f7', 0.14, 0.9, 2)
        this.glow.position.set(-0.02, this.H * 0.55, 0.05)
        g.add(this.glow)
    }

    // ------------------------------------------------------------------
    buildGlass()
    {
        const { W, H, D } = this
        const g = this.group
        const glass = this.m.glass

        const front = plane(W - 0.024, H - 0.032, glass, 0, H / 2, D / 2 - 0.003, g)
        front.renderOrder = 2

        const side = plane(D - 0.024, H - 0.032, glass, -W / 2 + 0.003, H / 2, 0, g)
        side.rotation.y = Math.PI / 2
        side.renderOrder = 2

        // White trim framing both glass panels
        box(W, 0.013, 0.013, this.white, 0, H - 0.018, D / 2 - 0.004, g)
        box(W, 0.013, 0.013, this.white, 0, 0.018, D / 2 - 0.004, g)
        box(0.013, H, 0.013, this.white, -W / 2 + 0.006, H / 2, D / 2 - 0.004, g)
        box(0.013, 0.013, D, this.white, -W / 2 + 0.005, H - 0.018, 0, g)
        box(0.013, 0.013, D, this.white, -W / 2 + 0.005, 0.018, 0, g)
    }
}
