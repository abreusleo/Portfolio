import * as THREE from 'three'

import Experience from './Experience.js'
import stations from './config/stations.js'
import videos from './config/videos.js'
import content from './config/content.js'
import { emblemSvg } from './config/emblems.js'
import { locale, strings, t } from './config/i18n.js'
import { api, enabled as notesEnabled, MAX_LENGTH, wall } from './config/notes.js'
import { isTyping } from './Utils/typing.js'
import { isMobile } from './Utils/device.js'
import Desktop from './Desktop.js'
import Markers from './World/Markers.js'

/**
 * Clickable objects in the scene.
 *
 * Products and prints work in two steps: the first click frames the whole
 * group, the second frames one piece. The board and the TV open directly.
 * Camera stations are derived from each object, not written by hand.
 */

// The door leaf, as a plane to drag against. A note being placed follows the
// pointer across this, not across the screen.
const DOOR_PLANE = new THREE.Plane(new THREE.Vector3(0, 0, 1), -wall.z)
const _hit = new THREE.Vector3()

// The centre of the message wall, and how close the camera has to be before
// its notes are worth testing against the pointer. The station in front of the
// door sits at 2.15 m and the overview at about 4.6, so this separates them.
const DOOR_CENTRE = new THREE.Vector3(wall.x, wall.y, wall.z)
const READ_RANGE = 3

const GROUPS = {
    products: {
        proxy: 'hotspot.products',
        distance: 2.5,
        fov: 40,
        side: 0.12,
        parallax: 0.3,
        label: strings.seeShelves,
        children: ['product.01', 'product.02'],
    },
    prints: {
        proxy: 'hotspot.prints',
        distance: 2.95,
        fov: 38,
        side: 0.13,
        parallax: 0.3,
        label: strings.seeProjects,
        children: ['print.01', 'print.02', 'print.03', 'print.04', 'print.05', 'print.06'],
    },
}

const DETAILS = {
    'product.01': { proxy: 'hotspot.product.01', distance: 2.0, fov: 40, side: 0.12, group: 'products' },
    'product.02': { proxy: 'hotspot.product.02', distance: 2.0, fov: 40, side: 0.12, group: 'products' },
    'print.01': { proxy: 'hotspot.print.01', distance: 1.15, fov: 36, side: 0.24, group: 'prints' },
    'print.02': { proxy: 'hotspot.print.02', distance: 1.15, fov: 36, side: 0.24, group: 'prints' },
    'print.03': { proxy: 'hotspot.print.03', distance: 1.15, fov: 36, side: 0.24, group: 'prints' },
    'print.04': { proxy: 'hotspot.print.04', distance: 1.15, fov: 36, side: 0.24, group: 'prints' },
    'print.05': { proxy: 'hotspot.print.05', distance: 1.15, fov: 36, side: 0.24, group: 'prints' },
    'print.06': { proxy: 'hotspot.print.06', distance: 1.15, fov: 36, side: 0.24, group: 'prints' },
    'board': { proxy: 'screen.board', distance: 1.9, fov: 40, side: 0.2, group: null },
    'work': { proxy: 'hotspot.laptop', distance: 1.15, fov: 42, side: 0.14, parallax: 0.1, group: null, label: strings.seeWork },
    // Far enough back that the whole door is on screen. At 1.12 m the top and
    // bottom of the wall sat past the edge of the frame, so a third of the
    // places a note could go could not be seen, let alone dragged to.
    'notes': { proxy: 'hotspot.notes', distance: 2.15, fov: 38, side: 0.16, parallax: 0.1, group: null, label: strings.seeNotes },
    'about': { proxy: 'hotspot.about', distance: 1.8, fov: 42, side: 0.14, lift: 0.62, parallax: 0.12, group: null, label: strings.seeAbout },
}

export default class Interactions
{
    constructor()
    {
        this.experience = new Experience()
        this.canvas = this.experience.canvas
        this.camera = this.experience.camera
        this.sizes = this.experience.sizes
        this.controls = this.experience.controls
        this.world = this.experience.world

        this.raycaster = new THREE.Raycaster()
        this.pointer = new THREE.Vector2(-2, -2)
        this.hotspots = []
        this.hovered = null
        this.enabled = false

        // The objects the ray is tested against, rebuilt when the framed group
        // changes rather than on every frame: at high refresh rates the
        // per-frame copies were garbage worth collecting.
        this.candidates = []
        this.candidatesFor = undefined
        this.candidatesCount = -1

        this.activeGroup = null
        this.detailOpen = false
        this.videoOpen = false
        this.desktopOpen = false
        this.composeOpen = false
        this.detailNav = null

        // Choosing where the note goes happens before writing it: the visitor
        // is at the door with the blank one under the pointer.
        this.placing = false
        this.dragging = false

        // A note being read up close, and the mesh under the pointer.
        this.noteOpen = false
        this.hoveredNote = null
        this.hoveredEgg = null
        this.cursor = 'default'

        this.player = new VideoPlayer(() => this.close())
        this.composer = new Composer(
            () => this.close(),
            (note) => this.world.notes?.add(note),
            () => this.beginPlacing(),
        )
        this.placeHint = document.getElementById('place-hint')
        this.panel = new InfoPanel(() => this.close(), () => this.back())
        this.desktopEl = document.getElementById('desktop')
        this.desktopStage = document.getElementById('desktop-stage')
        document.getElementById('desktop-exit').addEventListener('click', () => this.close())
        this.tooltip = document.getElementById('hotspot-label')

        this.setEvents()

        // Reopening is the cheapest correct answer: the panel is rebuilt from
        // the same entry, now read in the other language.
        locale.on('change', () =>
        {
            this.panel.retext()
            this.player.retext()
        })

        if (this.world.ready) this.register()
        else this.world.on('ready', () => this.register())
    }

