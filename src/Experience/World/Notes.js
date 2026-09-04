import * as THREE from 'three'
import { makeNote } from './Textures.js'
import { api, bounds, collides, enabled, freeSpotNear, PAPER, WALL_SIZE, wall } from '../config/notes.js'

/**
 * The message wall: what visitors leave, stuck to the door.
 *
 * The door rather than the plaster beside it, which is what the plan said. The
 * plaster strips flanking the door are 38 and 50 cm wide — too narrow for a
 * wall of anything — and the left wall, which is big enough, sits behind the
 * camera you arrive on. The door is in the opening frame, it was the last
 * large surface with nothing on it, and a note stuck to a door is where a note
 * actually goes.
 *
 * Where each note hangs is chosen by the person who wrote it: they pick the
 * blank one up and drag it somewhere. Nothing may cover anything, so the room
 * refuses a spot while the note is dragged over it, and the server refuses it
 * again on arrival. The server is the one that counts, because two people can
 * be over the same gap at the same moment and only one of them can have it.
 *
 * Nothing here can break the room. With no service configured the wall does
 * not appear at all; with one configured and unreachable, it appears empty and
 * the room carries on. Same rule as the models.
 */
export default class Notes
{
    constructor(world)
    {
        this.world = world
        this.scene = world.scene

        this.group = new THREE.Group()
        this.group.name = 'notes'
        this.scene.add(this.group)

        this.notes = []
        this.meshes = []
        this.geometry = new THREE.PlaneGeometry(wall.note, wall.note)

        // Where the blank one sits, in metres from the centre of the
        // rectangle. This is the position the next note is posted with.
        this.spot = { x: 0, y: 0 }

        // The one being read up close, if any. See openNote.
        this.reading = null
        this.readingTexture = null

        this.addTarget()
        this.addBlank()

        if (enabled) this.load()
    }

    /** Every taken centre, in wall-local metres. */
    get taken()
    {
        return this.notes.map((note) => ({ x: note.x ?? 0, y: note.y ?? 0 }))
    }

    /** True when nothing new fits without covering something. */
    get full()
    {
        return this.notes.length >= WALL_SIZE || freeSpotNear(0, 0, this.taken) === null
    }

    /** Invisible plate over the door, so one click frames the whole wall. */
    addTarget()
    {
        const target = new THREE.Mesh(
            new THREE.PlaneGeometry(wall.width + 0.12, wall.height + 0.16),
            new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
        )
        target.position.set(wall.x, wall.y, wall.z + 0.004)
        target.name = 'hotspot.notes'
        target.userData.noWire = true
        target.renderOrder = -1
        this.group.add(target)
    }

    /**
     * The note in the visitor's hand, and the ring of light around it.
     *
     * It is hidden until somebody asks to write. There used to be a blank one
     * stuck to the door at all times, doubling as the button, and it read as a
     * scrap of rubbish somebody had left: a pale square among the yellow ones,
     * saying nothing. The invitation lives on the panel now, and this appears
     * only once it has been accepted.
     *
     * Yellow like every other note, because it is going to become one. What
     * separates it from the wall is not its colour but the halo: a slightly
     * larger plane behind it in the accent, which reads as an outline because
     * the note covers its middle.
     */
    addBlank()
    {
        if (!enabled) return

        const accent = this.world.theme.accent

        // A hairline, not a frame. At 1.3 the border was thirteen millimetres
        // of solid colour on every side, which read as a glowing box with a
        // note inside it rather than as the note being the thing.
        this.halo = new THREE.Mesh(
            new THREE.PlaneGeometry(wall.note * 1.09, wall.note * 1.09),
            new THREE.MeshBasicMaterial({
                color: accent,
                transparent: true,
                opacity: 0.9,
                depthWrite: false,
                toneMapped: false,
            }),
        )
        this.halo.userData.noWire = true
        this.halo.visible = false
        this.group.add(this.halo)

        const material = new THREE.MeshStandardMaterial({
            map: makeNote({ blank: true, paper: PAPER }),
            roughness: 0.92,
            emissive: accent,
            emissiveIntensity: 0.1,
        })

        this.blank = new THREE.Mesh(this.geometry, material)
        this.blank.rotation.z = -0.04
        this.blank.userData.noWire = true
        this.blank.castShadow = false
        this.blank.visible = false
        this.group.add(this.blank)

        this.rest()
    }

    /** Puts the note in the visitor's hand, on a free spot to start from. */
    showGhost()
    {
        if (!this.blank) return
        this.rest()
        this.blank.visible = true
        this.halo.visible = true
    }

    hideGhost()
    {
        if (!this.blank) return
        this.blank.visible = false
        this.halo.visible = false
    }

    /** Keeps the halo under the note wherever the note goes. */
    moveGhost(x, y, z)
    {
        this.blank.position.set(wall.x + x, wall.y + y, z)
        this.halo.position.set(wall.x + x, wall.y + y, z - 0.0006)
        this.halo.rotation.z = this.blank.rotation.z
    }

