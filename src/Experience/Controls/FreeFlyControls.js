import * as THREE from 'three'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'

import EventEmitter from '../Utils/EventEmitter.js'
import Experience from '../Experience.js'
import { isMobile } from '../Utils/device.js'
import { bounds } from '../config/layout.js'

/**
 * "Explore" mode. Desktop: pointer lock + WASD. Mobile: joystick + touch look.
 * Emits 'start' and 'end'. The Camera decides what to do around it.
 */
export default class FreeFlyControls extends EventEmitter
{
    constructor()
    {
        super()

        this.experience = new Experience()
        this.camera = this.experience.camera.instance
        this.canvas = this.experience.canvas
        this.debug = this.experience.debug

        this.active = false
        this.speed = 2.2
        this.move = { forward: false, backward: false, left: false, right: false, up: false, down: false }
        this.velocity = new THREE.Vector3()

        if (isMobile) this.setMobile()
        else this.setDesktop()

        if (this.debug.active)
        {
            this.debug.ui.addFolder('Explore').add(this, 'speed').min(0.5).max(8).step(0.1).name('Fly speed')
        }
    }

    // ------------------------------------------------------------------
    // Desktop
    // ------------------------------------------------------------------
    setDesktop()
    {
        this.pointerLock = new PointerLockControls(this.camera, this.canvas)

        this.pointerLock.addEventListener('lock', () =>
        {
            this.active = true
            this.trigger('start')
        })
        this.pointerLock.addEventListener('unlock', () =>
        {
            this.active = false
            this.resetMove()
            this.trigger('end')
        })

        const setKey = (code, value) =>
        {
            switch (code)
            {
                case 'KeyW': case 'ArrowUp':    this.move.forward = value; break
                case 'KeyS': case 'ArrowDown':  this.move.backward = value; break
                case 'KeyA': case 'ArrowLeft':  this.move.left = value; break
                case 'KeyD': case 'ArrowRight': this.move.right = value; break
                case 'Space':                   this.move.up = value; break
                case 'ShiftLeft': case 'ShiftRight': this.move.down = value; break
            }
        }
        document.addEventListener('keydown', (e) => { if (this.active) setKey(e.code, true) })
        document.addEventListener('keyup', (e) => setKey(e.code, false))
    }

