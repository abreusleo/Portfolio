import apps from './config/desktop.js'
import { emblemSvg } from './config/emblems.js'
import { films, games, songs, STEAM_ART } from './config/library.js'
import { locale, strings, t } from './config/i18n.js'
import { isMobile } from './Utils/device.js'

/**
 * The machine, once somebody has sat down at it.
 *
 * The monitor in the room paints this same desktop onto a canvas; see
 * World/DesktopScreen.js for why the two are separate now and what keeps them
 * honest. Everything visible here is built from the same three-app config the
 * canvas reads, so the icons, their order, their marks and their colours
 * cannot drift apart.
 *
 * Windows are deliberately not an operating system. They drag by the title
 * bar, they come to the front when touched, and there are three of them at
 * most because there are three apps. No resizing, no minimising, no snapping:
 * every one of those is a week of edge cases in exchange for a joke that has
 * already landed by the second window.
 *
 * On a phone none of that happens at all. Dragging a floating window around a
 * letterboxed ultrawide with a thumb is bad in every direction, so a window
 * there fills the screen and only one is open at a time.
 */
export default class Desktop
{
    constructor(root)
    {
        this.root = root
        this.windows = new Map()
        this.top = 10

        this.build()

        locale.on('change', () => this.retext())
    }

    build()
    {
        this.root.classList.add('dsk')
        this.root.innerHTML = `
            <div class="dsk-icons"></div>
            <div class="dsk-windows"></div>
            <div class="dsk-bar">
                <span class="dsk-start">${startMark()}</span>
                <div class="dsk-open"></div>
                <div class="dsk-clock"><span class="dsk-time"></span><span class="dsk-date"></span></div>
            </div>
        `

        this.iconsEl = this.root.querySelector('.dsk-icons')
        this.windowsEl = this.root.querySelector('.dsk-windows')
        this.openEl = this.root.querySelector('.dsk-open')
        this.timeEl = this.root.querySelector('.dsk-time')
        this.dateEl = this.root.querySelector('.dsk-date')

        for (const app of apps)
        {
            const button = document.createElement('button')
            button.type = 'button'
            button.className = 'dsk-icon'
            button.style.setProperty('--app', app.accent)
            button.innerHTML = `
                <span class="dsk-mark">${icon(app, 40)}</span>
                <span class="dsk-name">${t(app.name)}</span>
            `
            button.addEventListener('click', () => this.open(app))
            this.iconsEl.appendChild(button)
        }

        this.tick()
    }

    /** The clock, driven by whoever owns the frame loop. */
    tick()
    {
        const now = new Date()
        this.timeEl.textContent = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        this.dateEl.textContent = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    }

    /**
     * The note the desktop opens with.
     *
     * Three icons and no words is a room with no way in: a visitor sees marks
     * and has to guess that pressing them does anything. This says what the
     * machine is for in two lines and then gets out of the way.
     *
     * It comes back every time the machine is opened, unless it was closed by
     * hand. Somebody who has read it and shut it has said so.
     */
    showIntro()
    {
        if (this.introDismissed) return
        this.open(README)
    }

    // ------------------------------------------------------------------
    open(app)
    {
        const existing = this.windows.get(app.id)
        if (existing)
        {
            this.focus(existing)
            return
        }

        // One at a time on a phone: two overlapping windows on a small screen
        // is two windows you cannot read.
        if (isMobile) this.closeAll()

        const win = document.createElement('section')
        win.className = 'dsk-win'
        win.style.setProperty('--app', app.accent)
        win.innerHTML = `
            <header class="dsk-win-bar">
                <span class="dsk-win-mark">${icon(app, 16)}</span>
                <span class="dsk-win-title"></span>
                <button type="button" class="dsk-win-close" aria-label="${t(strings.close)}">×</button>
            </header>
            <div class="dsk-win-body"></div>
        `

        win.querySelector('.dsk-win-title').textContent = app.window.title
            ? `${t(app.name)} — ${t(app.window.title)}`
            : t(app.name)
        win.querySelector('.dsk-win-close').addEventListener('click', () => this.close(app.id))
        win.querySelector('.dsk-win-body').append(this.body(app.window.kind))

        // Cascaded, starting clear of the icon column on the left: a window
        // that opens on top of the icons hides the very things it is telling
        // the visitor to press.
        const step = this.windows.size
        win.style.left = `${11 + step * 7}%`
        win.style.top = `${14 + step * 30}px`

        this.windowsEl.appendChild(win)
        this.windows.set(app.id, win)
        win.dataset.app = app.id

        this.drag(win)
        win.addEventListener('pointerdown', () => this.focus(win))
        this.focus(win)
        this.renderBar()
    }

