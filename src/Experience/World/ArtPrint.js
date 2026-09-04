import * as THREE from 'three'
import { EMBLEMS, drawEmblem } from '../config/emblems.js'
import { t } from '../config/i18n.js'

/**
 * Art for the framed prints.
 *
 * A print backed by a project reuses the Hub portal's own emblem for that
 * tool, drawn from the same 44 unit viewBox and the same tile colour, over
 * the Hub's dark ground. The wall and the portal therefore show one identity.
 * Prints without a project fall back to abstract plates.
 */

// The Hub's own palette (hub-web/templates/portal.html)
const GROUND = '#0b0e13'
const SURFACE = '#12161d'
const RULE = '#262d38'
const TEXT = '#e7eaf0'

function mulberry32(seed)
{
    let a = seed >>> 0
    return function ()
    {
        a += 0x6D2B79F5
        let t = a
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

function canvas(w, h)
{
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    return [c, c.getContext('2d')]
}

function grain(size, rand)
{
    const [c, ctx] = canvas(size, size)
    const image = ctx.createImageData(size, size)
    const d = image.data
    for (let i = 0; i < d.length; i += 4)
    {
        const v = 128 + (rand() - 0.5) * 128
        d[i] = d[i + 1] = d[i + 2] = v
        d[i + 3] = 255
    }
    ctx.putImageData(image, 0, 0)
    return c
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight)
{
    let line = ''
    let cursor = y
    for (const word of text.split(' '))
    {
        const attempt = line ? line + ' ' + word : word
        if (ctx.measureText(attempt).width > maxWidth && line)
        {
            ctx.fillText(line, x, cursor)
            line = word
            cursor += lineHeight
        }
        else line = attempt
    }
    if (line) ctx.fillText(line, x, cursor)
}

// ---------------------------------------------------------------------
export function makeArtPrint({ index = 1, accent = '#ff8a3d', app = null, w = 620, h = 860, seed = 31 } = {})
{
    const rand = mulberry32(seed + index * 7919)
    const [c, ctx] = canvas(w, h)

    if (app) drawProjectPlate(ctx, w, h, app)
    else drawAbstractPlate(ctx, w, h, index, accent, rand)

    ctx.globalCompositeOperation = app ? 'overlay' : 'multiply'
    ctx.globalAlpha = app ? 0.06 : 0.13
    ctx.drawImage(grain(220, rand), 0, 0, w, h)
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'

    const texture = new THREE.CanvasTexture(c)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
}

/** The Hub's tile, printed: dark ground, its emblem, its name. */
function drawProjectPlate(ctx, w, h, app)
{
    ctx.fillStyle = GROUND
    ctx.fillRect(0, 0, w, h)

    // Soft pool of light behind the emblem, as on the portal tiles
    const cx = w / 2
    const cy = h * 0.36
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.46)
    glow.addColorStop(0, SURFACE)
    glow.addColorStop(1, GROUND)
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, w, h * 0.66)

    drawEmblem(ctx, EMBLEMS[app.mark] ?? EMBLEMS.hub, cx, cy, w * 0.44, app.color)

    // Rule and type block
    ctx.strokeStyle = RULE
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(w * 0.12, h * 0.665)
    ctx.lineTo(w - w * 0.12, h * 0.665)
    ctx.stroke()

    ctx.fillStyle = TEXT
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.font = '700 ' + Math.floor(w * 0.185) + 'px monospace'
    ctx.fillText(app.name, w * 0.12, h * 0.805)

    ctx.font = Math.floor(w * 0.041) + 'px monospace'
    ctx.fillStyle = 'rgba(231,234,240,0.58)'
    wrapText(ctx, t(app.tag), w * 0.12, h * 0.855, w * 0.76, w * 0.054)

    // Tile swatch, top right
    ctx.fillStyle = app.color
    ctx.fillRect(w - w * 0.12 - w * 0.1, h * 0.085, w * 0.1, w * 0.032)
}

function drawAbstractPlate(ctx, w, h, index, accent, rand)
{
    const ink = '#20232a'
    ctx.fillStyle = ['#e8e3d9', '#ded9cf', '#e4e1dc', '#dcd6c9'][index % 4]
    ctx.fillRect(0, 0, w, h)

    ctx.save()
    ctx.translate(w * 0.12, h * 0.12)
    const iw = w * 0.76
    const ih = h * 0.62
    const kind = index % 3

    if (kind === 0)
    {
        ctx.strokeStyle = ink
        ctx.lineWidth = iw * 0.035
        for (let i = 0; i < 6; i++)
        {
            ctx.beginPath()
            ctx.arc(iw / 2, ih, iw * 0.12 + i * iw * 0.075, Math.PI, Math.PI * 2)
            ctx.stroke()
        }
        ctx.fillStyle = accent
        ctx.beginPath()
        ctx.arc(iw / 2, ih * 0.28, iw * 0.11, 0, Math.PI * 2)
        ctx.fill()
    }
    else if (kind === 1)
    {
        for (let i = 0; i < 7; i++)
        {
            ctx.fillStyle = i === 2 ? accent : ink
            ctx.fillRect(0, i * (ih / 7.4), iw * (0.28 + rand() * 0.68), ih / 12)
        }
    }
    else
    {
        const n = 6
        for (let y = 0; y < n; y++)
        {
            for (let x = 0; x < n; x++)
            {
                ctx.fillStyle = (x === 3 && y === 2) ? accent : ink
                ctx.beginPath()
                ctx.arc(iw * (x + 0.5) / n, ih * (y + 0.5) / n, iw * 0.028, 0, Math.PI * 2)
                ctx.fill()
            }
        }
    }
    ctx.restore()

    ctx.fillStyle = ink
    ctx.font = '500 ' + Math.floor(w * 0.038) + 'px monospace'
    ctx.textAlign = 'left'
    ctx.fillText('PLATE ' + String(index).padStart(2, '0'), w * 0.12, h * 0.86)
}
