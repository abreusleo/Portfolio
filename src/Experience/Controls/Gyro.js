import Experience from '../Experience.js'
import { isMobile } from '../Utils/device.js'
import { quality } from '../Utils/flags.js'
import { VIEWS } from '../Camera.js'

/**
 * Look around by tilting the phone.
 *
 * It writes the same pointer the mouse writes, which is what makes it small:
 * the per-station parallax scale, the frame-rate-independent smoothing and the
 * rule that none of it applies unless the camera is parked all already exist
 * and all apply here for free. A panel that pulls the camera in close already
 * damps the drift to a fifth, so reading does not shake.
 *
 * Turning, and only turning. Reaching the door behind you and the TV beside
 * you is most of a half turn, and no amount of leaning can mean that without
 * becoming unusably twitchy — so the yaw comes from `alpha`, which is where
 * the phone is pointing, and turning your body turns the room by the same
 * amount.
 *
 * There is no vertical axis. A room seen from a seat is a horizontal thing:
 * the floor and the ceiling hold nothing worth turning towards, and an axis
 * that answers every wobble of a hand is an axis that never sits still.
 *
 * `alpha` costs what it always costs: it wraps at 360, so the difference from
 * the neutral is taken the short way round, and it drifts over minutes, which
 * a room nobody stands in for minutes can afford.
 *
 * The neutral is wherever the phone was when permission landed, not zero.
 * People hold a phone at about forty degrees, and a version measuring from
 * zero starts the room pinned to the bottom of its travel.
 */
const NEUTRAL_SAMPLES = 6

/** The ends are the two outer views: turn to the door, or to the TV. */
const LIMIT = {
    min: Math.min(...VIEWS.map((v) => v.yaw)),
    max: Math.max(...VIEWS.map((v) => v.yaw)),
}

const DEG = Math.PI / 180

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
        const { alpha } = event
        if (alpha === null || alpha === undefined) return

        // A phone flat on a table reports nothing useful and a phone being
        // picked up reports the journey, so the rest position is averaged over
        // the first handful of readings rather than taken from one.
        if (this.samples < NEUTRAL_SAMPLES)
        {
            this.samples++
            this.neutral = this.neutral
                ? { alpha: this.turn(alpha, this.neutral.alpha) / 2 + this.neutral.alpha }
                : { alpha }
            return
        }

        // Flipped by default: on a phone, turning one way sent the room the
        // other. The clamp is applied to the angle the camera will actually
        // take, after that flip, so the ends stay the door and the TV however
        // the reading arrives.
        this.last = alpha

        const turned = this.turn(alpha, this.neutral.alpha) * this.sign

        this.camera.sweep.yaw = Math.max(LIMIT.min, Math.min(LIMIT.max, turned)) * DEG
    }

    get sign()
    {
        return quality.gyroFlipped ? 1 : -1
    }

    /**
     * Makes wherever the phone is pointing right now mean `yaw`.
     *
     * The arrows and this control the same angle, and without it the one the
     * visitor pressed would be overwritten by the next reading, half a frame
     * later — a button that visibly does nothing. Re-anchoring instead means
     * the view they chose becomes the rest position and turning still works
     * from there, inside the same limits.
     */
    anchorTo(yaw)
    {
        if (!this.active || this.last === undefined) return

        this.neutral = { alpha: (this.last - yaw / this.sign + 360) % 360 }
        this.samples = NEUTRAL_SAMPLES
    }

    /** Degrees from `to` to `from`, the short way round the circle. */
    turn(from, to)
    {
        return ((from - to + 540) % 360) - 180
    }
}
