import { locale } from './config/i18n.js'

/**
 * The language, as two flags in the corner of the bar.
 *
 * It used to be PT and EN sitting side by side, always both, which spends a
 * permanent slot in the bar on a choice almost nobody makes twice. A closed
 * control shows the one that is on and opens to show the other.
 *
 * A flag is not a language — Portuguese is not Brazil and English is not the
 * United States — so every one of these carries a written name that a screen
 * reader announces and a pointer reveals. What is dropped is the label on
 * screen, not the label.
 *
 * Drawn rather than typed. The obvious way to put a flag on a page is the
 * emoji, and on Windows there is no flag glyph in the system font: a browser
 * there renders the pair of regional indicators as the two letters "BR". A
 * small inline SVG is the same size on every machine.
 */
export default class LangPicker
{
    constructor()
    {
        this.root = document.getElementById('lang-picker')
        this.button = document.getElementById('lang-open')
        this.menu = document.getElementById('lang-menu')
        if (!this.root || !this.button) return

        this.open = false

        this.button.addEventListener('click', (e) =>
        {
            e.stopPropagation()
            this.toggle()
        })

        // Picking one closes it. The click that changes the language is
        // handled where every other language button is, in UI.setLanguage.
        for (const option of this.menu.querySelectorAll('[data-lang]'))
        {
            option.addEventListener('click', () => this.close())
        }

        document.addEventListener('pointerdown', (e) =>
        {
            if (this.open && !this.root.contains(e.target)) this.close()
        })

        document.addEventListener('keydown', (e) =>
        {
            if (e.code === 'Escape' && this.open) this.close()
        })

        locale.on('change', () => this.mark())
        this.mark()
    }

    toggle()
    {
        if (this.open) this.close()
        else this.show()
    }

    show()
    {
        this.open = true
        this.menu.hidden = false
        this.button.setAttribute('aria-expanded', 'true')
    }

    close()
    {
        this.open = false
        this.menu.hidden = true
        this.button.setAttribute('aria-expanded', 'false')
    }

    /** The closed control shows the flag that is on. */
    mark()
    {
        for (const flag of this.button.querySelectorAll('[data-flag]'))
        {
            flag.hidden = flag.dataset.flag !== locale.current
        }
    }
}
