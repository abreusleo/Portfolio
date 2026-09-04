import * as THREE from 'three'
import { room, backWall } from '../config/layout.js'
import { box, plane } from './utils.js'

/**
 * The shell: microcement walls, polished concrete floor, dark ceiling,
 * a wood slat acoustic wall behind the desk and a flush door beside it.
 */
export default class Room
{
    constructor(world)
    {
        this.world = world
        this.scene = world.scene
        this.m = world.materials
        this.theme = world.theme

        this.group = new THREE.Group()
        this.group.name = 'room'
        this.scene.add(this.group)

        this.buildShell()
        this.buildSlatWall()
        this.buildDoor()
    }

    buildShell()
    {
        const { width: W, depth: D, height: H } = room
        const m = this.m

        const floor = plane(W, D, m.floor, 0, 0, 0, this.group)
        floor.rotation.x = -Math.PI / 2

        const ceiling = plane(W, D, m.ceiling, 0, H, 0, this.group)
        ceiling.rotation.x = Math.PI / 2

        plane(W, H, m.wall, 0, H / 2, -D / 2, this.group)

        const front = plane(W, H, m.wall, 0, H / 2, D / 2, this.group)
        front.rotation.y = Math.PI

        const left = plane(D, H, m.wall, -W / 2, H / 2, 0, this.group)
        left.rotation.y = Math.PI / 2

        const right = plane(D, H, m.wall, W / 2, H / 2, 0, this.group)
        right.rotation.y = -Math.PI / 2

        // Shadow gap where the walls meet the floor (modern detail, no skirting)
        const gapMat = new THREE.MeshStandardMaterial({ color: '#0a0b0d', roughness: 1 })
        const gh = 0.022
        box(W, gh, 0.02, gapMat, 0, gh / 2, -D / 2 + 0.01, this.group)
        box(W, gh, 0.02, gapMat, 0, gh / 2, D / 2 - 0.01, this.group)
        box(0.02, gh, D, gapMat, -W / 2 + 0.01, gh / 2, 0, this.group)
        box(0.02, gh, D, gapMat, W / 2 - 0.01, gh / 2, 0, this.group)
    }

    /** Vertical wood battens across the back wall, right of the door. */
    buildSlatWall()
    {
        const { depth: D, height: H, width: W } = room
        const m = this.m
        const xStart = backWall.slatStart
        const xEnd = W / 2
        const z = -D / 2

        // Dark backing panel
        const panel = plane(xEnd - xStart, H, m.slatBack, (xStart + xEnd) / 2, H / 2, z + 0.004, this.group)
        panel.receiveShadow = true

        const pitch = 0.085
        const count = Math.floor((xEnd - xStart - 0.03) / pitch)
        const geo = new THREE.BoxGeometry(0.05, H, 0.028)
        const slats = new THREE.InstancedMesh(geo, m.slat, count)
        slats.name = 'slats'
        slats.castShadow = true
        slats.receiveShadow = true

        const matrix = new THREE.Matrix4()
        const color = new THREE.Color()
        for (let i = 0; i < count; i++)
        {
            const x = xStart + 0.045 + i * pitch
            matrix.makeTranslation(x, H / 2, z + 0.022)
            slats.setMatrixAt(i, matrix)

            // Subtle plank-to-plank tone variation
            const k = 0.88 + ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1 * 0.24
            color.setRGB(k, k, k)
            slats.setColorAt(i, color)
        }
        slats.instanceMatrix.needsUpdate = true
        if (slats.instanceColor) slats.instanceColor.needsUpdate = true
        this.group.add(slats)
    }

    /** Flush dark door in the plaster section, immediately left of the desk. */
    buildDoor()
    {
        const { depth: D } = room
        const m = this.m
        const x = backWall.doorCenter
        const w = backWall.doorWidth
        const h = backWall.doorHeight
        const z = -D / 2

        const g = new THREE.Group()
        g.name = 'door'
        this.group.add(g)

        // Recessed reveal
        const revealMat = new THREE.MeshStandardMaterial({ color: '#0d0e10', roughness: 0.9 })
        box(w + 0.06, h + 0.06, 0.012, revealMat, x, h / 2, z + 0.008, g)

        // Leaf
        const leafMat = new THREE.MeshStandardMaterial({
            color: this.theme.key === 'sand' ? '#2a2622' : '#1c1e22',
            roughness: 0.55,
            metalness: 0.08,
        })
        const leaf = box(w, h, 0.045, leafMat, x, h / 2, z + 0.03, g)
        leaf.name = 'door.leaf'

        // Slim vertical handle
        box(0.022, 0.9, 0.022, m.steel, x + w / 2 - 0.09, 1.05, z + 0.062, g)
        box(0.022, 0.022, 0.03, m.steel, x + w / 2 - 0.09, 1.46, z + 0.05, g)
        box(0.022, 0.022, 0.03, m.steel, x + w / 2 - 0.09, 0.64, z + 0.05, g)

        // Light spilling under the door from the corridor
        const spill = plane(w - 0.06, 0.16, this.m.ledSoft, x, 0.004, z + 0.14, g)
        spill.rotation.x = -Math.PI / 2
        spill.material = this.m.ledSoft.clone()
        spill.material.emissiveIntensity = 0.5
    }
}
