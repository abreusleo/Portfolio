import Experience from './Experience.js'
import { VIEWS } from './Camera.js'

/**
 * Two arrows, three ways to face the room.
 *
 * The gyro turns the room by turning the phone, which is the better gesture
 * when it works and is worth nothing when the visitor declines the permission,
 * holds the phone flat, or is on a device that reports the turn backwards.
 * This is the same three positions with a thumb: predictable, no permission,
 * no sensor, and the same angles — VIEWS is where both read them.
 *
 * It sets the target and lets the camera's own smoothing carry it, so the
 * arrows and the gyro move the room by exactly the same path.
 */
export default class Views
{
    constructor()
    {
        this.experience = new Experience()
        this.camera = this.experience.camera

        this.prev = document.getElementById('view-prev')
        this.next = document.getElementById('view-next')
        if (!this.prev || !this.next) return

        // Starts on the middle one, which is how the station was framed.
        this.at = VIEWS.findIndex((v) => v.yaw === 0)
        if (this.at < 0) this.at = 0

        this.prev.addEventListener('click', () => this.step(-1))
        this.next.addEventListener('click', () => this.step(1))
        this.apply()
    }

    step(by)
    {
        const to = this.at + by
        if (to < 0 || to >= VIEWS.length) return

        this.at = to
        this.apply()
    }

    apply()
    {
        const yaw = VIEWS[this.at].yaw
        this.camera.sweep.yaw = yaw * Math.PI / 180

        // The gyro writes the same angle every reading. Without this the view
        // just chosen would be gone before the next frame drew it.
        this.experience.gyro?.anchorTo(yaw)

        // Disabled rather than hidden at the ends: an arrow that vanishes
        // moves the other one under the thumb that was reaching for it.
        this.prev.disabled = this.at === 0
        this.next.disabled = this.at === VIEWS.length - 1
    }
}