    // ------------------------------------------------------------------
    setEvents()
    {
        this.canvas.addEventListener('pointermove', (e) =>
        {
            // A finger is only tracked while it is actually dragging a note.
            if (e.pointerType === 'touch' && !this.dragging) return
            this.setPointer(e)
            if (this.dragging) this.dragBlank()
        })

        this.canvas.addEventListener('pointerdown', (e) =>
        {
            // A finger has no hover, so a label that follows the pointer has
            // nothing to follow and nothing to dismiss it: it lands on the
            // first tap and stays where that tap was for the rest of the
            // visit. The cursor it was written for does not exist here.
            this.touching = e.pointerType !== 'mouse'
            this.downAt = { x: e.clientX, y: e.clientY }
            if (!this.placing) return

            this.setPointer(e)
            if (this.overBlank())
            {
                this.dragging = true
                this.canvas.setPointerCapture?.(e.pointerId)
            }
        })

        this.canvas.addEventListener('pointerup', (e) =>
        {
            if (this.dragging)
            {
                // A press and release without moving is a drag of zero length,
                // which leaves the note where it already was. That is the
                // right answer for somebody who just wants to write one.
                this.setPointer(e)
                this.dragBlank()
                this.dragging = false
                this.downAt = null
                this.finishPlacing()
                return
            }

            if (!this.downAt) return
            const moved = Math.hypot(e.clientX - this.downAt.x, e.clientY - this.downAt.y)
            this.downAt = null
            if (moved > 6) return

            this.setPointer(e)

            // A finger never hovers. pointermove is skipped for touch above,
            // and what select() reads is the hover the frame loop computed —
            // which, for a tap, is whatever was under a pointer that was never
            // there. Refreshing it here is what makes the room answer a touch
            // at all: without this line every tap in the scene does nothing.
            if (e.pointerType !== 'mouse') this.update()

            this.select()
        })

        document.addEventListener('keydown', (e) =>
        {
            if (e.code === 'Escape')
            {
                // Inside the machine, Escape shuts the top window first and
                // only leaves the desk once there is nothing left open.
                if (this.desktopOpen && this.desktop?.closeTop()) return
                if (this.noteOpen) this.closeNote()
                else if (this.composeOpen) this.close()
                else if (this.detailOpen || this.videoOpen || this.desktopOpen) this.back()
                else if (this.activeGroup) this.close()
                return
            }

            // Escape above goes on working while writing: it is how the
            // composer is closed. Everything below here is navigation, and
            // navigation belongs to the field while somebody is typing in it.
            if (isTyping()) return

            if (!this.detailOpen || !this.detailNav) return
            if (e.code === 'ArrowLeft') this.detailNav.prev()
            else if (e.code === 'ArrowRight') this.detailNav.next()
        })
    }

    setPointer(event)
    {
        this.pointer.set(
            (event.clientX / this.sizes.width) * 2 - 1,
            -(event.clientY / this.sizes.height) * 2 + 1,
        )
    }

    /**
     * Builds a station in front of an object, aimed slightly to its right so
     * the object sits on the left and the panel has room.
     */
    stationFor(object, { distance, fov = 38, side = 0.22, parallax = 0.08, lift = 0 })
    {
        const position = new THREE.Vector3()
        const quaternion = new THREE.Quaternion()
        object.getWorldPosition(position)
        object.getWorldQuaternion(quaternion)

        const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion).normalize()
        const forward = normal.clone().negate()
        const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()

        // `lift` raises the camera without raising what it looks at, which
        // is how you get a view down onto a row of objects on a desk instead
        // of one straight through them at their own height.
        const eye = position.clone().addScaledVector(normal, distance)
        eye.y += lift

