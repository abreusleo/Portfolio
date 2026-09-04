import * as THREE from 'three'

import apps from '../config/desktop.js'
import { EMBLEMS, drawEmblem } from '../config/emblems.js'
import windowsMark from '../../assets/icons/windows.png'

/**
 * The machine's desktop, painted on one canvas.
 *
 * This is the screen at rest: the wallpaper, the three icons and a clock that
 * tells the truth. It is the texture on the curved monitor, and it is what the
 * room promises the machine will do before anybody clicks it.
 *
 * What the click opens is not this canvas any more. It used to be, literally:
 * the overlay mounted this very element, which is why the two could never
 * disagree. A desktop you can actually use needs hover, scrolling, dragging
 * and selectable text, and none of those exist inside a canvas without being
 * written by hand, pixel by pixel. So the overlay is a real document now, and
 * what keeps the two honest instead is that both are built from the same
 * config: same three apps, same order, same marks, same accents, same bar
 * along the bottom.
 *
 * An icon here is whatever config/desktop.js says it is: a real logo where the
 * project has the file, and a shared emblem drawn from ops where it does not.
 * The overlay reads the same field, so neither surface can end up showing a
 * different picture from the other.
 */
const W = 1920
const H = 800
const BAR = 64

export default class DesktopScreen
{
    constructor()
    {
        this.canvas = document.createElement('canvas')
        this.canvas.width = W
        this.canvas.height = H
        this.ctx = this.canvas.getContext('2d')

        this.texture = new THREE.CanvasTexture(this.canvas)
        this.texture.colorSpace = THREE.SRGBColorSpace
        this.texture.anisotropy = 8

        this.mark = null
        this.logos = new Map()
        this.minute = -1

        this.loadMark()
        this.loadLogos()
        this.draw()
    }

    /** The one image left: the start button on the bar. */
    loadMark()
    {
        const image = new Image()
        image.decoding = 'async'
        image.addEventListener('load', () => { this.mark = image; this.draw() })
        image.addEventListener('error', () =>
        {
            console.warn(`[desktop] a marca da barra não carregou (${windowsMark})`)
        })
        image.src = windowsMark
    }

    /**
     * The apps whose icon is a real logo rather than a drawn mark.
     *
     * These are bundler imports, never paths into static/. An image whose
     * intrinsic size canvas cannot read draws nothing and reports nothing,
     * which is how this screen once came up with five blank squares.
     */
    loadLogos()
    {
        for (const app of apps)
        {
            if (!app.file) continue

            const image = new Image()
            image.decoding = 'async'
            image.addEventListener('load', () => { this.logos.set(app.id, image); this.draw() })
            image.addEventListener('error', () =>
            {
                console.warn(`[desktop] o logo de ${app.name} não carregou (${app.file})`)
            })
            image.src = app.file
        }
    }

    /** Called every frame; only repaints when the minute changes. */
    update()
    {
        const minute = new Date().getMinutes()
        if (minute === this.minute) return
        this.draw()
    }

    // ------------------------------------------------------------------
    draw()
    {
        const ctx = this.ctx
        this.minute = new Date().getMinutes()

        this.drawWallpaper(ctx)
        this.drawIcons(ctx)
        this.drawTaskbar(ctx)

        this.texture.needsUpdate = true
    }

