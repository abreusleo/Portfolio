import * as THREE from 'three'

/**
 * White edge overlay of the whole room, used at the start of the entry
 * reveal: the space is drawn as lines before any surface fills in.
 *
 * Every mesh's hard edges are baked into one merged LineSegments so the
 * overlay costs a single draw call. It lives on layer 1, so the normal
 * camera pass ignores it and the renderer can shoot it separately.
 */
export const WIRE_LAYER = 1

export default class Wireframe
{
    constructor(world)
    {
        this.world = world
        this.scene = world.scene

        const positions = []
        const vertex = new THREE.Vector3()
        const matrix = new THREE.Matrix4()

        this.scene.updateMatrixWorld(true)

        this.scene.traverse((child) =>
        {
            if (!child.isMesh) return
            if (child.userData.noWire) return

            const geometry = child.geometry
            if (!geometry || !geometry.attributes.position) return

            let edges
            try
            {
                edges = new THREE.EdgesGeometry(geometry, 24)
            }
            catch (error)
            {
                return
            }

            const array = edges.attributes.position.array

            if (child.isInstancedMesh)
            {
                for (let i = 0; i < child.count; i++)
                {
                    child.getMatrixAt(i, matrix)
                    matrix.premultiply(child.matrixWorld)
                    for (let j = 0; j < array.length; j += 3)
                    {
                        vertex.set(array[j], array[j + 1], array[j + 2]).applyMatrix4(matrix)
                        positions.push(vertex.x, vertex.y, vertex.z)
                    }
                }
            }
            else
            {
                for (let j = 0; j < array.length; j += 3)
                {
                    vertex.set(array[j], array[j + 1], array[j + 2]).applyMatrix4(child.matrixWorld)
                    positions.push(vertex.x, vertex.y, vertex.z)
                }
            }

            edges.dispose()
        })

        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))

        this.object = new THREE.LineSegments(
            geometry,
            new THREE.LineBasicMaterial({ color: '#ffffff', toneMapped: false }),
        )
        this.object.name = 'wireframe'
        this.object.layers.set(WIRE_LAYER)
        this.object.frustumCulled = false
        this.scene.add(this.object)

        this.segments = positions.length / 6
    }
}
