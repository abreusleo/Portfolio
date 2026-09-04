import * as THREE from 'three'
import { room } from '../config/layout.js'
import { box, cylinder, sphere, plane } from './utils.js'
import { makeShelfLabel, makeProductCard, makeDashboard, makeGameCover } from './Textures.js'
import { t } from '../config/i18n.js'

/**
 * Display surfaces for the work: two floating shelves on the slat wall and
 * an open shelving unit on the right wall. Each floating shelf carries a
 * standing card for the product it holds.
 */
const CARDS = {
    bios: {
        title: 'BIOS HEALTH',
        line: { pt: 'Gestão do centro cirúrgico em tempo real', en: 'Running the operating theatre in real time' },
        foot: 'Go · Next.js',
        accent: '#2FD3C3',
        ink: '#1e40af',
        dark: true,
    },
    surviving: {
        title: 'SURVIVING',
        line: { pt: 'Sobrevivência pós-apocalíptica em primeira pessoa', en: 'First-person post-apocalyptic survival' },
        foot: 's&box · Source 2',
        accent: '#e0913f',
        ink: '#eceef2',
        dark: true,
    },
}
export default class Shelves
{
    constructor(world)
    {
        this.world = world
        this.scene = world.scene
        this.m = world.materials
        this.theme = world.theme

        this.group = new THREE.Group()
        this.group.name = 'shelves'
        this.scene.add(this.group)

        // Redrawable surfaces, so a language change does not rebuild the wall
        this.cards = []
        this.screens = []

        this.floating(-0.75, 1.88, 1.55, '01 — BIOS HEALTH', 'product.01', 'bios')
        this.floating(-0.75, 1.44, 1.55, '02 — SURVIVING', 'product.02', 'surviving')
        this.unit()
        this.addGroupTarget()
    }

    /** Invisible plate behind both shelves, so the first click frames the pair. */
    addGroupTarget()
    {
        const target = new THREE.Mesh(
            new THREE.PlaneGeometry(1.7, 0.95),
            new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
        )
        target.position.set(-0.75, 1.66, -room.depth / 2 + 0.01)
        target.name = 'hotspot.products'
        target.userData.noWire = true
        target.renderOrder = -1
        this.group.add(target)
    }

    /** Wall-mounted shelf on the slat wall behind the desk. */
    floating(x, y, width, label, hotspotId, product)
    {
        const m = this.m
        const z = -room.depth / 2 + 0.14
        const depth = 0.24

        const g = new THREE.Group()
        g.position.set(x, y, z)
        this.group.add(g)

        box(width, 0.036, depth, m.deskWood, 0, 0, 0, g)

        // Slim brackets
        for (const sx of [-1, 1])
        {
            box(0.02, 0.06, depth - 0.03, m.metal, sx * (width / 2 - 0.16), -0.045, -0.01, g)
        }

        // Label strip on the front edge
        const plate = plane(0.32, 0.045, new THREE.MeshStandardMaterial({
            map: makeShelfLabel({ text: label }), roughness: 0.7,
        }), -width / 2 + 0.24, -0.002, depth / 2 + 0.002, g)
        plate.castShadow = false

        this.objects(g, width, depth, label, product)

        // Invisible pick target covering what sits on the shelf
        if (hotspotId)
        {
            const proxy = new THREE.Mesh(
                new THREE.BoxGeometry(width, 0.3, depth),
                new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
            )
            proxy.position.set(0, 0.16, 0)
            proxy.name = `hotspot.${hotspotId}`
            proxy.userData.noWire = true
            proxy.renderOrder = -1
            g.add(proxy)
        }
    }

    /** What sits on a shelf: the product card plus pieces that fit the product. */
    objects(g, width, depth, label, product)
    {
        const y = 0.018

        if (!product) return
        this.card(g, 0.44, y, CARDS[product])

        if (product === 'bios') this.biosObjects(g, y)
        else this.survivingObjects(g, y)
    }

