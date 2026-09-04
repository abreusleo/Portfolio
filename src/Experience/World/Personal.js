import * as THREE from 'three'
import { deskTop } from '../config/layout.js'
import { box, cylinder, sphere, plane } from './utils.js'
import { makePennant, makeBall } from './Textures.js'

/**
 * The left end of the desk: the only run in the room that is about the person
 * rather than the work. What he studied, where he is from, the club, and the
 * things that keep score.
 *
 * One invisible plate covers the whole run, so it reads as a single subject
 * instead of six pickable trinkets.
 */
export default class Personal
{
    constructor(world)
    {
        this.world = world
        this.scene = world.scene
        this.m = world.materials
        this.theme = world.theme

        this.group = new THREE.Group()
        this.group.name = 'personal'
        this.scene.add(this.group)

        this.gold = new THREE.MeshStandardMaterial({ color: '#c9a227', roughness: 0.28, metalness: 0.85 })
        this.stone = new THREE.MeshStandardMaterial({ color: '#8b8e90', roughness: 0.92, metalness: 0 })
        this.ink = new THREE.MeshStandardMaterial({ color: '#1d232c', roughness: 0.55, metalness: 0.05 })

        this.books(-1.12, -2.76)
        this.papers(-1.03, -2.42)
        this.redeemer(-0.74, -2.78)
        this.funko(-0.46, -2.74)
        this.pennant(-0.24, -2.86)
        this.ball(-0.19, -2.55)
        this.trophy(0.02, -2.74)

        this.addTarget()
    }

    /** Invisible plate over the whole run, so one click frames the lot. */
    addTarget()
    {
        const target = new THREE.Mesh(
            new THREE.PlaneGeometry(1.55, 0.42),
            new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
        )
        target.position.set(-0.55, 0.88, -2.48)
        target.name = 'hotspot.about'
        target.userData.noWire = true
        target.renderOrder = -1
        this.group.add(target)
    }

    /** Stack of technical books, read and re-stacked slightly out of true. */
    books(x, z)
    {
        const covers = ['#2b3a4c', '#6b2f2a', '#243b30', '#3a3550', '#4a3a25']
        const pages = new THREE.MeshStandardMaterial({ color: '#d8d3c6', roughness: 0.95 })

        const stack = new THREE.Group()
        stack.name = 'blockout.books'
        this.group.add(stack)

        let y = deskTop
        covers.forEach((colour, i) =>
        {
            const h = 0.028 + (i % 2) * 0.008
            const g = new THREE.Group()
            g.position.set(x, y + h / 2, z)
            g.rotation.y = (i - 2) * 0.075
            stack.add(g)

            const cover = new THREE.MeshStandardMaterial({ color: colour, roughness: 0.72, metalness: 0.02 })
            box(0.235, h, 0.17, cover, 0, 0, 0, g)
            // Page block, inset so the cover still reads as a cover
            box(0.222, h * 0.62, 0.158, pages, 0.004, 0, 0, g)
            y += h
        })
    }

    /** Loose printed pages and a pen: the part of studying nobody films. */
    papers(x, z)
    {
        const m = this.m

        const pile = new THREE.Group()
        pile.name = 'blockout.papers'
        this.group.add(pile)

        for (let i = 0; i < 9; i++)
        {
            const sheet = box(0.21, 0.0035, 0.295, m.paper, x, deskTop + 0.002 + i * 0.0035, z, pile)
            sheet.rotation.y = (i % 4 - 1.5) * 0.035
        }

        // A couple of pages pulled aside, still in the pile
        const loose = box(0.21, 0.0035, 0.295, m.paper, x + 0.035, deskTop + 0.036, z - 0.02, pile)
        loose.rotation.y = 0.22

        const pen = cylinder(0.005, 0.005, 0.135, this.ink, x + 0.01, deskTop + 0.042, z + 0.02, pile, 10)
        pen.rotation.z = Math.PI / 2
        pen.rotation.y = 0.42

        const cap = cylinder(0.0052, 0.003, 0.02, this.gold, x + 0.07, deskTop + 0.042, z + 0.048, pile, 10)
        cap.rotation.z = Math.PI / 2
    }