    close(id)
    {
        const win = this.windows.get(id)
        if (!win) return

        // Only a deliberate close counts. Shutting the machine closes
        // everything, and that is not the visitor dismissing the note.
        if (id === README.id && !this.closingAll) this.introDismissed = true

        win.remove()
        this.windows.delete(id)
        this.renderBar()
    }

    closeAll()
    {
        this.closingAll = true
        for (const id of [...this.windows.keys()]) this.close(id)
        this.closingAll = false
    }

    /** True when it actually closed something, so Escape can fall through. */
    closeTop()
    {
        let top = null
        for (const win of this.windows.values())
        {
            if (!top || Number(win.style.zIndex) > Number(top.style.zIndex)) top = win
        }
        if (!top) return false

        this.close(top.dataset.app)
        return true
    }

    focus(win)
    {
        this.top += 1
        win.style.zIndex = this.top
        this.renderBar()
    }

    /** The bar along the bottom lists what is open, and gets you back to it. */
    renderBar()
    {
        this.openEl.innerHTML = ''

        for (const [id, win] of this.windows)
        {
            const app = id === README.id ? README : apps.find((a) => a.id === id)
            if (!app) continue

            const button = document.createElement('button')
            button.type = 'button'
            button.className = 'dsk-task'
            button.style.setProperty('--app', app.accent)
            button.innerHTML = `${icon(app, 14)}<span>${t(app.name)}</span>`
            button.addEventListener('click', () => this.focus(win))
            this.openEl.appendChild(button)
        }
    }

    // ------------------------------------------------------------------
    /**
     * Dragging, by the title bar only.
     *
     * The window is held so that its bar can never leave the desktop. Letting
     * it go is not a small bug: the bar is the only handle and the only close
     * button, so a window dropped past the edge is gone for the rest of the
     * visit.
     */
    drag(win)
    {
        if (isMobile) return

        const bar = win.querySelector('.dsk-win-bar')
        let from = null

        bar.addEventListener('pointerdown', (e) =>
        {
            if (e.target.closest('.dsk-win-close')) return

            const box = win.getBoundingClientRect()
            const stage = this.root.getBoundingClientRect()
            from = { x: e.clientX, y: e.clientY, left: box.left - stage.left, top: box.top - stage.top }
            bar.setPointerCapture(e.pointerId)
            win.classList.add('dragging')
        })

        bar.addEventListener('pointermove', (e) =>
        {
            if (!from) return

            const stage = this.root.getBoundingClientRect()
            const box = win.getBoundingClientRect()
            const left = from.left + (e.clientX - from.x)
            const top = from.top + (e.clientY - from.y)

            win.style.left = `${Math.max(24 - box.width, Math.min(stage.width - 24, left))}px`
            win.style.top = `${Math.max(0, Math.min(stage.height - 34, top))}px`
        })

        const drop = (e) =>
        {
            if (!from) return
            from = null
            bar.releasePointerCapture?.(e.pointerId)
            win.classList.remove('dragging')
        }
        bar.addEventListener('pointerup', drop)
        bar.addEventListener('pointercancel', drop)
    }

    // ------------------------------------------------------------------
    body(kind)
    {
        if (kind === 'intro') return this.introText()
        if (kind === 'songs') return this.songList()
        if (kind === 'films') return this.grid(films, 'films')
        return this.grid(games, 'games')
    }

