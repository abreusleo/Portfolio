import Experience from './Experience.js'
import { VIEWS } from './Camera.js'

/**
 * Two arrows, three ways to face the room.
 *
 * There was a gyro here, turning the room by turning the phone. It went
 * because this is better at the same job: a thumb needs no permission prompt
 * before the room, works with the phone flat on a desk, and points the way it
 * is pressed on every device — which the turn sensor did not, twice.
 *
 * It sets the target and lets the camera's own smoothing carry it, so this
 * moves the room by the same path a window resize does.
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
        this.camera.sweep.yaw = VIEWS[this.at].yaw * Math.PI / 180

        // Disabled rather than hidden at the ends: an arrow that vanishes
        // moves the other one under the thumb that was reaching for it.
        this.prev.disabled = this.at === 0
        this.next.disabled = this.at === VIEWS.length - 1
    }
}