    /** Souvenir Christ the Redeemer: the object every carioca desk ends up with. */
    redeemer(x, z)
    {
        const g = new THREE.Group()
        g.name = 'blockout.redeemer'
        g.position.set(x, deskTop, z)
        g.rotation.y = 0.2
        this.group.add(g)

        // Stepped rock base
        box(0.1, 0.018, 0.1, this.stone, 0, 0.009, 0, g)
        box(0.078, 0.022, 0.078, this.stone, 0, 0.029, 0, g)
        box(0.05, 0.03, 0.05, this.stone, 0, 0.055, 0, g)

        // Robe, arms and head
        cylinder(0.017, 0.03, 0.125, this.stone, 0, 0.132, 0, g, 12)
        box(0.175, 0.016, 0.019, this.stone, 0, 0.178, 0, g)
        box(0.026, 0.03, 0.02, this.stone, 0, 0.2, 0, g)
        sphere(0.017, this.stone, 0, 0.222, 0, g, 14)
    }

    /** Vinyl figure: all head, tiny body, exactly like the real thing. */
    funko(x, z)
    {
        const g = new THREE.Group()
        g.name = 'blockout.funko'
        g.position.set(x, deskTop, z)
        g.rotation.y = -0.3
        this.group.add(g)

        const hoodie = new THREE.MeshStandardMaterial({ color: '#20242c', roughness: 0.66 })
        const trim = new THREE.MeshStandardMaterial({ color: this.theme.accent, roughness: 0.6 })
        const vinyl = new THREE.MeshStandardMaterial({ color: '#e8d9c8', roughness: 0.55 })
        const hair = new THREE.MeshStandardMaterial({ color: '#171a1f', roughness: 0.8 })

        // Feet and legs
        for (const sx of [-1, 1])
        {
            box(0.019, 0.008, 0.026, hoodie, sx * 0.012, 0.004, 0.003, g)
            box(0.015, 0.03, 0.015, hoodie, sx * 0.012, 0.023, 0, g)
        }

        // Torso with a stripe, and the stubby arms
        box(0.05, 0.045, 0.028, hoodie, 0, 0.06, 0, g)
        box(0.05, 0.007, 0.029, trim, 0, 0.048, 0, g)
        for (const sx of [-1, 1])
        {
            box(0.012, 0.04, 0.016, hoodie, sx * 0.031, 0.062, 0, g)
        }

        // The oversized head, with the flat vinyl eyes
        box(0.072, 0.068, 0.058, vinyl, 0, 0.117, 0, g)
        box(0.074, 0.022, 0.06, hair, 0, 0.146, -0.001, g)
        for (const sx of [-1, 1])
        {
            box(0.011, 0.014, 0.004, this.ink, sx * 0.016, 0.118, 0.029, g)
        }
    }

    /** Club pennant on a chrome stand. */
    pennant(x, z)
    {
        const m = this.m
        const g = new THREE.Group()
        g.name = 'blockout.pennant'
        g.position.set(x, deskTop, z)
        g.rotation.y = 0.12
        this.group.add(g)

        cylinder(0.032, 0.036, 0.008, m.metal, 0, 0.004, 0, g, 16)
        cylinder(0.004, 0.004, 0.2, m.metal, 0, 0.1, 0, g, 8)

        const flag = plane(0.2, 0.1, new THREE.MeshStandardMaterial({
            map: makePennant(), roughness: 0.78, transparent: true, side: THREE.DoubleSide,
        }), 0.1, 0.145, 0.002, g)
        flag.castShadow = false
    }

    /** A football: the pennant on its own is only half the story. */
    ball(x, z)
    {
        const material = new THREE.MeshStandardMaterial({ map: makeBall(), roughness: 0.66, metalness: 0 })
        const b = sphere(0.043, material, x, deskTop + 0.043, z, this.group, 22)
        b.name = 'blockout.ball'
        b.rotation.set(0.3, 0.7, 0.15)
    }

    /** Small cup: the point of playing is that something is at stake. */
    trophy(x, z)
    {
        const g = new THREE.Group()
        g.name = 'blockout.trophy'
        g.position.set(x, deskTop, z)
        g.rotation.y = -0.15
        this.group.add(g)

        box(0.056, 0.016, 0.056, this.ink, 0, 0.008, 0, g)
        box(0.042, 0.01, 0.042, this.ink, 0, 0.021, 0, g)
        cylinder(0.008, 0.011, 0.03, this.gold, 0, 0.041, 0, g, 12)
        cylinder(0.032, 0.016, 0.048, this.gold, 0, 0.08, 0, g, 16)

        for (const sx of [-1, 1])
        {
            const handle = new THREE.Mesh(new THREE.TorusGeometry(0.015, 0.0035, 6, 12, Math.PI), this.gold)
            handle.position.set(sx * 0.03, 0.085, 0)
            handle.rotation.set(0, Math.PI / 2, sx > 0 ? -Math.PI / 2 : Math.PI / 2)
            g.add(handle)
        }
    }
}
