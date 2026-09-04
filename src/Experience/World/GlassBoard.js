import * as THREE from 'three'
import { room } from '../config/layout.js'
import { cylinder, plane } from './utils.js'
import { makeWhiteboard } from './Textures.js'

/**
 * Frameless whiteboard on the right wall, above the desk return and beside
 * the TV. It carries one quote, written by hand, with the cannon drawn next
 * to it in red marker.
 */
export default class GlassBoard
{
    constructor(world)
    {
        this.world = world
        this.scene = world.scene
        this.m = world.materials
        this.theme = world.theme

        // Centred in the run between the back wall and the near edge of the TV
        const x = room.width / 2 - 0.055
        const y = 1.74
        const z = -1.98
        const w = 1.0
        const h = 0.7

        this.group = new THREE.Group()
        this.group.name = 'glassboard'
        this.scene.add(this.group)

        const tex = makeWhiteboard()
        const mat = new THREE.MeshStandardMaterial({
            map: tex,
            roughness: 0.52,
            metalness: 0.0,
            emissive: '#ffffff',
            emissiveMap: tex,
            emissiveIntensity: 0.14,
        })

        const board = plane(w, h, mat, x, y, z, this.group)
        board.rotation.y = -Math.PI / 2
        board.name = 'screen.board'
        board.castShadow = true

        // Standoff mounts
        for (const sz of [-1, 1])
        {
            for (const sy of [-1, 1])
            {
                const pin = cylinder(0.011, 0.011, 0.05, this.m.steel, x + 0.02, y + sy * (h / 2 - 0.06), z + sz * (w / 2 - 0.06), this.group, 10)
                pin.rotation.z = Math.PI / 2
            }
        }

        // Small picture light so it reads against the wall
        const light = new THREE.PointLight(this.theme.lightWarm, 0.62, 2.6, 2)
        light.position.set(x - 0.9, y + 0.5, z)
        this.group.add(light)
    }
}
