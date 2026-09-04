import * as THREE from 'three'
import { room } from '../config/layout.js'
import { box, cylinder, plane } from './utils.js'
import { makeBookSpine } from './Textures.js'

/** Low cabinet along the right wall, with the console standing under the TV. */
export default class Credenza
{
    constructor(world)
    {
        this.world = world
        this.scene = world.scene
        this.m = world.materials
        this.theme = world.theme

        this.group = new THREE.Group()
        this.group.name = 'credenza'
        this.group.position.set(room.width / 2 - 0.22, 0, -0.3)
        this.scene.add(this.group)

        this.timer = 0
        this.build()
    }

    build()
    {
        const m = this.m
        const g = this.group
        const H = 0.58
        const D = 0.42   // along X (depth from the wall)
        const L = 1.34   // along Z

        // Body, lifted on slim legs
        box(D, H - 0.1, L, m.metalSoft, 0, 0.1 + (H - 0.1) / 2, 0, g)
        box(D + 0.03, 0.03, L + 0.03, m.deskWood, 0, H + 0.005, 0, g)
        for (const z of [-L / 2 + 0.12, L / 2 - 0.12])
        {
            box(0.025, 0.1, 0.025, m.metal, -D / 2 + 0.06, 0.05, z, g)
            box(0.025, 0.1, 0.025, m.metal, D / 2 - 0.06, 0.05, z, g)
        }

        // Two doors with a slim reveal and recessed pulls
        for (const z of [-L / 4, L / 4])
        {
            box(0.012, H - 0.16, L / 2 - 0.03, m.plastic, -D / 2 - 0.004, 0.1 + (H - 0.1) / 2, z, g)
            box(0.014, 0.02, 0.16, m.metal, -D / 2 - 0.012, 0.1 + (H - 0.1) / 2 + 0.16, z, g)
        }

        this.buildConsole(-0.02, H + 0.02, -0.36)
        this.buildBooks(0.02, H + 0.02, 0.26)
        this.buildTray(0.0, H + 0.02, 0.55)
    }

    /** Console standing vertically: dark core, white flared panels, front facing the room. */
    buildConsole(x, y, z)
    {
        const m = this.m
        const g = new THREE.Group()
        g.name = 'blockout.ps5'
        g.position.set(x, y, z)
        g.rotation.y = 0.1
        this.group.add(g)

        const shell = new THREE.MeshStandardMaterial({ color: '#eef0f3', roughness: 0.36, metalness: 0.05 })
        const core = new THREE.MeshStandardMaterial({ color: '#0f1115', roughness: 0.62, metalness: 0.15 })

        const H = 0.38
        const D = 0.24   // depth, along X (front faces -X, into the room)
        const Wz = 0.076 // width, along Z

        // Dark core
        box(D, H, Wz, core, 0, H / 2, 0, g)
        for (let i = 0; i < 6; i++)
        {
            box(D - 0.06, 0.005, Wz + 0.002, m.metal, 0.01, 0.12 + i * 0.034, 0, g)
        }

        // Two white panels, split so the silhouette flares out
        for (const sz of [-1, 1])
        {
            const lower = box(D + 0.015, H * 0.54, 0.019, shell, -0.004, H * 0.27, sz * 0.052, g)
            lower.rotation.x = sz * 0.03

            const upper = box(D * 0.96, H * 0.48, 0.019, shell, 0.002, H * 0.75, sz * 0.062, g)
            upper.rotation.x = sz * 0.07

            const cap = cylinder(0.011, 0.011, D * 0.9, shell, 0, H - 0.011, sz * 0.066, g, 10)
            cap.rotation.z = Math.PI / 2
        }

        // Front details: power and eject buttons, disc slot, USB
        box(0.006, 0.011, 0.011, m.metalSoft, -D / 2 - 0.003, 0.075, -0.018, g)
        box(0.006, 0.011, 0.011, m.metalSoft, -D / 2 - 0.003, 0.075, 0.014, g)
        box(0.005, 0.004, 0.05, core, -D / 2 - 0.003, 0.115, 0.01, g)

        // Base stand
        cylinder(0.075, 0.082, 0.013, core, 0.005, 0.0065, 0, g, 22)

        // Controller resting on the top, beside the console
        const pad = new THREE.Group()
        pad.position.set(0.01, 0.016, 0.26)
        pad.rotation.set(0, -0.35, 0)
        g.add(pad)
        box(0.12, 0.03, 0.05, shell, 0, 0, 0, pad)
        for (const sx of [-1, 1])
        {
            const grip = box(0.05, 0.028, 0.045, shell, sx * 0.07, -0.004, 0.014, pad)
            grip.rotation.z = sx * 0.3
        }
        for (const sx of [-0.03, 0.03])
        {
            cylinder(0.009, 0.009, 0.008, core, sx, 0.017, -0.016, pad, 10)
        }
    }

    buildBooks(x, y, z)
    {
        const g = this.group
        const hues = [28, 200, 12, 150]
        let offset = 0
        for (let i = 0; i < 4; i++)
        {
            const t = 0.026 + (i % 2) * 0.012
            const mat = new THREE.MeshStandardMaterial({ map: makeBookSpine({ hue: hues[i], index: i }), roughness: 0.8 })
            const b = box(0.17, 0.24, t, mat, x, y + 0.12, z + offset, g)
            b.rotation.z = i === 3 ? 0.06 : 0
            offset += t + 0.004
        }
    }

    buildTray(x, y, z)
    {
        const m = this.m
        const g = this.group
        box(0.24, 0.03, 0.3, m.deskWood, x, y + 0.015, z, g)
        for (const [dx, dz] of [[-0.04, -0.06], [0.03, 0.05]])
        {
            box(0.09, 0.012, 0.055, m.metalSoft, x + dx, y + 0.037, z + dz, g)
        }
    }

    update(time)
    {
        // Nothing animates on the credenza for now.
    }
}
