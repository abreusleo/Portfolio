import * as THREE from 'three'
import gsap from 'gsap'

import Experience from './Experience.js'
import stations from './config/stations.js'
import { quality } from './Utils/flags.js'

const _pos = new THREE.Vector3()
const _tgt = new THREE.Vector3()
// A camera-like dummy: cameras look down -Z, plain Object3D looks down +Z
const _dummy = new THREE.PerspectiveCamera()

/**
 * How fast the parked camera follows the pointer, per second.
 *
 * These were per-frame lerp factors, which tied the motion to the frame rate:
 * the same parallax ran four times faster on a 240 Hz monitor than on a 60 Hz
 * one and, worse, sped up and slowed down with every wobble in frame pacing.
 * Pacing on a high-refresh display is never perfectly even, so the camera read
 * as catching. Rates in 1/s give the same motion at any frame rate; the values
 * match what the old factors did at about 144 Hz.
 */
const FOLLOW = { pointer: 3.6, position: 9, scale: 12 }

/**
 * The shape every station in config/stations.js was framed for.
 *
 * three.js measures fov vertically, so a narrower window does not letterbox
 * the same picture — it cuts the sides off. The overview station reads 49
 * degrees, which is 79 across on a 16:9 monitor and 30 across on a phone held
 * upright: less than half the room, with most of what the visitor came to see
 * outside the frame. Eight of the seventeen hotspots simply were not on the
 * screen.
 *
 * So the authored number is treated as a horizontal intent and converted back
 * to whatever vertical angle preserves it. The cap is what keeps that from
 * turning into a fisheye: holding the full width on a tall phone would ask for
 * 108 degrees vertically, and the room bends visibly long before that.
 */
const REFERENCE_ASPECT = 16 / 9
const MAX_FOV = 80

/**
 * Camera with modes:
 *  - 'intro'      : static, waiting for the user to enter
 *  - 'transition' : gsap tween between stations
 *  - 'overview'   : parked on a station with subtle mouse parallax
 *  - 'fly'        : driven by FreeFlyControls
 */
export default class Camera
{
    constructor()
    {
        this.experience = new Experience()
        this.sizes = this.experience.sizes
        this.scene = this.experience.scene
        this.time = this.experience.time
        this.debug = this.experience.debug

        this.mode = 'intro'
        this.station = this.readStationOverride() || stations.overview
        this.travel = null
        this.pointer = new THREE.Vector2()
        this.parallax = new THREE.Vector2()
        this.lookTarget = new THREE.Vector3().fromArray(stations.intro.target)
        this.strength = { position: 0.13, target: 0.26 }

        // Scales the parallax down as the camera gets closer to an object,
        // so a framed shot stays steady instead of drifting.
        this.parallaxScale = 1
        this.parallaxTarget = 1

        this.instance = new THREE.PerspectiveCamera(stations.intro.fov, this.sizes.width / this.sizes.height, 0.1, 60)
        this.instance.fov = this.fovFor(stations.intro.fov)
        this.instance.position.fromArray(stations.intro.position)
        this.instance.lookAt(this.lookTarget)
        this.scene.add(this.instance)

        window.addEventListener('pointermove', (e) =>
        {
            if (e.pointerType === 'touch') return
            this.pointer.set(
                (e.clientX / this.sizes.width - 0.5) * 2,
                -(e.clientY / this.sizes.height - 0.5) * 2,
            )
        })

        window.addEventListener('touchmove', (e) =>
        {
            if (this.mode !== 'overview') return
            const t = e.touches[0]
            this.pointer.set(
                (t.clientX / this.sizes.width - 0.5) * 2,
                -(t.clientY / this.sizes.height - 0.5) * 2,
            )
        }, { passive: true })

        if (this.debug.active)
        {
            const f = this.debug.ui.addFolder('Camera')
            f.add(this.instance, 'fov').min(20).max(100).step(1).onChange(() => this.instance.updateProjectionMatrix())
            f.add(this.strength, 'position').min(0).max(1).step(0.01).name('Parallax pos')
            f.add(this.strength, 'target').min(0).max(2).step(0.01).name('Parallax target')
            f.add(this, 'parallaxTarget').min(0).max(1).step(0.01).name('Parallax scale')
        }
    }

    /** `?cam=x,y,z,tx,ty,tz[,fov]` frames a custom shot. Used for screenshots. */
    readStationOverride()
    {
        const raw = new URLSearchParams(window.location.search).get('cam')
        if (!raw) return null
        const n = raw.split(',').map(Number)
        if (n.length < 6 || n.some(Number.isNaN)) return null
        return { position: n.slice(0, 3), target: n.slice(3, 6), fov: n[6] ?? 45 }
    }

    enter(duration = 2.4)
    {
        return this.goTo(this.station, duration, 'power3.inOut')
    }

