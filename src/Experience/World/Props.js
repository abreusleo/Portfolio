import * as THREE from 'three'
import { room } from '../config/layout.js'
import { box, cylinder, plane } from './utils.js'

/** Floor pieces: rug, tall plant, skateboard, a couple of quiet objects. */
export default class Props
{
    constructor(world)
    {
        this.world = world
        this.scene = world.scene
        this.m = world.materials

        this.group = new THREE.Group()
        this.group.name = 'props'
        this.scene.add(this.group)

        this.buildRug()
        this.buildFloorBits()
    }

    buildRug()
    {
        const rug = plane(3.0, 2.1, this.m.rug, 1.35, 0.004, -1.3, this.group)
        rug.rotation.x = -Math.PI / 2
        rug.receiveShadow = true

        // Woven border
        const border = plane(2.88, 1.98, new THREE.MeshStandardMaterial({
            color: '#000000', roughness: 1, transparent: true, opacity: 0.16,
        }), 1.35, 0.005, -1.3, this.group)
        border.rotation.x = -Math.PI / 2
    }

    buildFloorBits()
    {
        const m = this.m
        const g = this.group

        // Cardboard tube / rolled print leaning in the far corner
        const tube = cylinder(0.045, 0.045, 0.85, m.paper, -3.34, 0.44, 0.35, g, 12)
        tube.rotation.z = 0.14
        tube.rotation.x = 0.06
    }
}
