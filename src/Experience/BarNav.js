import Experience from './Experience.js'
import { ORDER, OMIT } from './Menu.js'
import { locale, strings, t } from './config/i18n.js'

/**
 * The places in the room, named across the top bar.
 *
 * The bar used to hold an identity, a button that opened a list, two switches
 * and a number — four things, three of them rarely touched, spread across a
 * strip wide enough for a navigation that was not there. So the list comes out
 * of the button and into the bar: the places are the navigation, the way a
 * studio site names its sections.
 *
 * It replaces the button rather than joining it. Two ways to reach the same
 * seven destinations, a hand apart, is a choice nobody asked to make.
 *
 * A GROUP CARRIES ITS COUNT, and only a group. The printed wall holds six
 * things and the shelf holds two, and saying so is the difference between a
 * label and a promise about what is behind it. The rest are single places and
 * a "(1)" after each would be noise dressed as information.
 *
 * Read from the hotspots the scene registered, in the same order the menu uses
 * and with the same omission, because they are one list shown two ways and the
 * day they diverge is the day one of them is wrong.
 */
/**
 * A short name for each place, for the bar and nowhere else.
 *
 * A row of seven names has to be read in one pass, and the full labels are
 * written to be read one at a time in a list. The panels keep the long form,
 * which is where the room explains what a place is.
 */
const SHORT = {
    prints: 'navPrints',
    products: 'navProducts',
    tv: 'navTv',
    pc: 'navPc',
    work: 'navWork',
    about: 'navAbout',
    notes: 'navNotes',
}

export default class BarNav
{
    constructor()
    {
        this.experience = new Experience()
        this.interactions = this.experience.interactions

        this.root = document.getElementById('bar-nav')
        if (!this.root) return

        // The hotspots register when the world finishes building, which is
        // after this exists. Filling the bar now would fill it with nothing —
        // which is exactly why the menu builds its list on opening.
        if (this.experience.world.ready) this.render()
        else this.experience.world.on('ready', () => this.render())

        locale.on('change', () => this.render())
    }

    render()
    {
        this.root.innerHTML = ''

        for (const hotspot of this.places())
        {
            const button = document.createElement('button')
            button.type = 'button'
            button.className = 'bar-link'
            const short = strings[SHORT[hotspot.id]]
            button.append(document.createTextNode(t(short ?? hotspot.label) || hotspot.id))

            const children = hotspot.kind === 'group'
                ? this.interactions.hotspots.filter((h) => h.group === hotspot.id).length
                : 0

            if (children > 0)
            {
                const count = document.createElement('sup')
                count.textContent = `(${children})`
                button.append(count)
            }

            button.addEventListener('click', () => this.interactions.open(hotspot))
            this.root.append(button)
        }
    }

    /** The menu's list, by the menu's rules. */
    places()
    {
        const all = this.interactions?.hotspots ?? []
        const seen = new Set()

        return all
            .filter((hotspot) =>
            {
                if (hotspot.group || OMIT.has(hotspot.id)) return false

                // The tower and the screen are one place with two ways in.
                const key = t(hotspot.label) || hotspot.id
                if (seen.has(key)) return false
                seen.add(key)
                return true
            })
            .sort((a, b) =>
            {
                const rank = (id) => (ORDER.indexOf(id) < 0 ? ORDER.length : ORDER.indexOf(id))
                return rank(a.id) - rank(b.id)
            })
    }
}