    /**
     * A wall of covers.
     *
     * Every one of them can fail: Valve's CDN can answer 404 for a game whose
     * art moved, and a poster is a file somebody still has to add. A hole in a
     * grid reads as broken, so what a missing image leaves behind is a card
     * with the title on it, which reads as art that has not turned up yet.
     */
    grid(items, kind)
    {
        const list = document.createElement('div')
        list.className = 'dsk-grid'

        if (!items.length)
        {
            list.append(this.empty())
            return list
        }

        for (const item of items)
        {
            const cell = document.createElement('figure')
            cell.className = 'dsk-cover'

            const src = kind === 'games'
                ? (item.cover ? poster(item.cover) : (item.appid ? STEAM_ART(item.appid) : null))
                : (item.poster ? poster(item.poster) : null)

            if (src)
            {
                const img = document.createElement('img')
                img.loading = 'lazy'
                img.alt = t(item.title)
                img.addEventListener('error', () => cell.classList.add('missing'))
                img.src = src
                cell.appendChild(img)
            }
            else cell.classList.add('missing')

            const caption = document.createElement('figcaption')
            caption.textContent = t(item.title)
            cell.appendChild(caption)

            if (kind === 'films' && item.year)
            {
                const meta = document.createElement('span')
                meta.className = 'dsk-cover-meta'
                meta.textContent = `${item.year} · ${t(item.kind === 'series' ? strings.deskSeries : strings.deskFilm)}`
                cell.appendChild(meta)
            }

            list.appendChild(cell)
        }

        return list
    }

    introText()
    {
        const box = document.createElement('div')
        box.className = 'dsk-note'

        for (const line of t(strings.deskIntro) ?? [])
        {
            const p = document.createElement('p')
            p.textContent = line
            box.appendChild(p)
        }

        return box
    }

    songList()
    {
        if (!songs.length) return this.empty()

        const list = document.createElement('ol')
        list.className = 'dsk-songs'

        songs.forEach((song, index) =>
        {
            const row = document.createElement('li')
            row.innerHTML = `
                <span class="dsk-song-n">${String(index + 1).padStart(2, '0')}</span>
                <span class="dsk-song-title"></span>
                <span class="dsk-song-artist"></span>
            `
            row.querySelector('.dsk-song-title').textContent = song.title
            row.querySelector('.dsk-song-artist').textContent = song.artist
            list.appendChild(row)
        })

        return list
    }

    empty()
    {
        const p = document.createElement('p')
        p.className = 'dsk-empty'
        p.textContent = t(strings.deskEmpty)
        return p
    }

    /** Rebuilds whatever is open in the other language. */
    retext()
    {
        const open = [...this.windows.keys()]
        this.closeAll()
        for (const id of open)
        {
            const app = id === README.id ? README : apps.find((a) => a.id === id)
            if (app) this.open(app)
        }
    }
}

/** The note is a window like the others, just not an app with an icon. */
const README = {
    id: 'readme',
    name: strings.deskReadme,
    mark: 'txt',
    accent: '#cfd6e4',
    window: { title: null, kind: 'intro' },
}

const poster = (file) => `${import.meta.env.BASE_URL}posters/${file}`

/**
 * A real logo when there is one, the drawn mark when there is not.
 *
 * The size is written into the element rather than left to a stylesheet. It
 * was a percentage of the parent, which works in the icon column and does not
 * work anywhere else: a title bar has no fixed height, a percentage against an
 * auto height resolves to auto, and the browser falls back to the file's own
 * dimensions. A 512 pixel logo then appeared in a 41 pixel bar and pushed the
 * entire game library out of the window.
 */
function icon(app, size)
{
    if (!app.file) return emblemSvg(app.mark, size)

    return `<img class="dsk-logo" src="${app.file}" alt=""
        width="${size}" height="${size}" style="width:${size}px;height:${size}px">`
}

/** The four squares on the start button, drawn rather than fetched. */
function startMark()
{
    return `<svg viewBox="0 0 12 12" width="14" height="14" aria-hidden="true" fill="currentColor">
        <rect x="0" y="0" width="5" height="5"/><rect x="7" y="0" width="5" height="5"/>
        <rect x="0" y="7" width="5" height="5"/><rect x="7" y="7" width="5" height="5"/>
    </svg>`
}