    drawWallpaper(ctx)
    {
        const sky = ctx.createLinearGradient(0, 0, W * 0.6, H)
        sky.addColorStop(0, '#0a1024')
        sky.addColorStop(0.45, '#141a3c')
        sky.addColorStop(1, '#0b1526')
        ctx.fillStyle = sky
        ctx.fillRect(0, 0, W, H)

        const glow = ctx.createRadialGradient(W * 0.74, H * 0.18, 0, W * 0.74, H * 0.18, W * 0.55)
        glow.addColorStop(0, 'rgba(90, 120, 220, 0.34)')
        glow.addColorStop(0.5, 'rgba(70, 60, 160, 0.14)')
        glow.addColorStop(1, 'rgba(0, 0, 0, 0)')
        ctx.fillStyle = glow
        ctx.fillRect(0, 0, W, H)

        // Soft diagonal bands, the kind a stock wallpaper has
        ctx.save()
        ctx.globalCompositeOperation = 'lighter'
        for (let i = 0; i < 5; i++)
        {
            const band = ctx.createLinearGradient(0, 0, W, H)
            band.addColorStop(0, 'rgba(255, 255, 255, 0)')
            band.addColorStop(0.5, `rgba(140, 170, 255, ${0.018 + i * 0.006})`)
            band.addColorStop(1, 'rgba(255, 255, 255, 0)')
            ctx.fillStyle = band
            ctx.beginPath()
            ctx.moveTo(W * (0.1 + i * 0.17), H)
            ctx.lineTo(W * (0.3 + i * 0.17), H)
            ctx.lineTo(W * (0.72 + i * 0.17), 0)
            ctx.lineTo(W * (0.52 + i * 0.17), 0)
            ctx.closePath()
            ctx.fill()
        }
        ctx.restore()

        // Vignette so the icons keep their contrast
        const vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.72)
        vignette.addColorStop(0, 'rgba(0, 0, 0, 0)')
        vignette.addColorStop(1, 'rgba(0, 0, 0, 0.5)')
        ctx.fillStyle = vignette
        ctx.fillRect(0, 0, W, H)
    }

    drawIcons(ctx)
    {
        const size = 96
        const step = 150
        const x = 74
        let y = 44

        for (const app of apps)
        {
            // The tile behind the mark, so an icon reads as a thing you press
            ctx.save()
            ctx.beginPath()
            if (ctx.roundRect) ctx.roundRect(x, y, size, size, 20)
            else ctx.rect(x, y, size, size)
            ctx.fillStyle = 'rgba(12, 16, 26, 0.66)'
            ctx.fill()
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
            ctx.lineWidth = 2
            ctx.stroke()
            ctx.restore()

            const logo = this.logos.get(app.id)
            if (logo && logo.width)
            {
                const box = size * 0.58
                const ratio = Math.min(box / logo.width, box / logo.height)
                const w = logo.width * ratio
                const h = logo.height * ratio
                ctx.drawImage(logo, x + (size - w) / 2, y + (size - h) / 2, w, h)
            }
            else drawEmblem(ctx, EMBLEMS[app.mark], x + size / 2, y + size / 2, size * 0.56, app.accent)

            ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
            ctx.font = '500 21px "JetBrains Mono", monospace'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'top'
            ctx.shadowColor = 'rgba(0, 0, 0, 0.9)'
            ctx.shadowBlur = 7
            ctx.fillText(String(app.name), x + size / 2, y + size + 11)
            ctx.shadowBlur = 0

            y += step
        }
    }

    drawTaskbar(ctx)
    {
        const top = H - BAR

        ctx.fillStyle = 'rgba(10, 13, 20, 0.86)'
        ctx.fillRect(0, top, W, BAR)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'
        ctx.fillRect(0, top, W, 1)

        const sx = 42
        const sy = top + BAR / 2
        if (this.mark && this.mark.width)
        {
            const size = 26
            ctx.drawImage(this.mark, sx - size / 2, sy - size / 2, size, size)
        }

        // Tray
        const now = new Date()
        const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        const date = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

        ctx.textAlign = 'right'
        ctx.textBaseline = 'alphabetic'
        ctx.fillStyle = '#e6eaf2'
        ctx.font = '500 25px "JetBrains Mono", monospace'
        ctx.fillText(time, W - 38, sy - 2)
        ctx.fillStyle = 'rgba(230, 234, 242, 0.62)'
        ctx.font = '400 18px "JetBrains Mono", monospace'
        ctx.fillText(date, W - 38, sy + 20)
    }
}
