import * as THREE from 'three'

import EventEmitter from '../Utils/EventEmitter.js'
import definitions from '../config/eggs.js'

/**
 * The easter eggs: small places in the room that answer to a click once.
 *
 * The plates are never drawn and carry no label, so nothing on screen marks
 * the spot. What they do give is the cursor: sweep past one and the pointer
 * turns, which is a nudge rather than an announcement.
 *
 * What a visitor gets for pressing is the counter in the corner, and that
 * counter stays hidden until the first one turns up. A tally starting at zero
 * announces there is a game on, which is a different and lesser thing than
 * finding something by accident.
 *
 * What has been found is kept in the browser, so coming back does not reset
 * the hunt. It is a per-browser convenience and nothing more: the storage can
 * be cleared, disabled, or simply be a different machine, and all the room
 * loses is a number.
 */
const STORAGE_KEY = 'basement.eggs'

export default class Eggs extends EventEmitter
{
    constructor(world)
    {
        super()

        this.world = world
        this.scene = world.scene

        this.group = new THREE.Group()
        this.group.name = 'eggs'
        this.scene.add(this.group)

        this.definitions = definitions
        this.meshes = []
        this.found = this.read()

        this.build()
    }

    /** How many exist at all. Never shown to a visitor; used by the tests. */
    get total()
    {
        return this.definitions.length
    }

    /**
     * How many have been found, counting only ids still in the config.
     *
     * An egg that was removed after somebody found it would otherwise leave
     * them permanently one ahead of a room that no longer has it.
     */
    get count()
    {
        return this.definitions.filter((egg) => this.found.has(egg.id)).length
    }

    build()
    {
        // Invisible, but not `visible = false`: the raycaster skips what is
        // not visible, and this has to be hittable while being unseeable.
        const material = new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0,
            depthWrite: false,
        })

        for (const egg of this.definitions)
        {
            const [w, h] = egg.size ?? [0.1, 0.1]
            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material)

            if (egg.attach)
            {
                const host = this.scene.getObjectByName(egg.attach)
                if (!host) continue
                host.getWorldPosition(mesh.position)
                host.getWorldQuaternion(mesh.quaternion)
            }
            else if (egg.position)
            {
                mesh.position.fromArray(egg.position)
                mesh.rotation.y = egg.rotationY ?? 0
            }
            else continue

            mesh.name = `egg.${egg.id}`
            mesh.userData.egg = egg.id
            mesh.userData.noWire = true
            mesh.renderOrder = -1
            mesh.castShadow = false
            mesh.receiveShadow = false

            this.group.add(mesh)
            this.meshes.push(mesh)
        }
    }

    /** The ones still out there, which are the only ones worth hit-testing. */
    get pending()
    {
        return this.meshes.filter((mesh) => !this.found.has(mesh.userData.egg))
    }

    /**
     * True the first time this one is found, false every time after.
     *
     * `at` is where on screen it was clicked, passed along so the celebration
     * can start at the visitor's own pointer rather than somewhere else.
     */
    collect(id, at = null)
    {
        if (!id || this.found.has(id)) return false

        this.found.add(id)
        this.write()
        this.trigger('found', id, this.count, at)
        return true
    }

    /** Wipes the hunt. Here for the console, and for anyone testing. */
    reset()
    {
        this.found.clear()
        this.write()
        this.trigger('reset', 0)
    }

    // ------------------------------------------------------------------
    read()
    {
        try
        {
            const raw = window.localStorage.getItem(STORAGE_KEY)
            const list = raw ? JSON.parse(raw) : []
            return new Set(Array.isArray(list) ? list : [])
        }
        catch (error)
        {
            // Private windows, blocked storage, corrupt value. A hunt that
            // forgets itself is worth less than a room that fails to load.
            return new Set()
        }
    }

    write()
    {
        try
        {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...this.found]))
        }
        catch (error)
        {
            // Nothing to do and nothing worth saying.
        }
    }
}
