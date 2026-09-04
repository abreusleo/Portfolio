import * as THREE from 'three'
import placements from '../config/models.js'
import Macbook from './Macbook.js'

/**
 * Swaps the procedural blockouts for the downloaded models.
 *
 * Runs once, after the files have loaded, and never blocks the room: anything
 * that fails to arrive simply keeps its blockout. The scene is built to be
 * complete without a single external file, and that stays true.
 *
 * Each model is normalised rather than trusted. Scale comes from measuring the
 * bounding box and dividing, position comes from re-centring that box on its
 * own footprint, and both are recomputed after scaling because a model whose
 * root node carries a transform lies about both.
 */
export default class Models
{
    constructor(world)
    {
        this.world = world
        this.scene = world.scene
        this.resources = world.resources

        this.group = new THREE.Group()
        this.group.name = 'models'
        this.scene.add(this.group)

        this.placed = []
        this.missing = []

        for (const [name, spec] of Object.entries(placements))
        {
            this.place(name, spec)
        }

        if (this.missing.length)
        {
            console.warn(`[models] still on the blockout: ${this.missing.join(', ')}`)
        }
    }

    place(name, spec)
    {
        // Dev knob for orienting a downloaded model: ?rot=<name>:<x>[,<y>]
        // in radians. Reasoning about a file's axes from its bounding box is
        // guesswork; rendering the candidates is not.
        const rot = new URLSearchParams(window.location.search).get('rot')
        if (rot && rot.split(':')[0] === name)
        {
            const [x, y, z] = rot.split(':')[1].split(',').map(Number)
            spec = { ...spec, rotationX: x }
            if (!Number.isNaN(y)) spec.rotationY = y
            if (!Number.isNaN(z)) spec.rotationZ = z
        }


        const asset = this.resources.items[spec.source]
        if (!asset || !asset.scene)
        {
            this.missing.push(name)
            return
        }

        const model = asset.scene

        // Anything that changes the model's shape has to happen before it is
        // measured. A tilt belongs on the model, not on the anchor: on the
        // anchor it would rotate the model out of the surface it was just sat
        // on, because the sitting is done by moving the box, and the box is
        // computed here.
        if (spec.rotationX) model.rotation.x = spec.rotationX
        if (spec.rotationZ) model.rotation.z = spec.rotationZ

        // A model with moving parts is posed to its rest position first, for
        // the same reason: the MacBook is measured with its lid shut, which is
        // how it will be standing there.
        let behaviour = null
        if (spec.behaviour === 'macbook') behaviour = new Macbook(this.world, model, asset)

        // Scale from the axis the placement cares about. A keyboard is its
        // length, a lamp is its height, and using the wrong one leaves the
        // object right in one dimension and wrong in the other two.
        model.updateMatrixWorld(true)
        const box = measure(model, spec.ignore)
        const size = box.getSize(new THREE.Vector3())
        const measured = size[spec.fit.axis]
        if (measured > 0) model.scale.multiplyScalar(spec.fit.size / measured)

        // Re-centre on the scaled box: horizontally on its footprint, and
        // vertically so the object stands on the surface instead of sinking
        // into it or floating above it.
        model.updateMatrixWorld(true)
        const scaled = measure(model, spec.ignore)
        const centre = scaled.getCenter(new THREE.Vector3())
        model.position.set(-centre.x, -scaled.min.y, -centre.z)
        model.updateMatrixWorld(true)

        const anchor = new THREE.Group()
        anchor.name = `model.${name}`
        anchor.position.fromArray(spec.position)
        anchor.rotation.y = spec.rotationY ?? 0
        anchor.add(model)

        this.prepare(model, spec)
        this.group.add(anchor)

        if (behaviour)
        {
            this.world.macbook = behaviour
            this.world.updatables.push(behaviour)
        }

        this.removeBlockout(spec.replaces)
        this.placed.push(name)
    }

    /**
     * Shadows on, and a triangle budget for the wireframe pass.
     *
     * The reveal bakes every edge in the scene into one buffer, and a 160k
     * triangle mouse would spend more time in EdgesGeometry than the whole
     * room does. Dense meshes are marked out of it: they miss the white line
     * phase and arrive with the colour, which nobody watching notices.
     */
    prepare(model, spec = {})
    {
        model.traverse((child) =>
        {
            if (!child.isMesh) return

            child.castShadow = true
            child.receiveShadow = true

            // Some exporters mark everything BLEND and double-sided whether or
            // not anything is see-through. On a solid object that is not a
            // subtle difference: the material goes into the transparent pass,
            // the back faces show through the front ones, and a steel tumbler
            // renders like glass.
            if (spec.opaque)
            {
                for (const material of materialsOf(child))
                {
                    material.transparent = false
                    material.depthWrite = true
                    material.alphaTest = 0
                    material.side = THREE.FrontSide
                    if (spec.roughnessFloor !== undefined && material.roughness !== undefined)
                    {
                        material.roughness = Math.max(material.roughness, spec.roughnessFloor)
                    }
                    material.needsUpdate = true
                }
            }

            const index = child.geometry?.index
            const position = child.geometry?.attributes?.position
            const triangles = index ? index.count / 3 : (position ? position.count / 3 : 0)
            if (triangles > WIRE_TRIANGLE_BUDGET) child.userData.noWire = true
        })
    }

    removeBlockout(name)
    {
        if (!name) return

        const blockout = this.scene.getObjectByName(name)
        if (!blockout) return

        blockout.removeFromParent()
        blockout.traverse((child) =>
        {
            if (child.isMesh) child.geometry?.dispose()
        })
    }
}

const WIRE_TRIANGLE_BUDGET = 40000

/**
 * The model's extent, ignoring meshes a placement has named as liars.
 *
 * Box3.setFromObject takes every mesh at its word, which is right until a file
 * contains a stray flat scrap sitting far from the rest of the model. Then the
 * box grows to reach it and the object is placed relative to something nobody
 * can see: the MacBook came with exactly that, and floated seven centimetres
 * off the desk because of it.
 */
function materialsOf(mesh)
{
    return Array.isArray(mesh.material) ? mesh.material : [mesh.material]
}

function measure(model, ignore)
{
    const box = new THREE.Box3()
    const skip = new Set(ignore ?? [])

    model.traverse((child) =>
    {
        if (!child.isMesh || skip.has(child.name)) return
        box.expandByObject(child)
    })

    return box.isEmpty() ? new THREE.Box3().setFromObject(model) : box
}