        return {
            position: eye.toArray(),
            target: position.clone().addScaledVector(right, distance * side).toArray(),
            fov,
            parallax,
        }
    }

    /** Called once the world has finished building. */
    register()
    {
        const scene = this.experience.scene

        const tvScreen = scene.getObjectByName('screen.tv')
        if (tvScreen)
        {
            this.add({
                object: tvScreen,
                id: 'tv',
                kind: 'video',
                station: stations.tv,
                label: strings.seeVideos,
            })
        }

        // Nothing on the door starts the composer any more. The invitation is
        // the button on the wall's own panel, and the note only exists once it
        // has been pressed; see World/Notes.js addBlank.

        // The tower and the main screen both wake the machine
        const tower = scene.getObjectByName('hotspot.pc')
        if (tower)
        {
            this.add({
                object: tower,
                id: 'pc',
                kind: 'desktop',
                station: stations.desk,
                label: strings.useComputer,
            })
        }

        const mainScreen = scene.getObjectByName('screen.main')
        if (mainScreen)
        {
            this.add({
                object: mainScreen,
                id: 'pc.screen',
                kind: 'desktop',
                station: stations.desk,
                label: strings.useComputer,
            })
        }

        for (const [id, group] of Object.entries(GROUPS))
        {
            const object = scene.getObjectByName(group.proxy)
            if (!object) continue
            this.add({
                object,
                id,
                kind: 'group',
                station: this.stationFor(object, group),
                label: group.label,
            })
        }

        for (const [id, detail] of Object.entries(DETAILS))
        {
            const object = scene.getObjectByName(detail.proxy)
            if (!object) continue

            const entry = content[id]
            this.add({
                object,
                id,
                kind: 'detail',
                group: detail.group,
                station: this.stationFor(object, detail),
                label: detail.label ?? (entry ? entry.title : strings.seeDetail),
            })
        }

        this.enabled = true
        this.warnEggsOnHotspots()

        // Before the `?open` shortcut returns, and before prewarm: this adds a
        // material to the scene, and a material that is not in the scene when
        // prewarm runs is a shader compiled on the frame it is first drawn —
        // a third of a second of frozen room, which is what prewarm exists to
        // prevent. Placed after the early return, it simply never ran.
        this.markers = new Markers(this.hotspots)

        // `?open=prints` or `?open=print.03` jumps straight there, for screenshots.
        const open = new URLSearchParams(window.location.search).get('open')
        if (!open) return

        const jump = () => window.requestAnimationFrame(() =>
        {
            if (open === 'tv') this.openVideo(0)
            else if (open === 'compose') this.openCompose(0)
            else if (open === 'pc') this.openDesktop(0)
            else if (GROUPS[open]) this.openGroup(open, 0)
            else if (DETAILS[open]) this.openDetail(open, 0)
        })

        // Wait for the models: jumping straight to the laptop before its
        // model exists opens nothing, because there is nothing to open yet.
        if (this.world.dressed) jump()
        else this.world.on('dressed', jump)
    }

    /**
     * Says so when a hidden thing was put on top of a clickable one.
     *
     * An egg there takes the hotspot's first click and borrows its pointer
     * cursor, so it is both broken and no longer hidden. It is invisible by
     * design, which means nothing on screen would ever tell you; this does.
     */
    warnEggsOnHotspots()
    {
        const eggs = this.world.eggs
        if (!eggs?.meshes.length) return

        const box = new THREE.Box3()
        const point = new THREE.Vector3()

        for (const egg of eggs.meshes)
        {
            egg.getWorldPosition(point)
            for (const hotspot of this.hotspots)
            {
                box.setFromObject(hotspot.object)
                if (!box.containsPoint(point)) continue

                console.warn(
                    `[eggs] ${egg.name} sits on ${hotspot.object.name}: it will swallow that`
                    + ' first click of that hotspot and show a pointer cursor. Move one of them.',
                )
                break
            }
        }
    }

    add(hotspot)
    {
        hotspot.object.userData.hotspot = hotspot
        this.hotspots.push(hotspot)
    }

    find(id)
    {
        return this.hotspots.find((h) => h.id === id)
    }

    // ------------------------------------------------------------------
    select()
    {
        // Before anything else, and silently. An egg that announced itself
        // through the cursor would not be hidden, so the only way to know one
        // is there is to have clicked it.
        if (this.collectEgg()) return

        if (this.hoveredNote)
        {
            this.openNote(this.hoveredNote)
            return
        }

        if (!this.canInteract() || !this.hovered) return

        const hotspot = this.hovered
        this.clearHover()

        // Clicking a child in the room while its group is closed opens the
        // group first: in the scene you are standing in front of a wall of
        // six, and stepping to the wall before the one is what the eye
        // expects. A list has no wall, so the menu skips this and goes
        // straight to what was named.
        if (hotspot.kind !== 'group' && hotspot.group && this.activeGroup !== hotspot.group)
        {
            this.openGroup(hotspot.group)
            return
        }

        this.open(hotspot)
    }

    /**
     * Everything that can be opened, and the only place that decides how.
     *
     * The room and the menu both come through here on purpose: two lists of
     * the same branches drift, and the day they do, one of the two surfaces
     * starts doing something subtly different with the same object.
     */
    open(hotspot)
    {
        if (!hotspot) return

        // Somebody who has started opening things does not need to be
        // walked anywhere.
        this.experience.ui?.tour?.stop()

        if (hotspot.kind === 'compose') this.openCompose()
        else if (hotspot.kind === 'video') this.openVideo()
        else if (hotspot.kind === 'desktop') this.openDesktop()
        else if (hotspot.kind === 'group') this.openGroup(hotspot.id)
        else this.openDetail(hotspot.id)
    }

    /**
     * The composer travels to the wall first when it is opened from across the
     * room, so a visitor writes with the thing they are writing on in view.
     *
     * On arrival the note is not written but placed: the blank one is under
     * the pointer and goes where it is dragged. Writing comes after, because
     * choosing the spot is the part that needs to see the door.
     */
    openCompose(duration = 1.4)
    {
        this.composeOpen = true
        this.detailOpen = false
        this.panel.close()

        // Square on to the door rather than the panel's framing: there is no
        // panel here, and the note has to be draggable into every corner.
        const station = this.placeStation() ?? this.find('notes')?.station
        const arrived = station ? this.camera.goTo(station, duration, 'power2.inOut') : Promise.resolve()

        arrived.then(() =>
        {
            if (!this.composeOpen) return

            const notes = this.world.notes
            if (!notes?.blank || notes.full)
            {
                // Nowhere left to choose. The note still gets written; it
                // takes the place of the oldest one on the door.
                this.composer.open({ full: true })
                return
            }
            this.beginPlacing()
        })
    }

    /** Head-on framing of the whole door, with room to spare around it. */
    placeStation()
    {
        const door = this.experience.scene.getObjectByName('hotspot.notes')
        if (!door) return null
        return this.stationFor(door, { distance: 2.1, fov: 38, side: 0, parallax: 0 })
    }

    beginPlacing()
    {
        const notes = this.world.notes
        if (!notes?.blank) return

        this.composeOpen = true
        this.composer.close()
        notes.showGhost()

        this.placing = true
        this.camera.hold = true
        this.placeHint?.classList.remove('hidden')
    }

    endPlacing()
    {
        this.placing = false
        this.dragging = false
        this.camera.hold = false
        this.placeHint?.classList.add('hidden')
    }

    /** Whether the ray is currently over the blank note. */
    overBlank()
    {
        const blank = this.world.notes?.blank
        if (!blank) return false

        this.raycaster.setFromCamera(this.pointer, this.camera.instance)
        return this.raycaster.intersectObject(blank, false).length > 0
    }

    /** Slides the blank note along the door under the pointer. */
    dragBlank()
    {
        const notes = this.world.notes
        if (!notes) return

        this.raycaster.setFromCamera(this.pointer, this.camera.instance)
        if (!this.raycaster.ray.intersectPlane(DOOR_PLANE, _hit)) return

        notes.dragTo(_hit.x - wall.x, _hit.y - wall.y)
    }

    /** Let go: the note settles on the nearest free spot and the box opens. */
    finishPlacing()
    {
        const spot = this.world.notes?.settle() ?? null
        this.endPlacing()
        this.composer.open(spot ? { spot } : { full: true })
    }

    /**
     * Tests the click against the hidden things. Returns true when one of them
     * was found for the first time, which swallows the click: whatever is
     * behind the plate does not also open.
     */
    collectEgg()
    {
        const eggs = this.world.eggs
        if (!eggs?.meshes.length || this.controls.active) return false

        this.raycaster.setFromCamera(this.pointer, this.camera.instance)
        const hit = this.raycaster.intersectObjects(eggs.pending, false)[0]
        if (!hit) return false

        // Where the pointer is, in screen pixels, so the celebration can begin
        // under the visitor's own hand.
        const at = {
            x: (this.pointer.x * 0.5 + 0.5) * this.sizes.width,
            y: (-this.pointer.y * 0.5 + 0.5) * this.sizes.height,
        }
        return eggs.collect(hit.object.userData.egg, at)
    }

    /**
     * Whether the hidden things are worth hit-testing this frame.
     *
     * No distance gate here, unlike the notes: there are a handful of these
     * and they can be anywhere, so the whole test is a couple of planes. Only
     * the ones still unfound are checked, so the hunt gets cheaper as it goes.
     */
    canCollectEggs()
    {
        return this.enabled
            && !this.controls.active
            && !this.videoOpen
            && !this.desktopOpen
            && !this.composeOpen
            && !this.placing
            && (this.world.eggs?.meshes.length ?? 0) > 0
    }

    /**
     * One place decides what the pointer looks like.
     *
     * Three different things can claim it now, and letting each set the style
     * directly meant whichever ran last won. Written only on a change: the
     * value is assigned every frame otherwise, for nothing.
     */
    applyCursor()
    {
        const wanted = (this.hovered || this.hoveredNote || this.hoveredEgg) ? 'pointer' : 'default'
        if (wanted === this.cursor) return

        this.cursor = wanted
        this.canvas.style.cursor = wanted
    }

    /**
     * Whether a note on the door can be picked up and read right now.
     *
     * Deliberately not blocked by the side panel. The panel about the wall is
     * exactly what is on screen when a visitor is standing at the wall, so
     * refusing to read a note while it is open refused the only moment anybody
     * would try.
     *
     * It is blocked by distance, though, and that is not only tidiness. This
     * runs a second raycast on every frame, over as many as thirty-six meshes,
     * and measuring it put the cost at about 1.4 ms a frame — a third of the
     * budget at 240 Hz, spent hit-testing notes that were four metres away and
     * fifteen pixels wide. Close to the door it is worth paying; from across
     * the room there was nothing there anybody could aim at anyway.
     */
    canReadNotes()
    {
        return this.enabled
            && !this.controls.active
            && !this.placing
            && !this.videoOpen
            && !this.desktopOpen
            && !this.composeOpen
            && (this.world.notes?.meshes.length ?? 0) > 0
            && this.camera.instance.position.distanceToSquared(DOOR_CENTRE) < READ_RANGE * READ_RANGE
    }

    /**
     * Frames one note close enough to read, and redraws it at a size that
     * survives being read. Its neighbours stay in shot, which is what makes it
     * feel like leaning in rather than opening a dialog.
     */
    openNote(mesh)
    {
        const note = this.world.notes?.openNote(mesh)
        if (!note) return

        this.noteOpen = true
        this.clearHover()
        this.camera.goTo(this.stationFor(mesh, { distance: 0.34, fov: 34, side: 0, parallax: 0.04 }), 1)
    }

    /**
     * The door, as a list.
     *
     * Every note is a small piece of paper at an angle, which is a fine thing
     * to lean into and a poor thing to aim a finger at. The wall's own panel
     * already knows how to show a set of things worth opening, so it shows
     * this one: a name to press instead of a square centimetre of paper.
     */
    noteItems()
    {
        return (this.world.notes?.meshes ?? []).map((mesh) =>
        {
            const note = mesh.userData.note
            return {
                id: note.id,
                title: note.name?.trim() || t(strings.unsigned),
                note: note.text,
            }
        })
    }

    pickNote(id)
    {
        const mesh = (this.world.notes?.meshes ?? []).find((m) => m.userData.note?.id === id)
        if (!mesh) return

        // The camera leans in until the paper fills the frame, and on a phone
        // the sheet is over most of that frame. Folding is what the visitor
        // would do next anyway, and the header it leaves behind is how they
        // come back to the list for the following one.
        if (isMobile) this.panel.fold(true)
        this.openNote(mesh)
    }

    /** Back out to the whole door. */
    closeNote(duration = 1.1)
    {
        if (!this.noteOpen) return

        this.noteOpen = false
        this.world.notes?.closeNote()

        const station = this.find('notes')?.station
        if (station) this.camera.goTo(station, duration, 'power2.inOut')
    }

    openVideo(duration = 1.5)
    {
        const hotspot = this.find('tv')
        if (!hotspot) return

        this.videoOpen = true
        this.panel.close()
        this.camera.goTo(hotspot.station, duration, 'power2.inOut').then(() =>
        {
            if (this.videoOpen) this.player.open(0)
        })
    }

    openDesktop(duration = 1.6)
    {
        this.desktopOpen = true
        this.panel.close()
        this.player.close()

        this.camera.goTo(stations.desk, duration, 'power2.inOut').then(() =>
        {
            if (this.desktopOpen) this.showDesktop()
        })
    }

    /**
     * Builds the working desktop, once, and shows it.
     *
     * This used to mount the monitor's own canvas, which made the two screens
     * the same object and so incapable of disagreeing. A desktop you can use
     * needs hover, scrolling and drag, none of which a canvas has, so it is a
     * document now. What keeps it honest is the config: Desktop.js and
     * World/DesktopScreen.js read the same three apps in the same order.
     */
    showDesktop()
    {
        if (!this.desktop) this.desktop = new Desktop(this.desktopStage)

        this.desktop.tick()
        this.desktop.showIntro()
        this.desktopEl.classList.remove('hidden')
        this.desktopEl.setAttribute('aria-hidden', 'false')
    }

    hideDesktop()
    {
        this.desktop?.closeAll()
        this.desktopEl.classList.add('hidden')
        this.desktopEl.setAttribute('aria-hidden', 'true')
    }

    openGroup(id, duration = 1.5)
    {
        const hotspot = this.find(id)
        if (!hotspot) return

        this.activeGroup = id
        this.detailOpen = false
        this.videoOpen = false
        this.player.close()

        const items = GROUPS[id].children
            .filter((childId) => content[childId])
            .map((childId) => ({
                id: childId,
                title: content[childId].title,
                note: content[childId].kicker ?? content[childId].eyebrow ?? '',
            }))

        this.camera.goTo(hotspot.station, duration, 'power2.inOut').then(() =>
        {
            if (this.activeGroup !== id || this.detailOpen) return
            this.panel.open(id, { items, onPick: (childId) => this.openDetail(childId) })
        })
    }

    openDetail(id, duration = 1.2)
    {
        const hotspot = this.find(id)
        if (!hotspot) return

        this.detailOpen = true
        this.videoOpen = false
        this.player.close()

        const group = DETAILS[id]?.group ?? null
        if (group) this.activeGroup = group

        // Siblings inside the same group, so the arrows can step through them
        const siblings = group
            ? GROUPS[group].children.filter((childId) => this.find(childId))
            : []
        const index = siblings.indexOf(id)
        const hasSiblings = index >= 0 && siblings.length > 1

        const prev = hasSiblings ? siblings[(index - 1 + siblings.length) % siblings.length] : null
        const next = hasSiblings ? siblings[(index + 1) % siblings.length] : null

        this.detailNav = hasSiblings
            ? { prev: () => this.openDetail(prev, 0.7), next: () => this.openDetail(next, 0.7) }
            : null

        // The laptop is the one hotspot that changes the object it frames.
        if (id === 'work') this.world.macbook?.open(duration === 0)

        this.camera.goTo(hotspot.station, duration, 'power2.inOut').then(() =>
        {
            if (!this.detailOpen) return
            this.panel.open(id, {
                // An empty array still draws a list, and an empty list on a
                // door nobody has written on yet is a box saying nothing.
                items: id === 'notes' ? (this.noteItems().length ? this.noteItems() : null) : null,
                onPick: id === 'notes' ? (noteId) => this.pickNote(noteId) : null,
                onAction: id === 'notes' && notesEnabled ? () => this.openCompose() : null,
                actionLabel: strings.writeNote,
                onBack: group ? () => this.openGroup(group) : null,
                onPrev: this.detailNav ? this.detailNav.prev : null,
                onNext: this.detailNav ? this.detailNav.next : null,
                position: hasSiblings ? [index + 1, siblings.length] : null,
            })
        })
    }

    /** One step back: detail returns to its group, everything else closes. */
    back()
    {
        if (this.videoOpen || this.desktopOpen)
        {
            this.close()
            return
        }

        if (this.detailOpen)
        {
            this.world.macbook?.close()
            const group = this.activeGroup
            this.detailOpen = false
            if (group)
            {
                this.openGroup(group)
                return
            }
        }

        this.close()
    }

    close()
    {
        this.world.macbook?.close()
        this.noteOpen = false
        this.world.notes?.closeNote()
        this.world.notes?.hideGhost()
        this.endPlacing()
        this.composer.close()
        this.activeGroup = null
        this.detailOpen = false
        this.videoOpen = false
        this.desktopOpen = false
        this.composeOpen = false
        this.detailNav = null
        this.player.close()
        this.panel.close()
        this.hideDesktop()
        this.camera.goTo(stations.overview, 1.4, 'power2.inOut')
    }

    canInteract()
    {
        // A detail on screen holds the room still: the panel is what the
        // visitor is reading, and a scene that answered clicks underneath it
        // would swap the text out from under them.
        //
        // Folded is the exception, and it is the visitor's own statement. They
        // pressed the button that puts the reading away to look at the room —
        // handing them a room they still cannot touch answers the wrong half.
        // Only reachable on a phone; the fold has no button anywhere else.
        const reading = this.detailOpen && !this.panel.folded

        return this.enabled
            && !this.controls.active
            && !reading
            && !this.videoOpen
            && !this.desktopOpen
            && !this.composeOpen
            && !this.placing
    }

    clearHover()
    {
        this.hovered = null
        this.hoveredNote = null
        this.tooltip.classList.add('hidden')
        this.applyCursor()
    }

    // ------------------------------------------------------------------
    update()
    {
        if (!this.enabled) return

        // The door's notes answer to the pointer even while one of them is
        // open, so a visitor reads along the wall instead of backing out
        // between each one.
        if (this.canReadNotes())
        {
            this.raycaster.setFromCamera(this.pointer, this.camera.instance)
            const hit = this.raycaster.intersectObjects(this.world.notes.meshes, false)[0]
            const mesh = hit ? hit.object : null

            // The one already open announces nothing: its label would sit on
            // top of the signature the visitor came here to read.
            const reading = this.world.notes.reading?.mesh ?? null

            if (mesh !== this.hoveredNote)
            {
                this.hoveredNote = mesh && mesh !== reading ? mesh : null
                const note = this.hoveredNote?.userData.note ?? null
                this.tooltip.textContent = note && !this.touching ? (note.name || t(strings.readNote)) : ''
                this.tooltip.classList.toggle('hidden', !note || this.touching)
            }

            if (this.hoveredNote)
            {
                if (this.hovered) this.hovered = null
                this.moveTooltip()
                this.applyCursor()
                return
            }
        }
        else if (this.hoveredNote)
        {
            this.hoveredNote = null
            this.clearHover()
        }

        // The hidden things change the cursor and nothing else: no label, so
        // the pointer is a nudge rather than an announcement.
        if (this.canCollectEggs())
        {
            this.raycaster.setFromCamera(this.pointer, this.camera.instance)
            this.hoveredEgg = this.raycaster.intersectObjects(this.world.eggs.pending, false)[0]?.object ?? null
        }
        else this.hoveredEgg = null

        if (!this.canInteract())
        {
            if (this.hovered) this.clearHover()
            this.applyCursor()
            return
        }

        this.raycaster.setFromCamera(this.pointer, this.camera.instance)

        // While a group is framed, only its own pieces respond
        if (this.candidatesFor !== this.activeGroup || this.candidatesCount !== this.hotspots.length)
        {
            this.candidatesFor = this.activeGroup
            this.candidatesCount = this.hotspots.length
            this.candidates = this.hotspots
                .filter((h) => (this.activeGroup ? h.group === this.activeGroup : h.kind !== 'detail' || !h.group))
                .map((h) => h.object)
        }

        const hit = this.raycaster.intersectObjects(this.candidates, false)[0]
        const hotspot = hit ? hit.object.userData.hotspot : null

        if (hotspot !== this.hovered)
        {
            this.hovered = hotspot
            this.tooltip.textContent = hotspot && !this.touching ? t(hotspot.label) : ''
            this.tooltip.classList.toggle('hidden', !hotspot || this.touching)
        }

        if (this.hovered) this.moveTooltip()
        this.applyCursor()
    }

    moveTooltip()
    {
        const x = (this.pointer.x * 0.5 + 0.5) * this.sizes.width
        const y = (-this.pointer.y * 0.5 + 0.5) * this.sizes.height
        this.tooltip.style.transform = `translate(${x + 16}px, ${y + 16}px)`
    }
}