    /** A tablet showing the live board, and the stack of documents it reads. */
    biosObjects(g, y)
    {
        const m = this.m

        // Tablet on a small stand
        const tablet = new THREE.Group()
        tablet.position.set(-0.08, y, -0.01)
        tablet.rotation.set(-0.22, 0.18, 0)
        g.add(tablet)

        box(0.26, 0.17, 0.008, m.plastic, 0, 0.09, 0, tablet)
        // One texture, not two: the same drawing was being made twice, once
        // for the colour map and once for the emissive.
        const board = makeDashboard()
        const screenMaterial = new THREE.MeshStandardMaterial({
            map: board,
            emissive: '#ffffff',
            emissiveMap: board,
            emissiveIntensity: 0.42,
            roughness: 0.4,
        })
        this.screens.push(screenMaterial)
        const screen = plane(0.238, 0.148, screenMaterial, 0, 0.09, 0.005, tablet)
        screen.castShadow = false

        const foot = box(0.06, 0.075, 0.01, m.metal, 0, 0.03, -0.028, tablet)
        foot.rotation.x = 0.45

        // Stack of printed documents, the ones the OCR reads
        for (let i = 0; i < 7; i++)
        {
            const sheet = box(0.15, 0.004, 0.2, m.paper, -0.48, y + 0.002 + i * 0.0045, 0.01, g)
            sheet.rotation.y = (i % 3 - 1) * 0.05
        }
        const folder = box(0.16, 0.006, 0.21, m.metalSoft, -0.48, y + 0.036, 0.01, g)
        folder.rotation.y = 0.08
    }

