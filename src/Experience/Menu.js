import Experience from './Experience.js'
import { locale, strings, t } from './config/i18n.js'
import { isMobile } from './Utils/device.js'

/**
 * Every place in the room, as a list.
 *
 * The room asks a visitor to find a small object and hit it, which is most of
 * the difficulty on a phone and some of it anywhere: nothing on screen says
 * the scene is clickable until a cursor is already over something, and a
 * finger has no cursor. The door with the notes is worse than small — at the
 * overview station it sits behind the camera, on a desktop too, so a visitor
 * who never presses F never learns the wall is there.
 *
 * The entries are read from the hotspots the scene registered, never from a
 * list kept here. A hotspot added tomorrow appears without anybody editing
 * this file, for the same reason the printed wall and the panel copy share
 * one config.
 */

/**
 * The order a visitor should meet the room in: what was built, then what it
 * is for, then who built it. Anything not named here still appears, at the
 * end — a new hotspot in an odd position is a smaller failure than one that
 * never shows up at all.
 */
const ORDER = ['prints', 'products', 'tv', 'pc', 'work', 'about', 'notes']

/** Atmosphere rather than portfolio: found by looking, not by being listed. */
const OMIT = new Set(['board'])

export default class Menu
{
    constructor()
    {
        this.experience = new Experience()
        this.interactions = this.experience.interactions

        this.root = document.getElementById('menu')
        this.list = document.getElementById('menu-list')
        this.button = document.getElementById('menu-open')
        this.closeButton = document.getElementById('menu-close')
        if (!this.root || !this.button) return

        this.open = false
        this.expanded = null

        this.button.addEventListener('click', () => this.toggle())
        this.closeButton?.addEventListener('click', () => this.close())

        document.addEventListener('keydown', (e) =>
        {
            if (e.code === 'Escape' && this.open) this.close()
        })

        // Anywhere outside closes it, the canvas included: a tap meant for the
        // room should not be spent dismissing the thing covering it.
        document.addEventListener('pointerdown', (e) =>
        {
            if (!this.open) return
            if (this.root.contains(e.target) || this.button.contains(e.target)) return
            this.close()
        })

        locale.on('change', () => { if (this.open) this.render() })

        this.setModeSwitch()
    }

    /**
     * The answer given at the door, changeable afterwards.
     *
     * Asked once and never asked again, the choice would be a decision the
     * visitor cannot revisit — including the one they got wrong, which is the
     * only one they would want back. This is where somebody already comes to
     * look for the way around the room, so it is where the switch lives.
     *
     * Phone only, because the question is only asked there, and hidden when a
     * query flag is driving the renderer by hand: those exist to be tested
     * against and a button fighting them helps nobody.
     */
    setModeSwitch()
    {
        this.modeRoot = document.getElementById('menu-mode')
        const quality = this.experience.quality
        if (!this.modeRoot || !isMobile || !quality?.auto) return

        this.modeRoot.classList.remove('hidden')
        this.modeButtons = [...this.modeRoot.querySelectorAll('[data-mode]')]

        for (const button of this.modeButtons)
        {
            button.addEventListener('click', () =>
            {
                quality.choose(button.dataset.mode)
                this.markMode()
            })
        }

        this.markMode()
    }

    /** Which one is on, including the case where nobody has said yet. */
    markMode()
    {
        const current = this.experience.quality?.mode
        for (const button of this.modeButtons ?? [])
        {
            button.classList.toggle('active', button.dataset.mode === current)
        }
    }

    toggle()
    {
        if (this.open) this.close()
        else this.show()
    }

    show()
    {
        // Built on opening rather than at startup: the hotspots register when
        // the world finishes building, which is after this class exists.
        this.render()

        this.open = true
        this.root.classList.remove('hidden')
        this.root.setAttribute('aria-hidden', 'false')
        this.button.setAttribute('aria-expanded', 'true')
    }

    close()
    {
        this.open = false
        this.root.classList.add('hidden')
        this.root.setAttribute('aria-hidden', 'true')
        this.button.setAttribute('aria-expanded', 'false')
    }

    /** Top-level hotspots, in the order above, without the repeated ones. */
    entries()
    {
        const all = this.interactions?.hotspots ?? []
        const tops = all.filter((hotspot) => !hotspot.group && !OMIT.has(hotspot.id))

        // The tower and the screen are one place with two ways in, and a list
        // offering "PC" twice reads as a bug rather than as generosity.
        const seen = new Set()
        const unique = tops.filter((hotspot) =>
        {
            const key = t(hotspot.label) || hotspot.id
            if (seen.has(key)) return false
            seen.add(key)
            return true
        })

        const rank = (id) =>
        {
            const index = ORDER.indexOf(id)
            return index < 0 ? ORDER.length : index
        }

        return unique.sort((a, b) => rank(a.id) - rank(b.id))
    }

    childrenOf(id)
    {
        return (this.interactions?.hotspots ?? []).filter((hotspot) => hotspot.group === id)
    }

    render()
    {
        this.list.innerHTML = ''

        for (const hotspot of this.entries())
        {
            const children = hotspot.kind === 'group' ? this.childrenOf(hotspot.id) : []
            this.list.append(this.row(hotspot, children))
        }
    }

    row(hotspot, children)
    {
        const item = document.createElement('li')
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'menu-item'
        button.append(document.createTextNode(t(hotspot.label) || hotspot.id))

        if (children.length === 0)
        {
            button.addEventListener('click', () => this.go(hotspot))
            item.append(button)
            return item
        }

        const chevron = document.createElement('span')
        chevron.className = 'chev'
        chevron.textContent = '›'
        chevron.setAttribute('aria-hidden', 'true')
        button.append(chevron)

        const sub = document.createElement('ul')
        sub.className = 'menu-sub'
        sub.hidden = this.expanded !== hotspot.id
        button.setAttribute('aria-expanded', String(!sub.hidden))

        // The group's own panel is the first entry in the sublist rather than
        // the header doing two jobs. A header that both expands and navigates
        // is a coin toss every time somebody presses it.
        for (const child of [hotspot, ...children])
        {
            const line = document.createElement('li')
            const pick = document.createElement('button')
            pick.type = 'button'
            pick.className = 'menu-item'
            pick.textContent = child === hotspot
                ? (t(strings.menuAll) || 'ver todos')
                : (t(child.label) || child.id)
            pick.addEventListener('click', () => this.go(child))
            line.append(pick)
            sub.append(line)
        }

        button.addEventListener('click', () =>
        {
            this.expanded = sub.hidden ? hotspot.id : null
            this.render()
        })

        item.append(button, sub)
        return item
    }

    go(hotspot)
    {
        this.close()
        this.interactions.open(hotspot)
    }
}