/** Side panel: text for one hotspot, or the index of a group. */
class InfoPanel
{
    constructor(onClose, onBackDefault)
    {
        this.root = document.getElementById('panel')
        this.eyebrow = document.getElementById('panel-eyebrow')
        this.foldButton = document.getElementById('panel-fold')

        // Remembered for the visit rather than reset on every open. Somebody
        // who folded the text away did it to look at the room, and unfolding
        // it for them on the next print is the room deciding it knows better.
        this.folded = false
        this.title = document.getElementById('panel-title')
        this.body = document.getElementById('panel-body')
        this.meta = document.getElementById('panel-meta')
        this.list = document.getElementById('panel-list')
        this.actionButton = document.getElementById('panel-action')
        this.backButton = document.getElementById('panel-back')
        this.closeButton = document.getElementById('panel-close')
        this.nav = document.getElementById('panel-nav')
        this.prevButton = document.getElementById('panel-prev')
        this.nextButton = document.getElementById('panel-next')
        this.countEl = document.getElementById('panel-count')

        this.onClose = onClose
        this.onBack = null
        this.onAction = null

        this.actionButton.addEventListener('click', () => this.onAction && this.onAction())
        this.onPrev = null
        this.onNext = null

        this.prevButton.addEventListener('click', () => this.onPrev && this.onPrev())
        this.nextButton.addEventListener('click', () => this.onNext && this.onNext())

        this.closeButton.addEventListener('click', () => this.onClose())
        this.foldButton?.addEventListener('click', () => this.fold(!this.folded))
        this.backButton.addEventListener('click', () =>
        {
            if (this.onBack) this.onBack()
            else onBackDefault()
        })
    }

