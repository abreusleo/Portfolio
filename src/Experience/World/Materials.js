import * as THREE from 'three'
import { makeMicrocement, makePolishedConcrete, makeWood, makeFabric } from './Textures.js'
import { emissiveMaterial } from './utils.js'

function std(color, roughness, metalness = 0, side = THREE.FrontSide)
{
    return new THREE.MeshStandardMaterial({ color, roughness, metalness, side })
}

/** Theme-driven palette for the modern basement. */
export default class Materials
{
    constructor(theme, anisotropy = 4)
    {
        this.theme = theme

        // --- Surfaces -------------------------------------------------
        const wallMap = makeMicrocement({ base: theme.plaster, seed: 1 })
        wallMap.repeat.set(2, 1)
        wallMap.anisotropy = anisotropy

        const floorMap = makePolishedConcrete({ base: theme.floor, seed: 2 })
        floorMap.repeat.set(2, 2)
        floorMap.anisotropy = anisotropy

        const ceilingMap = makeMicrocement({ base: '#1a1b1e', seed: 3, contrast: 0.1, trowel: 10 })
        ceilingMap.repeat.set(3, 3)

        this.wall = new THREE.MeshStandardMaterial({ map: wallMap, roughness: 0.92, metalness: 0 })
        this.floor = new THREE.MeshStandardMaterial({ map: floorMap, roughness: 0.32, metalness: 0.05 })
        this.ceiling = new THREE.MeshStandardMaterial({ map: ceilingMap, roughness: 0.95, metalness: 0 })

        // --- Wood -----------------------------------------------------
        const slatMap = makeWood({ base: theme.slatWood, seed: 7, vertical: true })
        slatMap.repeat.set(1, 2)
        this.slat = new THREE.MeshStandardMaterial({ map: slatMap, roughness: 0.62, metalness: 0 })
        this.slatBack = std(theme.slatBack, 0.95, 0)

        const deskMap = makeWood({ base: theme.deskWood, seed: 11, vertical: false, strength: 0.28 })
        deskMap.repeat.set(3, 1)
        deskMap.anisotropy = anisotropy
        this.deskWood = new THREE.MeshStandardMaterial({ map: deskMap, roughness: 0.48, metalness: 0 })

        // --- Solids ---------------------------------------------------
        this.metal = std(theme.metal, 0.4, 0.6)
        this.metalSoft = std(theme.metal, 0.62, 0.25)
        this.steel = std('#8d939b', 0.28, 0.85)
        this.plastic = std('#16181c', 0.5, 0.05)
        this.plasticBack = std('#16181c', 0.5, 0.05, THREE.BackSide)
        this.white = std('#cfd2d6', 0.55, 0)
        this.paper = std('#c9c6bf', 0.9, 0)
        this.fabricDark = std(theme.fabric, 0.9, 0)
        this.leaf = std('#3f5c3a', 0.75, 0)
        this.pot = std('#8d8880', 0.85, 0)
        this.soil = std('#241f1a', 0.98, 0)
        this.cable = std('#1a1c20', 0.5, 0.1)
        this.glassBoard = new THREE.MeshPhysicalMaterial({
            color: '#ffffff', roughness: 0.12, metalness: 0, transparent: true, opacity: 0.9,
        })
        this.glass = new THREE.MeshPhysicalMaterial({
            color: '#aab6c2', transparent: true, opacity: 0.14, roughness: 0.08, metalness: 0, depthWrite: false,
        })

        const rugMap = makeFabric({ base: theme.rug, seed: 9 })
        rugMap.repeat.set(3, 2)
        this.rug = new THREE.MeshStandardMaterial({ map: rugMap, roughness: 0.96, metalness: 0 })

        // --- Emissives ------------------------------------------------
        this.ledWarm = emissiveMaterial(theme.lightWarm, 2.6)
        this.ledNeutral = emissiveMaterial(theme.lightNeutral, 2.6)
        this.ledAccent = emissiveMaterial(theme.accent, 2.2)
        this.ledSoft = emissiveMaterial(theme.lightWarm, 1.1)
        this.ledDot = emissiveMaterial('#eaf4ff', 2.4)
        this.crtGreen = emissiveMaterial('#7bffae', 1.2)
    }
}