    startFly()
    {
        this.mode = 'fly'
    }

    endFly(duration = 1.4)
    {
        return this.goTo(this.station, duration, 'power2.inOut')
    }

    /**
     * Tween position + orientation + fov to a station. Resolves when parked.
     *
     * One travel at a time. A call while another is under way replaces it:
     * two tweens writing the same position every frame fight, and the camera
     * jumped between the two paths for as long as they overlapped, which a
     * second Escape before the first had landed was enough to cause. The
     * interrupted travel never arrives, so its promise stays pending and
     * whatever was waiting to open on arrival never does, which is the point.
     */
    goTo(station, duration = 1.5, ease = 'power2.inOut')
    {
        const cam = this.instance
        this.stopTravel()
        this.mode = 'transition'
        this.parallaxTarget = station.parallax ?? 1

        const startPos = cam.position.clone()
        const startQuat = cam.quaternion.clone()
        const startFov = cam.fov

        const endPos = new THREE.Vector3().fromArray(station.position)
        const target = new THREE.Vector3().fromArray(station.target)
        _dummy.position.copy(endPos)
        _dummy.lookAt(target)
        const endQuat = _dummy.quaternion.clone()
        const endFov = station.fov ? this.fovFor(station.fov) : startFov

        const finish = () =>
        {
            this.station = station
            this.lookTarget.copy(target)
            this.parallax.set(0, 0)
            this.mode = 'overview'
        }

        if (duration <= 0)
        {
            cam.position.copy(endPos)
            cam.quaternion.copy(endQuat)
            cam.fov = endFov
            cam.updateProjectionMatrix()
            finish()
            return Promise.resolve()
        }

        const state = { t: 0 }
        return new Promise((resolve) =>
        {
            this.travel = gsap.to(state, {
                t: 1,
                duration,
                ease,
                onUpdate: () =>
                {
                    cam.position.lerpVectors(startPos, endPos, state.t)
                    cam.quaternion.slerpQuaternions(startQuat, endQuat, state.t)
                    cam.fov = startFov + (endFov - startFov) * state.t
                    cam.updateProjectionMatrix()
                },
                onComplete: () =>
                {
                    this.travel = null
                    finish()
                    resolve()
                },
            })
        })
    }

    /** Abandons the travel under way, leaving the camera wherever it got to. */
    stopTravel()
    {
        if (!this.travel) return
        this.travel.kill()
        this.travel = null
    }

    update()
    {
        // `hold` parks the drift while the visitor is dragging something on a
        // surface. Parallax moves the camera with the pointer, and a camera
        // that moves with the pointer moves the ray the pointer is dragging
        // with, so the thing being dragged slides away from the hand holding
        // it.
        if (this.mode !== 'overview' || this.hold) return

        // Exponential smoothing in time: k is the share of the remaining
        // distance covered this frame, for however long this frame was.
        const dt = Math.min(this.time.delta, 0.1)
        const k = (rate) => 1 - Math.exp(-rate * dt)

        this.parallaxScale += (this.parallaxTarget - this.parallaxScale) * k(FOLLOW.scale)
        this.parallax.lerp(this.pointer, k(FOLLOW.pointer))

        const s = this.station
        const posAmount = this.strength.position * this.parallaxScale
        const tgtAmount = this.strength.target * this.parallaxScale

        _pos.fromArray(s.position)
        _pos.x += this.parallax.x * posAmount
        _pos.y += this.parallax.y * posAmount * 0.5

        _tgt.fromArray(s.target)
        _tgt.x += this.parallax.x * tgtAmount
        _tgt.y += this.parallax.y * tgtAmount * 0.5

        const follow = k(FOLLOW.position)
        this.instance.position.lerp(_pos, follow)
        this.lookTarget.lerp(_tgt, follow)
        this.instance.lookAt(this.lookTarget)
    }

    /**
     * The vertical angle that keeps a station's authored width on this screen.
     * Wider screens than the reference get the number as written.
     */
    fovFor(fov)
    {
        const aspect = this.sizes.width / this.sizes.height
        if (!(aspect > 0) || aspect >= REFERENCE_ASPECT) return fov

        const horizontal = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(fov) / 2) * REFERENCE_ASPECT)
        const vertical = 2 * Math.atan(Math.tan(horizontal / 2) / aspect)

        return Math.min(quality.fovCap ?? MAX_FOV, THREE.MathUtils.radToDeg(vertical))
    }

    resize()
    {
        this.instance.aspect = this.sizes.width / this.sizes.height

        // A rotated phone is a different frame, not just a different size, so
        // the station has to be re-read rather than left at what the last
        // orientation needed.
        if (this.mode !== 'fly' && this.station?.fov) this.instance.fov = this.fovFor(this.station.fov)

        this.instance.updateProjectionMatrix()
    }
}