    open(id, options = {})
    {
        const entry = content[id]
        if (!entry) return

        // Kept so the panel can be redrawn in another language without the
        // caller having to remember what it was showing.
        this.openId = id
        this.openOptions = options

        const {
            items = null, onPick = null, onBack = null, onPrev = null, onNext = null,
            position = null, onAction = null, actionLabel = null,
        } = options

        this.onBack = onBack
        this.onPrev = onPrev
        this.onNext = onNext
        this.onAction = onAction

        this.actionButton.classList.toggle('hidden', !onAction)
        if (onAction) this.actionButton.textContent = t(actionLabel)

        this.nav.classList.toggle('hidden', !onPrev && !onNext)
        if (position) this.countEl.textContent = `${String(position[0]).padStart(2, '0')} / ${String(position[1]).padStart(2, '0')}`

        this.eyebrow.textContent = t(entry.eyebrow) ?? ''
        this.title.textContent = t(entry.title)

        this.body.innerHTML = ''
        for (const paragraph of t(entry.body) ?? [])
        {
            const p = document.createElement('p')
            p.textContent = paragraph
            this.body.appendChild(p)
        }

        this.meta.innerHTML = ''
        for (const [label, value, href] of entry.meta ?? [])
        {
            const dt = document.createElement('dt')
            dt.textContent = t(label)

            const dd = document.createElement('dd')
            if (href)
            {
                const link = document.createElement('a')
                link.href = href
                link.target = '_blank'
                link.rel = 'noreferrer noopener'
                link.textContent = t(value)
                dd.appendChild(link)
            }
            else dd.textContent = t(value)

            this.meta.appendChild(dt)
            this.meta.appendChild(dd)
        }

        this.list.innerHTML = ''
        this.list.classList.toggle('hidden', !items)
        if (items)
        {
            items.forEach((item, index) =>
            {
                const button = document.createElement('button')
                button.type = 'button'
                button.className = 'panel-pick'
                // No number. Numbering says sequence, and these six are a
                // set: Hub does not come before Orb, it is just the one you
                // arrive through. The name carries the weight instead.
                button.innerHTML = `
                    <span class="pick-title"></span>
                    <span class="pick-note"></span>
                `
                button.querySelector('.pick-title').textContent = t(item.title)
                button.querySelector('.pick-note').textContent = t(item.note)
                button.addEventListener('click', () => onPick(item.id))
                this.list.appendChild(button)
            })
        }

        this.backButton.classList.toggle('hidden', !onBack)
        this.root.classList.remove('hidden')
        this.root.setAttribute('aria-hidden', 'false')
        this.fold(this.folded)
        this.closeButton.focus()
    }

