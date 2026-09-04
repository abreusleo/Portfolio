import Experience from '../Experience.js'
import { isMobile } from '../Utils/device.js'

/**
 * Look around by tilting the phone.
 *
 * It writes the same pointer the mouse writes, which is what makes it small:
 * the per-station parallax scale, the frame-rate-independent smoothing and the
 * rule that none of it applies unless the camera is parked all already exist
 * and all apply here for free. A panel that pulls the camera in close already
 * damps the drift to a fifth, so reading does not shake.
 *
 * Tilt rather than compass. `alpha` is the direction the phone faces, which
 * drifts, wraps at 360 and needs calibration nobody asked for; `beta` and
 * `gamma` are how far it is leaning, which is what "lean to look" means and
 * costs none of that.
 *
 * The neutral is wherever the phone was when permission landed, not zero.
 * People hold a phone at about forty degrees, and a version measuring from
 * zero starts the room pinned to the bottom of its travel.
 */
const NEUTRAL_SAMPLES = 6

/** How far to lean, in degrees, to reach the edge of the look. */
const RANGE = { yaw: 24, pitch: 16 }

const clamp = (value) => Math.max(-1, Math.min(1, value))

export default class Gyro
{
    constructor()
    {
        this.experience = new Experience()
        this.camera = this.experience.camera

        this.supported = isMobile && typeof window.DeviceOrientationEvent !== 'undefined'
        this.active = false
        this.neutral = null
        this.samples = 0
    }

    /**
     * Asked from the tap that enters the room. iOS only grants this from a
     * gesture, and that tap is one the visitor is making anyway — a button of
     * its own would be a second decision before the room, about a thing they
     * have not seen yet.
     *
     * Every failure lands in the same place: the room as it is without this.
     */
    async request()
    {
        if (!this.supported || this.active) return false

        const api = window.DeviceOrientationEvent

        try
        {
            if (typeof api.requestPermission === 'function')
            {
                // iOS. Android has no prompt and answers by simply delivering.
                const answer = await api.requestPermission()
                if (answer !== 'granted') return false
            }
        }
        catch (error)
        {
            // Denied, dismissed, or asked from something iOS did not accept as
            // a gesture. All of them mean the same thing here.
            return false
        }

        window.addEventListener('deviceorientation', (event) => this.read(event))
        this.active = true
        return true
    }

    read(event)
    {
        const { beta, gamma } = event
        if (beta === null || gamma === null) return

        // A phone flat on a table reports nothing useful and a phone being
        // picked up reports the journey, so the rest position is averaged over
        // the first handful of readings rather than taken from one.
        if (this.samples < NEUTRAL_SAMPLES)
        {
            this.samples++
            this.neutral = this.neutral
                ? { beta: (this.neutral.beta + beta) / 2, gamma: (this.neutral.gamma + gamma) / 2 }
                : { beta, gamma }
            return
        }

        this.camera.pointer.set(
            clamp((gamma - this.neutral.gamma) / RANGE.yaw),
            clamp(-(beta - this.neutral.beta) / RANGE.pitch),
        )
    }
}
