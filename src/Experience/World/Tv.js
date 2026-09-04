import * as THREE from 'three'
import { room } from '../config/layout.js'
import { box, plane, screenMaterial } from './utils.js'
import { makeTvMenu } from './Textures.js'
import videos from '../config/videos.js'

/** Wall-mounted TV on the right wall, above the credenza: the project reel. */
export default class Tv
{
    constructor(world)
    {
        this.world = world
        this.scene = world.scene
        this.m = world.materials
        this.theme = world.theme

        const x = room.width / 2 - 0.045
        const y = 1.78
        const z = -0.3
        const w = 1.32   // along Z
        const h = 0.76

        this.group = new THREE.Group()
        this.group.name = 'tv'
        this.group.position.set(x, y, z)
        this.group.rotation.y = -Math.PI / 2
        this.scene.add(this.group)

        // Body and slim bezel
        box(w, h, 0.035, this.m.plastic, 0, 0, 0, this.group)
        box(w + 0.012, h + 0.012, 0.012, this.m.metal, 0, 0, -0.012, this.group)

        // The idle screen is the very menu the click opens
        const tex = makeTvMenu({ accent: this.theme.accent, items: videos })
        this.screenMaterial = screenMaterial(tex, 1.0)
        const screen = plane(w - 0.028, h - 0.028, this.screenMaterial, 0, 0, 0.019, this.group)
        screen.name = 'screen.tv'

        // Wall bracket
        box(0.3, 0.24, 0.03, this.m.metal, 0, 0, -0.03, this.group)

        // A screen material carries its picture in emissiveMap, not map: it is
        // black that glows, not a lit surface.
        this.retext = () =>
        {
            const next = makeTvMenu({ accent: this.theme.accent, items: videos })
            this.screenMaterial.emissiveMap?.dispose()
            this.screenMaterial.emissiveMap = next
            this.screenMaterial.needsUpdate = true
        }

        // Soft bounce onto the wall behind it
        this.glow = new THREE.RectAreaLight('#5a7ea8', 1.1, w, h)
        this.glow.position.set(x - 0.1, y, z)
        this.glow.lookAt(x - 1.2, y, z)
        this.scene.add(this.glow)
    }
}
