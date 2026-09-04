import * as THREE from 'three'
import { room } from '../config/layout.js'
import { box, plane } from './utils.js'
import { makeArtPrint } from './ArtPrint.js'
import projects from '../config/projects.js'

/**
 * Framed prints. The six on the slat wall are the applications, in the order
 * given by config/projects.js: top row left to right, then bottom row.
 * The two on the side wall stay abstract.
 */
const PRINTS = [
    { wall: 'back', x: 0.85, y: 2.52, w: 0.42, h: 0.46 },
    { wall: 'back', x: 1.62, y: 2.52, w: 0.42, h: 0.46 },
    { wall: 'back', x: 2.39, y: 2.52, w: 0.42, h: 0.46 },
    { wall: 'back', x: 0.85, y: 1.98, w: 0.42, h: 0.46 },
    { wall: 'back', x: 1.62, y: 1.98, w: 0.42, h: 0.46 },
    { wall: 'back', x: 2.39, y: 1.98, w: 0.42, h: 0.46 },
    // Side wall
    { wall: 'left', z: -2.1, y: 1.72, w: 0.44, h: 0.6 },
    { wall: 'left', z: 0.35, y: 1.66, w: 0.34, h: 0.46 },
]

export default class FramedPrints
{
    constructor(world)
    {
        this.world = world
        this.scene = world.scene
        this.m = world.materials
        this.theme = world.theme

        this.group = new THREE.Group()
        this.group.name = 'prints'
        this.scene.add(this.group)

        // Kept so the six project prints can be redrawn in another language
        // without rebuilding the wall.
        this.sheets = []

        PRINTS.forEach((p, i) => this.create(p, i + 1))
        this.addGroupTarget()
    }

    create(p, index)
    {
        const g = new THREE.Group()
        g.name = `print.${String(index).padStart(2, '0')}`

        if (p.wall === 'right')
        {
            g.position.set(room.width / 2 - 0.02, p.y, p.z)
            g.rotation.y = -Math.PI / 2
        }
        else if (p.wall === 'back')
        {
            // Sits proud of the slat battens
            g.position.set(p.x, p.y, -room.depth / 2 + 0.05)
        }
        else
        {
            g.position.set(-room.width / 2 + 0.02, p.y, p.z)
            g.rotation.y = Math.PI / 2
        }
        this.group.add(g)

        // Slim black frame + mount board + print
        const frameMat = new THREE.MeshStandardMaterial({ color: '#0f1013', roughness: 0.45, metalness: 0.2 })
        const t = 0.016
        box(p.w, t, 0.028, frameMat, 0, p.h / 2 - t / 2, 0, g)
        box(p.w, t, 0.028, frameMat, 0, -p.h / 2 + t / 2, 0, g)
        box(t, p.h - t * 2, 0.028, frameMat, -p.w / 2 + t / 2, 0, 0, g)
        box(t, p.h - t * 2, 0.028, frameMat, p.w / 2 - t / 2, 0, 0, g)

        const mount = new THREE.MeshStandardMaterial({ color: '#d8d4cb', roughness: 0.9 })
        plane(p.w - t * 2, p.h - t * 2, mount, 0, 0, 0.006, g)

        const app = p.wall === 'back' ? projects[index - 1] : null
        const tex = makeArtPrint({ index, accent: this.theme.accent, app })
        const art = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.82 })
        if (app) this.sheets.push({ index, app, material: art })
        const sheet = plane((p.w - t * 2) * 0.86, (p.h - t * 2) * 0.86, art, 0, 0.004, 0.008, g)

        // Only the prints on the slat wall are clickable
        if (p.wall === 'back') sheet.name = `hotspot.print.${String(index).padStart(2, '0')}`
    }

    /** Redraws the printed captions in the current language. */
    retext()
    {
        for (const sheet of this.sheets)
        {
            const next = makeArtPrint({ index: sheet.index, accent: this.theme.accent, app: sheet.app })
            sheet.material.map.dispose()
            sheet.material.map = next
            sheet.material.needsUpdate = true
        }
    }

    /**
     * Invisible plate behind the grid. It catches clicks in the gaps between
     * frames, so the first click always frames the whole set.
     */
    addGroupTarget()
    {
        const target = new THREE.Mesh(
            new THREE.PlaneGeometry(2.15, 1.2),
            new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
        )
        target.position.set(1.62, 2.25, -room.depth / 2 + 0.01)
        target.name = 'hotspot.prints'
        target.userData.noWire = true
        target.renderOrder = -1
        this.group.add(target)
    }
}