    /**
     * Hides the reading and keeps everything needed to leave or step onward.
     *
     * On a phone the panel is a sheet across the bottom, and the camera has
     * just moved to frame the thing it describes — which is then behind the
     * sheet. The 3D stops meaning anything at the moment it means most.
     */
    fold(folded)
    {
        this.folded = folded
        this.root.classList.toggle('folded', folded)
        this.foldButton?.setAttribute('aria-expanded', String(!folded))
    }

    /** Redraws in the current language, if there is anything on screen. */
    retext()
    {
        if (this.root.classList.contains('hidden') || !this.openId) return
        this.open(this.openId, this.openOptions)
    }

    close()
    {
        this.root.classList.add('hidden')
        this.root.setAttribute('aria-hidden', 'true')
        this.openId = null
    }
}

/**
 * The box a visitor writes their note in.
 *
 * Every rule it enforces is enforced again on the server, and the server is
 * the one that counts: this side exists to answer instantly, not to protect
 * anything. What comes back from a refusal is the server's own sentence, shown
 * as written — it knows why it said no and this does not.
 */
class Composer
{
    constructor(onClose, onPosted, onPickAgain)
    {
        this.root = document.getElementById('compose')
        this.field = document.getElementById('compose-text')
        this.nameField = document.getElementById('compose-name')
        this.count = document.getElementById('compose-count')
        this.status = document.getElementById('compose-status')
        this.hint = document.getElementById('compose-hint')
        this.sendButton = document.getElementById('compose-send')
        this.cancelButton = document.getElementById('compose-cancel')

        this.onClose = onClose
        this.onPosted = onPosted
        this.onPickAgain = onPickAgain
        this.sending = false

        // Where the note was dropped on the door. Null means the door was
        // full and nothing was chosen.
        this.spot = null
        this.full = false

        this.field.addEventListener('input', () => this.measure())
        this.field.addEventListener('keydown', (e) =>
        {
            // Enter sends, Shift+Enter breaks the line: a note is one thought.
            if (e.key === 'Enter' && !e.shiftKey)
            {
                e.preventDefault()
                this.send()
            }
        })

        // Enter in the name field sends too, because there is nothing after it
        this.nameField?.addEventListener('keydown', (e) =>
        {
            if (e.key !== 'Enter') return
            e.preventDefault()
            this.send()
        })

        this.sendButton.addEventListener('click', () => this.send())
        this.cancelButton.addEventListener('click', () => this.onClose())
        this.root.addEventListener('click', (e) => { if (e.target === this.root) this.onClose() })
    }