    /** A boxed copy, the controller and a scavenged can. */
    survivingObjects(g, y)
    {
        const m = this.m

        // Boxed copy standing on its edge
        const box3 = new THREE.Group()
        box3.position.set(-0.52, y, 0)
        box3.rotation.y = 0.28
        g.add(box3)

        box(0.145, 0.2, 0.022, m.plastic, 0, 0.1, 0, box3)
        const cover = plane(0.137, 0.192, new THREE.MeshStandardMaterial({
            map: makeGameCover(), roughness: 0.5,
        }), 0, 0.1, 0.012, box3)
        cover.castShadow = false

        this.controller(g, -0.2, y, 0.01)

        // A scavenged can, the kind the game is full of
        const can = new THREE.Group()
        can.position.set(0.1, y, 0.0)
        can.rotation.y = -0.2
        g.add(can)

        box(0.15, 0.105, 0.095, m.metalSoft, 0, 0.052, 0, can)
        box(0.152, 0.014, 0.097, m.metal, 0, 0.108, 0, can)
        const handle = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.005, 6, 14, Math.PI), m.metal)
        handle.position.set(0, 0.115, 0)
        handle.rotation.y = Math.PI / 2
        can.add(handle)
        box(0.06, 0.03, 0.002, m.paper, 0, 0.055, 0.049, can)
    }

    /** Redraws the shelf's printed surfaces in the current language. */
    retext()
    {
        for (const card of this.cards)
        {
            const next = makeProductCard({ ...card.spec, line: t(card.spec.line) })
            card.material.map.dispose()
            card.material.map = next
            card.material.needsUpdate = true
        }

        for (const material of this.screens)
        {
            const next = makeDashboard()
            material.map.dispose()
            material.map = next
            material.emissiveMap = next
            material.needsUpdate = true
        }
    }

    /** A printed card standing on the shelf, leaning back on its easel. */
    card(parent, x, y, spec)
    {
        const g = new THREE.Group()
        g.position.set(x, y, -0.01)
        g.rotation.set(-0.12, -0.22, 0)
        parent.add(g)

        const cardW = 0.2
        const cardH = 0.27

        const backing = box(cardW + 0.01, cardH + 0.01, 0.008, this.m.metal, 0, cardH / 2, 0, g)
        backing.castShadow = true

        const faceMaterial = new THREE.MeshStandardMaterial({
            map: makeProductCard({ ...spec, line: t(spec.line) }), roughness: 0.62,
        })
        this.cards.push({ spec, material: faceMaterial })
        const face = plane(cardW, cardH, faceMaterial, 0, cardH / 2, 0.005, g)
        face.castShadow = false

        // Small easel foot
        const foot = box(0.02, 0.09, 0.012, this.m.metal, 0, 0.03, -0.03, g)
        foot.rotation.x = 0.5
        return g
    }

    /** Small game controller, a nod to the reference photo. */
    controller(parent, x, y, z)
    {
        const m = this.m
        const g = new THREE.Group()
        g.name = 'blockout.gamepad'
        g.position.set(x, y + 0.03, z)
        g.rotation.set(0, 0.4, 0)
        parent.add(g)

        box(0.13, 0.045, 0.075, m.plastic, 0, 0, 0, g)
        for (const sx of [-1, 1])
        {
            const grip = box(0.05, 0.042, 0.09, m.plastic, sx * 0.07, -0.012, 0.02, g)
            grip.rotation.z = sx * 0.28
        }
        for (const [sx, sz] of [[-0.03, 0.01], [0.035, 0.025]])
        {
            cylinder(0.013, 0.013, 0.014, m.metalSoft, sx, 0.028, sz, g, 10)
        }
    }

    /** Open shelving unit against the right wall. */
    unit()
    {
        const m = this.m
        const x = room.width / 2 - 0.2
        const zc = 1.55
        const width = 1.05   // along Z
        const depth = 0.36   // along X
        const height = 1.86
        const levels = 4

        const g = new THREE.Group()
        g.name = 'shelfUnit'
        g.position.set(x, 0, zc)
        this.group.add(g)

        // Frame posts
        for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]])
        {
            box(0.03, height, 0.03, m.metal, sx * (depth / 2), height / 2, sz * (width / 2), g)
        }
        // Cross braces on the back
        for (const y of [0.35, 1.5])
        {
            box(0.02, 0.02, width, m.metal, depth / 2 - 0.005, y, 0, g)
        }

        for (let i = 0; i < levels; i++)
        {
            const y = 0.16 + i * ((height - 0.3) / (levels - 1))
            box(depth, 0.034, width, m.deskWood, 0, y, 0, g)
            this.unitObjects(g, y + 0.017, i)
        }
    }

    unitObjects(g, y, level)
    {
        const m = this.m

        if (level === 0)
        {
            for (let i = 0; i < 5; i++)
            {
                box(0.2, 0.26, 0.03, i % 2 ? m.fabricDark : m.metalSoft, 0, y + 0.13, -0.34 + i * 0.035, g)
            }
            box(0.19, 0.19, 0.24, m.metalSoft, 0, y + 0.095, 0.28, g)
        }
        else if (level === 1)
        {
            const stand = cylinder(0.06, 0.065, 0.014, m.metal, 0, y + 0.007, -0.28, g, 18)
            const s = sphere(0.06, m.white, 0, y + 0.075, -0.28, g, 16)
            s.scale.set(1, 0.85, 1)
            box(0.16, 0.2, 0.12, m.deskWood, 0, y + 0.1, 0.05, g)
            const card = box(0.012, 0.15, 0.2, m.metal, -0.05, y + 0.075, 0.33, g)
            card.rotation.y = 0.25
        }
        else if (level === 2)
        {
            for (const [dz, h] of [[-0.3, 0.2], [-0.1, 0.15], [0.14, 0.24]])
            {
                cylinder(0.05, 0.05, h, m.white, 0, y + h / 2, dz, g, 18)
                box(0.1, 0.016, 0.1, m.metal, 0, y + h + 0.008, dz, g)
            }
            box(0.14, 0.09, 0.14, m.metalSoft, 0, y + 0.045, 0.36, g)
        }
        else
        {
            const plant = new THREE.Group()
            plant.position.set(0, y, -0.28)
            g.add(plant)
            cylinder(0.07, 0.058, 0.13, m.pot, 0, 0.065, 0, plant, 16)
            for (let i = 0; i < 6; i++)
            {
                const a = (i / 6) * Math.PI * 2
                const blade = cylinder(0.004, 0.022, 0.26, m.leaf, Math.cos(a) * 0.025, 0.13 + 0.13, Math.sin(a) * 0.025, plant, 4)
                blade.rotation.z = Math.cos(a) * 0.22
                blade.rotation.x = -Math.sin(a) * 0.22
                blade.scale.z = 0.35
            }

            box(0.17, 0.23, 0.14, m.metalSoft, 0, y + 0.115, 0.12, g)
            box(0.13, 0.02, 0.13, m.deskWood, 0, y + 0.24, 0.12, g)
        }
    }
}
