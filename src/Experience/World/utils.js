import * as THREE from 'three'

/** Small mesh helpers for the procedural blockout. */

export function box(w, h, d, material, x = 0, y = 0, z = 0, parent = null)
{
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    if (parent) parent.add(mesh)
    return mesh
}

export function cylinder(rTop, rBottom, h, material, x = 0, y = 0, z = 0, parent = null, segments = 16)
{
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segments), material)
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    if (parent) parent.add(mesh)
    return mesh
}

export function sphere(r, material, x = 0, y = 0, z = 0, parent = null, segments = 12)
{
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, segments, segments), material)
    mesh.position.set(x, y, z)
    if (parent) parent.add(mesh)
    return mesh
}

export function plane(w, h, material, x = 0, y = 0, z = 0, parent = null)
{
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material)
    mesh.position.set(x, y, z)
    mesh.receiveShadow = true
    if (parent) parent.add(mesh)
    return mesh
}

/** Black body + emissive canvas texture. Screens bloom through the emissive channel. */
export function screenMaterial(texture, intensity = 1)
{
    return new THREE.MeshStandardMaterial({
        color: '#000000',
        emissive: '#ffffff',
        emissiveMap: texture,
        emissiveIntensity: intensity,
        roughness: 0.35,
        metalness: 0,
    })
}

export function emissiveMaterial(color, intensity = 2)
{
    return new THREE.MeshStandardMaterial({
        color: '#000000',
        emissive: color,
        emissiveIntensity: intensity,
        roughness: 0.5,
    })
}