    // ------------------------------------------------------------------
    // Mobile
    // ------------------------------------------------------------------
    setMobile()
    {
        this.look = { yaw: 0, pitch: 0 }
        this.joystick = { x: 0, z: 0 }

        const zone = document.getElementById('joystick-zone')
        const knob = document.getElementById('joystick-knob')
        this.joystickZone = zone

        let joystickTouchId = null
        const center = { x: 0, y: 0 }
        const maxR = 35

        zone.addEventListener('touchstart', (e) =>
        {
            e.preventDefault()
            e.stopPropagation()
            const touch = e.changedTouches[0]
            joystickTouchId = touch.identifier
            const rect = zone.getBoundingClientRect()
            center.x = rect.left + rect.width / 2
            center.y = rect.top + rect.height / 2
        }, { passive: false })

        zone.addEventListener('touchmove', (e) =>
        {
            e.preventDefault()
            e.stopPropagation()
            for (const touch of e.changedTouches)
            {
                if (touch.identifier !== joystickTouchId) continue
                let dx = touch.clientX - center.x
                let dy = touch.clientY - center.y
                const dist = Math.hypot(dx, dy)
                if (dist > maxR)
                {
                    dx = dx / dist * maxR
                    dy = dy / dist * maxR
                }
                knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`
                const norm = Math.min(dist, maxR) / maxR
                this.joystick.x = (dx / maxR) * norm
                this.joystick.z = (dy / maxR) * norm
            }
        }, { passive: false })

        const reset = (e) =>
        {
            for (const touch of e.changedTouches)
            {
                if (touch.identifier !== joystickTouchId) continue
                joystickTouchId = null
                knob.style.transform = 'translate(-50%, -50%)'
                this.joystick.x = 0
                this.joystick.z = 0
            }
        }
        zone.addEventListener('touchend', reset)
        zone.addEventListener('touchcancel', reset)

        // Touch look on the canvas
        let lookTouchId = null
        let lastX = 0
        let lastY = 0

        this.canvas.addEventListener('touchstart', (e) =>
        {
            if (!this.active) return
            for (const touch of e.changedTouches)
            {
                if (lookTouchId !== null) continue
                lookTouchId = touch.identifier
                lastX = touch.clientX
                lastY = touch.clientY
            }
        })

        this.canvas.addEventListener('touchmove', (e) =>
        {
            if (!this.active) return
            e.preventDefault()
            for (const touch of e.changedTouches)
            {
                if (touch.identifier !== lookTouchId) continue
                this.look.yaw -= (touch.clientX - lastX) * 0.004
                this.look.pitch -= (touch.clientY - lastY) * 0.004
                this.look.pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.look.pitch))
                lastX = touch.clientX
                lastY = touch.clientY
            }
        }, { passive: false })

        const endLook = (e) =>
        {
            for (const touch of e.changedTouches)
            {
                if (touch.identifier === lookTouchId) lookTouchId = null
            }
        }
        this.canvas.addEventListener('touchend', endLook)
        this.canvas.addEventListener('touchcancel', endLook)
    }

    // ------------------------------------------------------------------
    // API
    // ------------------------------------------------------------------
    enable()
    {
        if (this.active) return

        if (isMobile)
        {
            this.active = true
            this.joystickZone.style.display = 'block'
            this.camera.rotation.order = 'YXZ'
            this.look.yaw = this.camera.rotation.y
            this.look.pitch = this.camera.rotation.x
            this.trigger('start')
        }
        else
        {
            this.lockPointer()
        }
    }

    /**
     * Raw mouse deltas, where the browser offers them.
     *
     * Without the option Windows runs its pointer acceleration over every
     * movement, so the same hand motion turns the camera by a different amount
     * depending on how fast it was made, and a look that speeds up on its own
     * reads as the camera jumping. The controls only watch for the lock to
     * take effect, so asking for it here instead of through them changes
     * nothing else. A browser that rejects the option gets the plain lock.
     */
    lockPointer()
    {
        const request = this.canvas.requestPointerLock({ unadjustedMovement: true })
        if (request && typeof request.catch === 'function')
        {
            request.catch(() => this.pointerLock.lock())
        }
    }

    disable()
    {
        if (!this.active) return

        if (isMobile)
        {
            this.active = false
            this.joystickZone.style.display = 'none'
            this.joystick.x = 0
            this.joystick.z = 0
            this.trigger('end')
        }
        else
        {
            this.pointerLock.unlock()
        }
    }

    resetMove()
    {
        for (const k in this.move) this.move[k] = false
    }

    update(delta)
    {
        if (!this.active) return

        const step = this.speed * delta

        if (isMobile)
        {
            this.camera.rotation.order = 'YXZ'
            this.camera.rotation.y = this.look.yaw
            this.camera.rotation.x = this.look.pitch

            if (Math.abs(this.joystick.x) > 0.05 || Math.abs(this.joystick.z) > 0.05)
            {
                const forward = new THREE.Vector3()
                this.camera.getWorldDirection(forward)
                forward.y = 0
                forward.normalize()
                const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()
                this.camera.position.addScaledVector(forward, -this.joystick.z * step)
                this.camera.position.addScaledVector(right, this.joystick.x * step)
            }
        }
        else
        {
            this.velocity.set(0, 0, 0)
            if (this.move.forward) this.velocity.z -= step
            if (this.move.backward) this.velocity.z += step
            if (this.move.left) this.velocity.x -= step
            if (this.move.right) this.velocity.x += step
            if (this.move.up) this.velocity.y += step
            if (this.move.down) this.velocity.y -= step

            this.pointerLock.moveForward(-this.velocity.z)
            this.pointerLock.moveRight(this.velocity.x)
            this.camera.position.y += this.velocity.y
        }

        const p = this.camera.position
        p.x = Math.max(bounds.minX, Math.min(bounds.maxX, p.x))
        p.y = Math.max(bounds.minY, Math.min(bounds.maxY, p.y))
        p.z = Math.max(bounds.minZ, Math.min(bounds.maxZ, p.z))
    }
}