    open(options = {})
    {
        this.spot = options.spot ?? null
        this.full = !!options.full

        this.field.value = ''
        this.field.placeholder = t(strings.composePlaceholder)
        if (this.nameField)
        {
            this.nameField.value = ''
            this.nameField.placeholder = t(strings.composeNamePlaceholder)
        }
        this.status.textContent = ''
        this.status.classList.remove('ok')
        if (this.hint) this.hint.textContent = t(this.full ? strings.composeFull : strings.composeHint)
        this.measure()

        this.root.classList.remove('hidden')
        this.root.setAttribute('aria-hidden', 'false')
        this.field.focus()
    }

    close()
    {
        this.root.classList.add('hidden')
        this.root.setAttribute('aria-hidden', 'true')
    }

    measure()
    {
        const length = [...this.field.value].length
        this.count.textContent = length + ' / ' + MAX_LENGTH
        this.count.classList.toggle('over', length > MAX_LENGTH)
        this.sendButton.disabled = this.sending || length === 0 || length > MAX_LENGTH
    }

    async send()
    {
        const text = this.field.value.trim()
        if (this.sending || !text) return

        this.sending = true
        this.measure()
        this.sendButton.textContent = t(strings.composeSending)
        this.status.textContent = ''
        this.status.classList.remove('ok')

        try
        {
            const response = await fetch(api + '/api/notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // A wish, not an instruction. The server clamps it to the
                // door, refuses it if somebody got there first, and ignores
                // it entirely when the door is full.
                body: JSON.stringify({
                    text,
                    name: this.nameField?.value.trim() ?? '',
                    x: this.spot?.x ?? 0,
                    y: this.spot?.y ?? 0,
                }),
            })

            const body = await response.json().catch(() => ({}))

            if (response.status === 409)
            {
                // Somebody took that gap while this one was being written.
                // Leaving the box open with an error would ask the visitor to
                // fix something they cannot reach from here, so it hands them
                // back the door instead.
                this.onPickAgain()
                return
            }

            if (!response.ok)
            {
                // The server explains itself in the visitor's own terms.
                this.status.textContent = body.error || t(strings.composeOffline)
                return
            }

            if (body.note) this.onPosted(body.note)

            this.status.classList.add('ok')
            this.status.textContent = t(strings.composeThanks)
            this.field.value = ''
            if (this.nameField) this.nameField.value = ''
            this.measure()
            window.setTimeout(() => this.onClose(), 1400)
        }
        catch (error)
        {
            this.status.textContent = t(strings.composeOffline)
        }
        finally
        {
            this.sending = false
            this.sendButton.textContent = t(strings.composeSend)
            this.measure()
        }
    }
}