    /**
     * Moves the blank note under the pointer. Returns whether it is somewhere
     * it could actually stay.
     *
     * The position is taken as given rather than snapped to the nearest gap.
     * Snapping while the note is still moving makes it jump out from under the
     * pointer, which reads as the room fighting the drag. An occupied spot
     * gets the refusal colour instead, and the snap happens on release.
     */
    dragTo(x, y)
    {
        if (!this.blank) return false

        this.spot.x = Math.max(-bounds.x, Math.min(bounds.x, x))
        this.spot.y = Math.max(-bounds.y, Math.min(bounds.y, y))
        this.moveGhost(this.spot.x, this.spot.y, wall.z + 0.014)

        const clear = !collides(this.spot.x, this.spot.y, this.taken)
        this.blank.material.color.setHex(clear ? 0xffffff : 0xff8080)
        this.halo.material.color.set(clear ? this.world.theme.accent : '#ff5c5c')
        return clear
    }

    /** Settles the blank note on the nearest free spot, or null if there is none. */
    settle()
    {
        if (!this.blank) return null

        this.blank.material.color.setHex(0xffffff)
        this.halo.material.color.set(this.world.theme.accent)

        const spot = freeSpotNear(this.spot.x, this.spot.y, this.taken)
        if (!spot) return null

        this.spot = spot
        this.moveGhost(spot.x, spot.y, wall.z + 0.01)
        return spot
    }

    /**
     * Parks the blank note somewhere free, so the invitation never sits on top
     * of somebody's message. On a full door it rests over the oldest note,
     * which is the one the next message takes the place of.
     */
    rest()
    {
        if (!this.blank) return

        // On a full door the blank one sits over the oldest note, because that
        // is where the next message actually goes. A door can be full on the
        // count while still having a gap in it, and resting in that gap would
        // point at a spot the note is not going to take.
        const oldest = this.notes[this.notes.length - 1]
        const spot = this.full ? null : freeSpotNear(0, -bounds.y * 0.55, this.taken)

        if (spot)
        {
            this.spot = spot
        }
        else if (oldest)
        {
            this.spot = { x: oldest.x ?? 0, y: oldest.y ?? 0 }
        }

        this.moveGhost(this.spot.x, this.spot.y, wall.z + 0.01)
        this.blank.material.color.setHex(0xffffff)
        this.halo.material.color.set(this.world.theme.accent)
    }

    /**
     * Redraws one note at a size worth reading, for the camera that is about
     * to sit in front of it.
     *
     * The wall draws its notes at 320 pixels, which is right for thirty-six of
     * them seen from across a room and useless at arm's length. Rather than
     * pay for a big texture on every note against the chance that one is
     * opened, the one that is opened gets a new one, and hands it back on the
     * way out. Only ever one exists.
     */
    openNote(mesh)
    {
        if (!mesh?.userData?.note) return null
        if (this.reading?.mesh === mesh) return mesh.userData.note

        this.closeNote()

        const note = mesh.userData.note
        const sharp = makeNote({
            text: note.text,
            name: note.name,
            country: note.country,
            size: 1024,
        })

        this.reading = { mesh, map: mesh.material.map }
        this.readingTexture = sharp
        mesh.material.map = sharp
        mesh.material.needsUpdate = true

        return note
    }

    closeNote()
    {
        if (!this.reading) return

        const { mesh, map } = this.reading
        if (mesh.material)
        {
            mesh.material.map = map
            mesh.material.needsUpdate = true
        }
        this.readingTexture?.dispose()
        this.readingTexture = null
        this.reading = null
    }

    async load()
    {
        try
        {
            const response = await fetch(`${api}/api/notes?limit=${WALL_SIZE}`, {
                headers: { Accept: 'application/json' },
            })
            if (!response.ok) throw new Error(`the wall answered ${response.status}`)

            const body = await response.json()
            this.render(Array.isArray(body.notes) ? body.notes : [])
        }
        catch (error)
        {
            // A wall nobody can reach is an empty wall, not a broken room.
            console.warn('[notes] could not be read', error)
        }
    }

    /** Adds one note without redrawing the others. Used after posting. */
    add(note)
    {
        // The one in hand has just become one on the wall.
        this.hideGhost()
        this.notes.unshift(note)
        this.render(this.notes.slice(0, WALL_SIZE))
    }

    render(notes)
    {
        for (const mesh of this.meshes)
        {
            mesh.removeFromParent()
            mesh.material.map.dispose()
            mesh.material.dispose()
        }

        // A note being read owns a texture this loop would dispose, and its
        // mesh is about to stop existing anyway.
        this.closeNote()

        this.meshes = []
        this.notes = notes

        notes.forEach((note, index) =>
        {
            const jitter = hash(note.id ?? String(index))

            const material = new THREE.MeshStandardMaterial({
                map: makeNote({ text: note.text, name: note.name, country: note.country }),
                roughness: 0.94,
            })

            const mesh = new THREE.Mesh(this.geometry, material)
            mesh.userData.note = note
            mesh.position.set(
                wall.x + (note.x ?? 0),
                wall.y + (note.y ?? 0),
                // Stacked a hair apart so touching corners never z-fight
                wall.z + 0.002 + index * 0.00004,
            )
            // The tilt is the whole reason neighbours are held a diagonal
            // apart; it stays inside what that distance already allows for.
            mesh.rotation.z = (jitter - 0.5) * 0.22
            mesh.userData.noWire = true
            mesh.castShadow = false

            this.group.add(mesh)
            this.meshes.push(mesh)
        })

        this.rest()
    }
}

/** Stable pseudo-random in [0, 1) from a note's id, so a note keeps its look. */
function hash(seed)
{
    let value = 2166136261
    for (let i = 0; i < seed.length; i++)
    {
        value ^= seed.charCodeAt(i)
        value = Math.imul(value, 16777619)
    }
    return ((value >>> 0) % 100000) / 100000
}