/**
 * Video overlay with a playlist. The list comes from config/videos.js, so
 * adding or reordering videos is one file. Entries whose file is missing stay
 * in the list, marked as pending, and show the path they expect.
 */
class VideoPlayer
{
    constructor(onClose)
    {
        this.root = document.getElementById('player')
        this.video = document.getElementById('player-video')
        this.fallback = document.getElementById('player-fallback')
        this.closeButton = document.getElementById('player-close')
        this.titleEl = document.getElementById('player-title')
        this.noteEl = document.getElementById('player-note')
        this.listEl = document.getElementById('player-list')

        this.base = `${import.meta.env.BASE_URL}video/`
        this.items = videos
        this.buttons = []
        this.current = -1
        this.onClose = onClose

        this.buildList()

        this.closeButton.addEventListener('click', () => this.onClose())
        this.root.addEventListener('click', (e) =>
        {
            if (e.target === this.root) this.onClose()
        })
        this.video.addEventListener('error', () => this.showFallback())

        this.video.addEventListener('ended', () =>
        {
            if (this.current < this.items.length - 1) this.select(this.current + 1)
        })
    }

    /** Redraws the rail and the caption in the current language. */
    retext()
    {
        this.listEl.innerHTML = ''
        this.buttons = []
        this.buildList()
        this.buttons.forEach((b, i) => b.classList.toggle('active', i === this.current))

        const item = this.items[this.current]
        if (item && this.noteEl) this.noteEl.textContent = t(item.note) ?? ''
    }

    /**
     * The rail of marks under the video.
     *
     * The same shape the television draws on its own screen, for the same
     * reason: the room promises a menu, so the click has to open that menu and
     * not a different one. It was a list down the right-hand side, which read
     * as a playlist and made the set on the wall a poster for something else.
     */
    buildList()
    {
        this.items.forEach((item, index) =>
        {
            const li = document.createElement('li')
            const button = document.createElement('button')
            button.className = 'pl-item'
            button.type = 'button'
            button.title = t(item.note) ?? ''
            button.innerHTML = `
                <span class="pl-mark">${emblemSvg(item.mark, 26)}</span>
                <span class="pl-title"></span>
            `
            button.querySelector('.pl-mark').style.color = item.color ?? 'currentColor'
            button.querySelector('.pl-title').textContent = item.title
            button.addEventListener('click', () => this.select(index))

            li.appendChild(button)
            this.listEl.appendChild(li)
            this.buttons.push(button)
        })
    }

    open(index = 0)
    {
        this.root.classList.remove('hidden')
        this.root.setAttribute('aria-hidden', 'false')
        this.select(index)
        this.closeButton.focus()
    }

    select(index)
    {
        const item = this.items[index]
        if (!item) return

        this.current = index
        this.titleEl.textContent = item.title.toUpperCase()
        if (this.noteEl) this.noteEl.textContent = t(item.note) ?? ''
        this.buttons.forEach((b, i) => b.classList.toggle('active', i === index))

        this.fallback.classList.add('hidden')
        this.video.classList.remove('hidden')
        this.video.src = this.base + item.file

        const played = this.video.play()
        if (played && played.catch) played.catch(() => {})
    }

    showFallback()
    {
        const item = this.items[this.current]
        if (!item) return

        this.video.classList.add('hidden')
        this.fallback.classList.remove('hidden')
        this.buttons[this.current].classList.add('missing')
    }

    close()
    {
        this.root.classList.add('hidden')
        this.root.setAttribute('aria-hidden', 'true')
        this.video.pause()
    }
}
