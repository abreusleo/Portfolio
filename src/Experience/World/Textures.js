import * as THREE from 'three'
import { EMBLEMS, drawEmblem } from '../config/emblems.js'
import pismoLogo from '../../assets/logos/pismo.png'
import { t, strings } from '../config/i18n.js'
import { PAPER } from '../config/notes.js'

/**
 * Procedural canvas textures for the blockout phase.
 * Placeholders that get swapped for real assets (art prints, project
 * screenshots, Blender bakes) without touching the meshes.
 */

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

function noiseLayer(size, contrast, rand)
{
    const [c, ctx] = canvas(size, size)
    const img = ctx.createImageData(size, size)
    const d = img.data
    for (let i = 0; i < d.length; i += 4)
    {
        const v = 128 + (rand() - 0.5) * 255 * contrast
        d[i] = d[i + 1] = d[i + 2] = v
        d[i + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
    return c
}

function srgbTexture(c)
{
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
}

function linearTexture(c)
{
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.NoColorSpace
    return tex
}

// ---------------------------------------------------------------------
// Microcement / plaster walls: soft clouds, trowel marks, no grunge
// ---------------------------------------------------------------------
export function makeMicrocement({ size = 1024, base = '#6b655c', seed = 1, contrast = 0.16, trowel = 26 } = {})
{
    const rand = mulberry32(seed)
    const [c, ctx] = canvas(size, size)

    ctx.fillStyle = base
    ctx.fillRect(0, 0, size, size)

    // Broad cloudy variation
    for (let i = 0; i < 40; i++)
    {
        const x = rand() * size
        const y = rand() * size
        const r = (0.12 + rand() * 0.3) * size
        const light = rand() > 0.5
        const a = 0.02 + rand() * 0.045
        const g = ctx.createRadialGradient(x, y, 0, x, y, r)
        g.addColorStop(0, light ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`)
        g.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = g
        ctx.fillRect(x - r, y - r, r * 2, r * 2)
    }

    // Trowel strokes
    ctx.lineCap = 'round'
    for (let i = 0; i < trowel; i++)
    {
        const x = rand() * size
        const y = rand() * size
        const len = (0.1 + rand() * 0.25) * size
        const ang = (rand() - 0.5) * 0.9
        ctx.strokeStyle = rand() > 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.035)'
        ctx.lineWidth = 6 + rand() * 26
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len)
        ctx.stroke()
    }

    // Fine grain
    ctx.globalCompositeOperation = 'overlay'
    ctx.globalAlpha = 0.45
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(noiseLayer(size / 2, contrast, rand), 0, 0, size, size)
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'

    const tex = srgbTexture(c)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    return tex
}

// ---------------------------------------------------------------------
// Polished concrete floor: large pours, faint joints, soft mottling
// ---------------------------------------------------------------------
export function makePolishedConcrete({ size = 1024, base = '#3d3c3a', seed = 2, joints = true } = {})
{
    const rand = mulberry32(seed)
    const [c, ctx] = canvas(size, size)

    ctx.fillStyle = base
    ctx.fillRect(0, 0, size, size)

    for (let i = 0; i < 55; i++)
    {
        const x = rand() * size
        const y = rand() * size
        const r = (0.08 + rand() * 0.3) * size
        const a = 0.02 + rand() * 0.05
        const g = ctx.createRadialGradient(x, y, 0, x, y, r)
        g.addColorStop(0, rand() > 0.45 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a * 1.4})`)
        g.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = g
        ctx.fillRect(x - r, y - r, r * 2, r * 2)
    }

    // Fine aggregate speckle
    for (let i = 0; i < 2600; i++)
    {
        const x = rand() * size
        const y = rand() * size
        ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)'
        ctx.fillRect(x, y, 1 + rand() * 2, 1 + rand() * 2)
    }

    // Saw-cut control joints
    if (joints)
    {
        ctx.strokeStyle = 'rgba(0,0,0,0.22)'
        ctx.lineWidth = 2
        ctx.beginPath(); ctx.moveTo(size / 2, 0); ctx.lineTo(size / 2, size); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(0, size / 2); ctx.lineTo(size, size / 2); ctx.stroke()
    }

    const tex = srgbTexture(c)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    return tex
}

// ---------------------------------------------------------------------
// Wood: vertical grain for slats, horizontal for desk tops
// ---------------------------------------------------------------------
export function makeWood({ size = 512, base = '#6b4630', seed = 7, vertical = true, strength = 0.35 } = {})
{
    const rand = mulberry32(seed)
    const [c, ctx] = canvas(size, size)

    ctx.fillStyle = base
    ctx.fillRect(0, 0, size, size)

    ctx.save()
    if (!vertical)
    {
        ctx.translate(size, 0)
        ctx.rotate(Math.PI / 2)
    }

    // Grain lines
    for (let i = 0; i < 190; i++)
    {
        const x = rand() * size
        const w = 0.6 + rand() * 3.2
        const dark = rand() > 0.42
        ctx.strokeStyle = dark
            ? `rgba(0,0,0,${0.04 + rand() * 0.11 * strength * 3})`
            : `rgba(255,255,255,${0.02 + rand() * 0.05 * strength * 3})`
        ctx.lineWidth = w
        ctx.beginPath()
        let y = 0
        let cx = x
        ctx.moveTo(cx, y)
        while (y < size)
        {
            y += 22 + rand() * 30
            cx += (rand() - 0.5) * 5
            ctx.lineTo(cx, y)
        }
        ctx.stroke()
    }

    // Occasional knot
    for (let i = 0; i < 2; i++)
    {
        const x = rand() * size
        const y = rand() * size
        for (let k = 0; k < 5; k++)
        {
            ctx.strokeStyle = `rgba(0,0,0,${0.06 - k * 0.01})`
            ctx.lineWidth = 1.5
            ctx.beginPath()
            ctx.ellipse(x, y, 4 + k * 5, 9 + k * 11, 0.2, 0, Math.PI * 2)
            ctx.stroke()
        }
    }
    ctx.restore()

    ctx.globalCompositeOperation = 'overlay'
    ctx.globalAlpha = 0.3
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(noiseLayer(size / 2, 0.2, rand), 0, 0, size, size)
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'

    const tex = srgbTexture(c)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    return tex
}

// ---------------------------------------------------------------------
// Rug / acoustic fabric
// ---------------------------------------------------------------------
export function makeFabric({ size = 512, base = '#2f2e2c', seed = 9 } = {})
{
    const rand = mulberry32(seed)
    const [c, ctx] = canvas(size, size)
    ctx.fillStyle = base
    ctx.fillRect(0, 0, size, size)

    for (let i = 0; i < 9000; i++)
    {
        const x = rand() * size
        const y = rand() * size
        ctx.strokeStyle = rand() > 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.05)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x + (rand() - 0.5) * 5, y + (rand() - 0.5) * 5)
        ctx.stroke()
    }

    const tex = srgbTexture(c)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    return tex
}

// ---------------------------------------------------------------------
// Framed art print placeholder — calm, editorial, riso-ish
// ---------------------------------------------------------------------
export function makeArtPrint({ index = 1, accent = '#ff8a3d', w = 620, h = 860, seed = 31 } = {})
{
    const rand = mulberry32(seed + index * 7919)
    const [c, ctx] = canvas(w, h)

    const paper = ['#e8e3d9', '#ded9cf', '#e4e1dc', '#dcd6c9'][index % 4]
    ctx.fillStyle = paper
    ctx.fillRect(0, 0, w, h)

    const ink = ['#22242a', '#2b2f36', '#1d2026'][index % 3]
    const kind = index % 5

    ctx.save()
    ctx.translate(w * 0.12, h * 0.12)
    const iw = w * 0.76
    const ih = h * 0.62

    if (kind === 0)
    {
        // Concentric arcs
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
        // Stacked bars
        for (let i = 0; i < 7; i++)
        {
            ctx.fillStyle = i === 2 ? accent : ink
            const bw = iw * (0.28 + rand() * 0.68)
            ctx.fillRect(0, i * (ih / 7.4), bw, ih / 12)
        }
    }
    else if (kind === 2)
    {
        // Grid of dots with one accent
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
    else if (kind === 3)
    {
        // Split circle
        ctx.fillStyle = ink
        ctx.beginPath()
        ctx.arc(iw / 2, ih / 2, Math.min(iw, ih) * 0.42, Math.PI * 0.5, Math.PI * 1.5)
        ctx.fill()
        ctx.fillStyle = accent
        ctx.beginPath()
        ctx.arc(iw / 2, ih / 2, Math.min(iw, ih) * 0.42, Math.PI * 1.5, Math.PI * 0.5)
        ctx.fill()
    }
    else
    {
        // Diagonal lines
        ctx.strokeStyle = ink
        ctx.lineWidth = iw * 0.022
        for (let i = -6; i < 14; i++)
        {
            ctx.beginPath()
            ctx.moveTo(i * iw * 0.1, 0)
            ctx.lineTo(i * iw * 0.1 + ih * 0.6, ih)
            ctx.stroke()
        }
        ctx.fillStyle = accent
        ctx.fillRect(iw * 0.1, ih * 0.42, iw * 0.8, ih * 0.1)
    }
    ctx.restore()

    // Caption
    ctx.fillStyle = ink
    ctx.font = `500 ${Math.floor(w * 0.038)}px monospace`
    ctx.textAlign = 'left'
    ctx.fillText(`PLATE ${String(index).padStart(2, '0')}`, w * 0.12, h * 0.86)
    ctx.fillStyle = 'rgba(0,0,0,0.45)'
    ctx.font = `${Math.floor(w * 0.03)}px monospace`
    ctx.fillText('placeholder', w * 0.12, h * 0.91)

    // Paper grain
    ctx.globalCompositeOperation = 'multiply'
    ctx.globalAlpha = 0.14
    ctx.drawImage(noiseLayer(220, 0.5, rand), 0, 0, w, h)
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'

    return srgbTexture(c)
}

// ---------------------------------------------------------------------
// Main monitor: clean modern portfolio UI
// ---------------------------------------------------------------------
export function makeAppScreen({ w = 1400, h = 600, accent = '#ff8a3d', title = 'PROJECT 01' } = {})
{
    const [c, ctx] = canvas(w, h)

    ctx.fillStyle = '#0e0f12'
    ctx.fillRect(0, 0, w, h)

    // Top bar
    ctx.fillStyle = '#15171b'
    ctx.fillRect(0, 0, w, 42)
    ctx.fillStyle = '#2c3038'
    for (let i = 0; i < 3; i++)
    {
        ctx.beginPath()
        ctx.arc(28 + i * 22, 21, 6, 0, Math.PI * 2)
        ctx.fill()
    }
    ctx.fillStyle = '#20242b'
    ctx.fillRect(120, 10, 420, 22)
    ctx.fillStyle = '#6d7480'
    ctx.font = '14px monospace'
    ctx.textBaseline = 'middle'
    ctx.fillText('leonardo.dev', 134, 22)

    // Sidebar
    ctx.fillStyle = '#111318'
    ctx.fillRect(0, 42, 210, h - 42)
    ctx.fillStyle = '#e8ebf0'
    ctx.font = 'bold 20px monospace'
    ctx.fillText('LEONARDO', 24, 84)
    const nav = ['work', 'about', 'lab', 'contact']
    nav.forEach((n, i) =>
    {
        const y = 140 + i * 40
        if (i === 0)
        {
            ctx.fillStyle = accent
            ctx.fillRect(0, y - 14, 3, 28)
            ctx.fillStyle = '#e8ebf0'
        }
        else ctx.fillStyle = '#666d78'
        ctx.font = '17px monospace'
        ctx.fillText(n, 24, y)
    })

    // Hero card
    const hx = 244
    const hy = 78
    const hw = w - hx - 44
    const hh = 268
    const g = ctx.createLinearGradient(hx, hy, hx + hw, hy + hh)
    g.addColorStop(0, '#1d2430')
    g.addColorStop(0.55, '#2b3342')
    g.addColorStop(1, accent)
    ctx.fillStyle = g
    ctx.fillRect(hx, hy, hw, hh)

    // Abstract shapes in the hero
    ctx.save()
    ctx.beginPath()
    ctx.rect(hx, hy, hw, hh)
    ctx.clip()
    ctx.strokeStyle = 'rgba(255,255,255,0.16)'
    ctx.lineWidth = 2
    for (let i = 0; i < 9; i++)
    {
        ctx.beginPath()
        ctx.arc(hx + hw * 0.72, hy + hh * 0.5, 26 + i * 30, 0, Math.PI * 2)
        ctx.stroke()
    }
    ctx.restore()

    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 46px monospace'
    ctx.fillText(title, hx + 36, hy + 74)
    ctx.font = '18px monospace'
    ctx.fillStyle = 'rgba(255,255,255,0.72)'
    ctx.fillText('placeholder — featured project goes here', hx + 38, hy + 112)

    // Thumbnail row
    const ty = hy + hh + 34
    const tw = (hw - 3 * 22) / 4
    for (let i = 0; i < 4; i++)
    {
        const x = hx + i * (tw + 22)
        ctx.fillStyle = '#171a20'
        ctx.fillRect(x, ty, tw, 132)
        ctx.fillStyle = i === 0 ? accent : '#262b34'
        ctx.fillRect(x, ty, tw, 5)
        ctx.fillStyle = '#3a404b'
        ctx.fillRect(x + 18, ty + 34, tw * 0.6, 10)
        ctx.fillRect(x + 18, ty + 56, tw * 0.4, 10)
        ctx.fillStyle = '#565d68'
        ctx.font = '13px monospace'
        ctx.fillText(`0${i + 2}`, x + 18, ty + 108)
    }

    return srgbTexture(c)
}

// ---------------------------------------------------------------------
// Secondary monitor: calm code editor
// ---------------------------------------------------------------------
export function makeCodeScreen({ w = 720, h = 900, accent = '#ff8a3d', seed = 4 } = {})
{
    const rand = mulberry32(seed)
    const [c, ctx] = canvas(w, h)

    ctx.fillStyle = '#101216'
    ctx.fillRect(0, 0, w, h)

    // Tab bar
    ctx.fillStyle = '#15181d'
    ctx.fillRect(0, 0, w, 34)
    ctx.fillStyle = '#1c2027'
    ctx.fillRect(0, 0, 190, 34)
    ctx.fillStyle = '#98a0ac'
    ctx.font = '14px monospace'
    ctx.textBaseline = 'middle'
    ctx.fillText('World.js', 20, 17)

    // Gutter
    ctx.fillStyle = '#0c0e11'
    ctx.fillRect(0, 34, 46, h - 34)

    const colors = ['#6f7783', '#c7cdd6', '#7fb2e5', '#8fd6a7', accent, '#d2a0e0']
    const lh = 21
    const lines = Math.floor((h - 60) / lh)

    for (let i = 0; i < lines; i++)
    {
        const y = 52 + i * lh
        ctx.fillStyle = '#3a4049'
        ctx.font = '13px monospace'
        ctx.textAlign = 'right'
        ctx.fillText(String(i + 1), 36, y)
        ctx.textAlign = 'left'

        if (rand() > 0.86) continue // blank line

        const indent = 56 + Math.floor(rand() * 3) * 18
        let x = indent
        const tokens = 2 + Math.floor(rand() * 5)
        for (let t = 0; t < tokens; t++)
        {
            const len = 18 + rand() * 78
            ctx.fillStyle = colors[Math.floor(rand() * colors.length)]
            ctx.globalAlpha = 0.75
            ctx.fillRect(x, y - 5, len, 10)
            ctx.globalAlpha = 1
            x += len + 12
            if (x > w - 60) break
        }
    }

    return srgbTexture(c)
}

// ---------------------------------------------------------------------
// The whiteboard on the right wall: one quote, written by hand
// ---------------------------------------------------------------------
const QUOTE = 'The biggest things in life have been achieved by people who, at the start, '
    + 'we would have judged crazy. And yet if they had not had these crazy ideas the world '
    + 'would have been more stupid'

const HAND = '"Caveat", "Segoe Script", "Bradley Hand", cursive'
const MARKER_INK = '#22262c'
const MARKER_RED = '#d3121a'

// ---------------------------------------------------------------------
// Glass whiteboard: one quote, written by hand, with the cannon beside it
// ---------------------------------------------------------------------
const WENGER_QUOTE = 'The biggest things in life have been achieved by people who, at the start, we would have judged crazy. And yet if they had not had these crazy ideas the world would have been more stupid'
const HAND_FONT = '"Caveat", "Segoe Script", "Bradley Hand", cursive'
const BOARD_INK = '#22262c'
const BOARD_RED = '#d3121a'

/** The Arsenal cannon, drawn in red marker. */
function drawCannon(ctx, x, y, scale)
{
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(scale, scale)
    ctx.strokeStyle = BOARD_RED
    ctx.lineWidth = 5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    // Barrel
    ctx.beginPath()
    ctx.moveTo(30, 34)
    ctx.lineTo(168, 40)
    ctx.lineTo(168, 32)
    ctx.lineTo(186, 32)
    ctx.lineTo(186, 66)
    ctx.lineTo(168, 66)
    ctx.lineTo(168, 58)
    ctx.lineTo(30, 64)
    ctx.closePath()
    ctx.stroke()

    // Muzzle
    ctx.beginPath()
    ctx.arc(24, 49, 9, 0, Math.PI * 2)
    ctx.stroke()

    // Carriage
    ctx.beginPath()
    ctx.moveTo(44, 64)
    ctx.lineTo(148, 64)
    ctx.lineTo(118, 108)
    ctx.lineTo(60, 108)
    ctx.closePath()
    ctx.stroke()

    // Trail
    ctx.beginPath()
    ctx.moveTo(60, 100)
    ctx.lineTo(12, 122)
    ctx.lineTo(20, 132)
    ctx.lineTo(66, 112)
    ctx.stroke()

    // Wheel, hub and spokes
    ctx.beginPath()
    ctx.arc(88, 104, 30, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(88, 104, 7, 0, Math.PI * 2)
    ctx.stroke()
    for (let i = 0; i < 6; i++)
    {
        const a = (i / 6) * Math.PI * 2 + 0.3
        ctx.beginPath()
        ctx.moveTo(88 + Math.cos(a) * 8, 104 + Math.sin(a) * 8)
        ctx.lineTo(88 + Math.cos(a) * 29, 104 + Math.sin(a) * 29)
        ctx.stroke()
    }

    ctx.restore()
}

export function makeWhiteboard({ w = 1024, h = 700 } = {})
{
    const [c, ctx] = canvas(w, h)

    const draw = () =>
    {
        ctx.clearRect(0, 0, w, h)
        ctx.fillStyle = '#f2f3f4'
        ctx.fillRect(0, 0, w, h)

        // Ghosts of what was wiped off, which is what a used board looks like
        ctx.strokeStyle = 'rgba(120,130,145,0.055)'
        ctx.lineWidth = 26
        ctx.lineCap = 'round'
        for (const [x1, y1, x2, y2] of [[80, 640, 520, 618], [420, 76, 930, 96], [96, 154, 268, 142]])
        {
            ctx.beginPath()
            ctx.moveTo(x1, y1)
            ctx.lineTo(x2, y2)
            ctx.stroke()
        }

        drawCannon(ctx, 62, 232, 1.05)

        ctx.textAlign = 'left'
        ctx.textBaseline = 'alphabetic'
        ctx.fillStyle = BOARD_INK
        ctx.font = `44px ${HAND_FONT}`

        const x = 328
        const maxWidth = 640
        const lineHeight = 56
        const lines = []
        let line = ''
        for (const word of WENGER_QUOTE.split(' '))
        {
            const next = line ? `${line} ${word}` : word
            if (ctx.measureText(next).width > maxWidth && line)
            {
                lines.push(line)
                line = word
            }
            else line = next
        }
        if (line) lines.push(line)

        const top = (h - lines.length * lineHeight) / 2 - 26
        lines.forEach((text, i) => ctx.fillText(text, x, top + i * lineHeight))

        ctx.fillStyle = 'rgba(34,38,44,0.22)'
        ctx.font = `170px ${HAND_FONT}`
        ctx.fillText('\u201C', x - 78, top + 46)

        const signatureY = top + lines.length * lineHeight + 52
        ctx.fillStyle = BOARD_RED
        ctx.font = `40px ${HAND_FONT}`
        const signature = '\u2014 Ars\u00E8ne Wenger'
        ctx.fillText(signature, x, signatureY)

        ctx.strokeStyle = BOARD_RED
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(x, signatureY + 12)
        ctx.lineTo(x + ctx.measureText(signature).width, signatureY + 15)
        ctx.stroke()
    }

    draw()
    const texture = srgbTexture(c)

    // Caveat arrives with the stylesheet, which may land after this runs.
    // Redraw once it is ready instead of shipping the fallback hand.
    if (typeof document !== 'undefined' && document.fonts && document.fonts.load)
    {
        document.fonts.load('44px "Caveat"')
            .then(() => { draw(); texture.needsUpdate = true })
            .catch(() => {})
    }

    return texture
}

// ---------------------------------------------------------------------
// Odds and ends: a book spine, a mesh panel, a pump readout
// ---------------------------------------------------------------------
export function makeBookSpine({ hue = 30, index = 0 } = {})
{
    const [c, ctx] = canvas(64, 256)

    ctx.fillStyle = `hsl(${hue}, 18%, ${22 + (index % 3) * 8}%)`
    ctx.fillRect(0, 0, 64, 256)

    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.fillRect(10, 40, 44, 3)
    ctx.fillRect(10, 200, 44, 3)

    // The title, unreadable on purpose: at the size this is seen, letters
    // would be noise pretending to be words.
    ctx.save()
    ctx.translate(32, 128)
    ctx.rotate(-Math.PI / 2)
    ctx.textAlign = 'center'
    ctx.font = 'bold 16px monospace'
    ctx.fillStyle = 'rgba(255,255,255,0.72)'
    ctx.fillText('\u00B7 \u00B7 \u00B7 \u00B7', 0, 6)
    ctx.restore()

    return srgbTexture(c)
}

/** Hexagonal mesh, for the front panel of the tower. */
export function makeHexMesh({ size = 512, cols = 22 } = {})
{
    const [c, ctx] = canvas(size, size)

    ctx.fillStyle = '#31353b'
    ctx.fillRect(0, 0, size, size)

    const r = size / cols / 2
    const rowStep = r * Math.sqrt(3)

    ctx.fillStyle = '#0a0b0e'
    for (let row = 0; row * rowStep < size + rowStep; row++)
    {
        for (let col = 0; col * r * 3 < size + r * 3; col++)
        {
            const cx = col * r * 3 + (row % 2 ? r * 1.5 : 0)
            const cy = row * rowStep

            ctx.beginPath()
            for (let i = 0; i < 6; i++)
            {
                const a = (i / 6) * Math.PI * 2
                const x = cx + Math.cos(a) * r * 0.78
                const y = cy + Math.sin(a) * r * 0.78
                if (i === 0) ctx.moveTo(x, y)
                else ctx.lineTo(x, y)
            }
            ctx.closePath()
            ctx.fill()
        }
    }

    const tex = srgbTexture(c)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    return tex
}

/** The little round display on the water cooler pump. */
export function makePumpDisplay({ size = 256, temp = 39 } = {})
{
    const [c, ctx] = canvas(size, size)

    ctx.fillStyle = '#050608'
    ctx.fillRect(0, 0, size, size)

    ctx.strokeStyle = '#2b3038'
    ctx.lineWidth = 10
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, size * 0.4, 0, Math.PI * 2)
    ctx.stroke()

    ctx.strokeStyle = '#cfe6ff'
    ctx.lineWidth = 10
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, size * 0.4, -Math.PI * 0.5, Math.PI * 0.55)
    ctx.stroke()

    ctx.fillStyle = '#8fa3b8'
    ctx.font = `500 ${Math.floor(size * 0.1)}px monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('Liquid', size / 2, size * 0.37)

    ctx.fillStyle = '#f2f6fb'
    ctx.font = `600 ${Math.floor(size * 0.3)}px monospace`
    ctx.fillText(String(temp), size / 2, size * 0.57)

    ctx.fillStyle = '#8fa3b8'
    ctx.font = `500 ${Math.floor(size * 0.11)}px monospace`
    ctx.fillText('\u00B0C', size / 2, size * 0.75)

    return srgbTexture(c)
}

/**
 * What the television is showing: the same screen the click opens.
 *
 * A stage across the top, where the video plays, and a row of marks along the
 * bottom to move between them. It was a grid of six tiles, which was a fine
 * screen and the wrong one: the room promised a menu and the click delivered a
 * player with a list down the side, so the television was advertising
 * something that did not exist. One layout, drawn twice — here in a canvas for
 * the set on the wall, and in the DOM for the overlay. The pair is what makes
 * the promise true, so they move together or not at all.
 */
export function makeTvMenu({ w = 1280, h = 720, accent = '#ff8a3d', items = [], focus = 0 } = {})
{
    const [c, ctx] = canvas(w, h)
    const item = items[focus] ?? null

    ctx.fillStyle = '#07080b'
    ctx.fillRect(0, 0, w, h)

    const pad = w * 0.045
    const railTop = h * 0.735
    const stage = { x: pad, y: h * 0.13, w: w - pad * 2, h: railTop - h * 0.13 - h * 0.035 }

    // ---- header ------------------------------------------------------
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = '#e7eaf0'
    ctx.font = `700 ${Math.floor(h * 0.045)}px monospace`
    ctx.fillText(t(strings.tvTitle), pad, h * 0.085)

    ctx.fillStyle = accent
    ctx.fillRect(pad, h * 0.1, w * 0.042, 3)

    ctx.textAlign = 'right'
    ctx.fillStyle = 'rgba(231,234,240,0.45)'
    ctx.font = `${Math.floor(h * 0.028)}px monospace`
    ctx.fillText(`${items.length} ${t(strings.tvCount)}`, w - pad, h * 0.082)

    // ---- stage -------------------------------------------------------
    // The mark of whatever is selected, held the way a paused frame holds a
    // title card. It is not a still from the file: the set has no video
    // decoder behind it, and one running for a screen nobody is watching is
    // the kind of cost that does not announce itself.
    ctx.save()
    ctx.beginPath()
    if (ctx.roundRect) ctx.roundRect(stage.x, stage.y, stage.w, stage.h, 14)
    else ctx.rect(stage.x, stage.y, stage.w, stage.h)
    ctx.clip()

    const bg = ctx.createLinearGradient(stage.x, stage.y, stage.x + stage.w, stage.y + stage.h)
    bg.addColorStop(0, '#0e131c')
    bg.addColorStop(1, '#080a0f')
    ctx.fillStyle = bg
    ctx.fillRect(stage.x, stage.y, stage.w, stage.h)

    if (item)
    {
        const glow = ctx.createRadialGradient(
            stage.x + stage.w * 0.28, stage.y + stage.h * 0.5, 0,
            stage.x + stage.w * 0.28, stage.y + stage.h * 0.5, stage.w * 0.5,
        )
        glow.addColorStop(0, hexAlpha(item.color ?? accent, 0.22))
        glow.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = glow
        ctx.fillRect(stage.x, stage.y, stage.w, stage.h)

        drawEmblem(ctx, EMBLEMS[item.mark], stage.x + stage.w * 0.28, stage.y + stage.h * 0.46,
            stage.h * 0.42, item.color ?? accent)

        const textX = stage.x + stage.w * 0.46
        ctx.textAlign = 'left'
        ctx.fillStyle = '#f2f5fa'
        ctx.font = `700 ${Math.floor(stage.h * 0.19)}px monospace`
        ctx.fillText(String(item.title ?? '').toUpperCase(), textX, stage.y + stage.h * 0.48)

        ctx.fillStyle = 'rgba(231,234,240,0.5)'
        ctx.font = `${Math.floor(stage.h * 0.082)}px monospace`
        wrapText(ctx, t(item.note) ?? '', textX, stage.y + stage.h * 0.63,
            stage.w * 0.48, stage.h * 0.11)

        // Play badge, so the stage reads as something that starts
        const px = textX + stage.h * 0.09
        const py = stage.y + stage.h * 0.85
        ctx.beginPath()
        ctx.arc(px, py, stage.h * 0.09, 0, Math.PI * 2)
        ctx.strokeStyle = accent
        ctx.lineWidth = 2.5
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(px - stage.h * 0.025, py - stage.h * 0.042)
        ctx.lineTo(px + stage.h * 0.045, py)
        ctx.lineTo(px - stage.h * 0.025, py + stage.h * 0.042)
        ctx.closePath()
        ctx.fillStyle = accent
        ctx.fill()

        ctx.textAlign = 'left'
        ctx.fillStyle = 'rgba(231,234,240,0.62)'
        ctx.font = `600 ${Math.floor(stage.h * 0.075)}px monospace`
        ctx.fillText(t(strings.tvHint).toUpperCase(), px + stage.h * 0.16, py + stage.h * 0.028)
    }

    ctx.restore()

    ctx.save()
    ctx.beginPath()
    if (ctx.roundRect) ctx.roundRect(stage.x, stage.y, stage.w, stage.h, 14)
    else ctx.rect(stage.x, stage.y, stage.w, stage.h)
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.restore()

    // ---- the rail of marks -------------------------------------------
    const gap = w * 0.014
    const cardW = (w - pad * 2 - gap * (items.length - 1)) / Math.max(1, items.length)
    const cardH = h - railTop - h * 0.055

    items.forEach((entry, i) =>
    {
        const x = pad + i * (cardW + gap)
        const on = i === focus

        ctx.save()
        ctx.beginPath()
        if (ctx.roundRect) ctx.roundRect(x, railTop, cardW, cardH, 10)
        else ctx.rect(x, railTop, cardW, cardH)
        ctx.fillStyle = on ? '#161d29' : '#0c1017'
        ctx.fill()
        ctx.strokeStyle = on ? accent : 'rgba(255,255,255,0.08)'
        ctx.lineWidth = on ? 3 : 1.5
        ctx.stroke()
        ctx.restore()

        drawEmblem(ctx, EMBLEMS[entry.mark], x + cardW * 0.5, railTop + cardH * 0.38,
            cardH * 0.4, on ? (entry.color ?? accent) : 'rgba(231,234,240,0.45)')

        ctx.textAlign = 'center'
        ctx.fillStyle = on ? '#f2f5fa' : 'rgba(231,234,240,0.4)'
        ctx.font = `700 ${Math.floor(cardH * 0.17)}px monospace`
        ctx.fillText(String(entry.title ?? '').toUpperCase(), x + cardW * 0.5, railTop + cardH * 0.82)
    })

    return srgbTexture(c)
}

/** `#rrggbb` plus an alpha, for the one place a gradient needs both. */
function hexAlpha(hex, alpha)
{
    const value = String(hex).replace('#', '')
    const n = parseInt(value.length === 3 ? value.replace(/./g, (d) => d + d) : value, 16)
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

/** Lays a line of text out over as many rows as it needs. */
function wrapText(ctx, text, x, y, maxWidth, lineHeight)
{
    let line = ''
    let row = 0
    for (const word of String(text).split(/\s+/))
    {
        const next = line ? `${line} ${word}` : word
        if (ctx.measureText(next).width > maxWidth && line)
        {
            ctx.fillText(line, x, y + row * lineHeight)
            line = word
            row++
            if (row > 1) break
        }
        else line = next
    }
    if (line) ctx.fillText(line, x, y + row * lineHeight)
}

// ---------------------------------------------------------------------
// Small label plate for the shelves
// ---------------------------------------------------------------------
export function makeShelfLabel({ text = '01 — PRODUCT', w = 512, h = 96 } = {})
{
    const [c, ctx] = canvas(w, h)
    ctx.fillStyle = '#111316'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#cfd3d9'
    ctx.font = `500 ${Math.floor(h * 0.44)}px monospace`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 22, h / 2 + 2)
    return srgbTexture(c)
}

// ---------------------------------------------------------------------
// Standing card for a product on the shelf
// ---------------------------------------------------------------------
export function makeProductCard({ w = 440, h = 580, dark = false, accent = '#2FD3C3', ink = '#1e40af', title = '', line = '', foot = '' } = {})
{
    const [c, ctx] = canvas(w, h)

    ctx.fillStyle = dark ? '#141416' : '#f4f5f7'
    ctx.fillRect(0, 0, w, h)

    // Accent bar down the left edge
    ctx.fillStyle = accent
    ctx.fillRect(0, 0, w * 0.055, h)

    const pad = w * 0.16
    const body = dark ? 'rgba(236,238,242,0.66)' : 'rgba(20,24,32,0.6)'
    const head = dark ? '#eceef2' : ink

    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'

    // Title, wrapped so a two-word name stacks
    ctx.fillStyle = head
    ctx.font = `700 ${Math.floor(w * 0.15)}px monospace`
    const words = title.split(' ')
    let y = h * 0.42
    for (const word of words)
    {
        ctx.fillText(word, pad, y)
        y += w * 0.17
    }

    ctx.strokeStyle = dark ? 'rgba(255,255,255,0.18)' : 'rgba(20,24,32,0.2)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(pad, y - w * 0.09)
    ctx.lineTo(w - pad * 0.6, y - w * 0.09)
    ctx.stroke()

    ctx.fillStyle = body
    ctx.font = `${Math.floor(w * 0.048)}px monospace`
    let cursor = y + w * 0.02
    let lineText = ''
    for (const word of line.split(' '))
    {
        const attempt = lineText ? `${lineText} ${word}` : word
        if (ctx.measureText(attempt).width > w - pad * 1.6 && lineText)
        {
            ctx.fillText(lineText, pad, cursor)
            lineText = word
            cursor += w * 0.062
        }
        else lineText = attempt
    }
    if (lineText) ctx.fillText(lineText, pad, cursor)

    ctx.fillStyle = accent
    ctx.font = `600 ${Math.floor(w * 0.042)}px monospace`
    ctx.fillText(foot, pad, h - h * 0.075)

    return srgbTexture(c)
}

// ---------------------------------------------------------------------
// Small KPI screen, for the tablet on the Bios Health shelf
// ---------------------------------------------------------------------
export function makeDashboard({ w = 640, h = 400, ink = '#1e40af', accent = '#2FD3C3' } = {})
{
    const [c, ctx] = canvas(w, h)

    // Dark board: the product reads far better against the warm wood
    const GROUND = '#090b0e'
    const SURFACE = '#12161d'
    const RULE = 'rgba(231,234,240,0.12)'
    const TEXT = '#e7eaf0'
    const MUTED = 'rgba(231,234,240,0.45)'

    ctx.fillStyle = GROUND
    ctx.fillRect(0, 0, w, h)

    // Top bar
    ctx.fillStyle = SURFACE
    ctx.fillRect(0, 0, w, h * 0.13)
    ctx.fillStyle = accent
    ctx.fillRect(0, h * 0.13 - 2, w, 2)

    ctx.fillStyle = TEXT
    ctx.font = `700 ${Math.floor(h * 0.055)}px monospace`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    ctx.fillText(t({ pt: 'CENTRO CIRÚRGICO', en: 'OPERATING THEATRE' }), w * 0.04, h * 0.066)
    ctx.fillStyle = accent
    ctx.beginPath()
    ctx.arc(w * 0.94, h * 0.066, h * 0.018, 0, Math.PI * 2)
    ctx.fill()

    // Three KPI tiles
    const tiles = [
        [t({ pt: 'SALAS', en: 'ROOMS' }), '6/8', accent],
        [t({ pt: 'ATRASO', en: 'DELAY' }), '12 min', '#e0913f'],
        [t({ pt: 'ALTAS', en: 'DISCHARGED' }), '23', '#6fb5e8'],
    ]
    tiles.forEach(([label, value, colour], i) =>
    {
        const x = w * (0.04 + i * 0.316)
        const tw = w * 0.28
        ctx.fillStyle = SURFACE
        ctx.fillRect(x, h * 0.18, tw, h * 0.26)
        ctx.strokeStyle = RULE
        ctx.lineWidth = 2
        ctx.strokeRect(x, h * 0.18, tw, h * 0.26)
        ctx.fillStyle = colour
        ctx.fillRect(x, h * 0.18, tw, h * 0.012)

        ctx.fillStyle = MUTED
        ctx.font = `${Math.floor(h * 0.042)}px monospace`
        ctx.fillText(label, x + w * 0.02, h * 0.255)
        ctx.fillStyle = TEXT
        ctx.font = `700 ${Math.floor(h * 0.085)}px monospace`
        ctx.fillText(value, x + w * 0.02, h * 0.365)
    })

    // Occupancy through the day
    ctx.fillStyle = SURFACE
    ctx.fillRect(w * 0.04, h * 0.49, w * 0.92, h * 0.43)
    ctx.strokeStyle = RULE
    ctx.strokeRect(w * 0.04, h * 0.49, w * 0.92, h * 0.43)

    const bars = [0.35, 0.62, 0.8, 0.55, 0.9, 0.72, 0.45, 0.68, 0.3]
    const bw = (w * 0.86) / bars.length
    bars.forEach((k, i) =>
    {
        const bh = h * 0.28 * k
        ctx.fillStyle = i === 4 ? accent : '#2b3a4c'
        ctx.fillRect(w * 0.07 + i * bw, h * 0.86 - bh, bw * 0.6, bh)
    })

    ctx.strokeStyle = RULE
    ctx.beginPath()
    ctx.moveTo(w * 0.06, h * 0.86)
    ctx.lineTo(w * 0.95, h * 0.86)
    ctx.stroke()

    return srgbTexture(c)
}

// ---------------------------------------------------------------------
// Game case cover, for the Surviving shelf
// ---------------------------------------------------------------------
export function makeGameCover({ w = 420, h = 580, accent = '#e0913f' } = {})
{
    const [c, ctx] = canvas(w, h)

    const sky = ctx.createLinearGradient(0, 0, 0, h)
    sky.addColorStop(0, '#20242b')
    sky.addColorStop(0.55, '#15171c')
    sky.addColorStop(1, '#0b0c0f')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, w, h)

    // A low sun and a ruined skyline
    ctx.fillStyle = accent
    ctx.globalAlpha = 0.55
    ctx.beginPath()
    ctx.arc(w * 0.62, h * 0.42, w * 0.2, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1

    ctx.fillStyle = '#0a0b0e'
    const towers = [[0.04, 0.3], [0.16, 0.46], [0.3, 0.22], [0.42, 0.38], [0.56, 0.28], [0.68, 0.5], [0.82, 0.34]]
    for (const [x, t] of towers)
    {
        ctx.fillRect(w * x, h * (0.52 - t * 0.34), w * 0.1, h * 0.34 * t + h * 0.12)
    }
    ctx.fillRect(0, h * 0.62, w, h * 0.38)

    // A lone figure
    ctx.fillStyle = '#05060a'
    ctx.beginPath()
    ctx.arc(w * 0.34, h * 0.575, w * 0.022, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillRect(w * 0.325, h * 0.595, w * 0.03, h * 0.055)

    ctx.strokeStyle = accent
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(w * 0.12, h * 0.72)
    ctx.lineTo(w - w * 0.12, h * 0.72)
    ctx.stroke()

    ctx.fillStyle = '#eceef2'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.font = `700 ${Math.floor(w * 0.13)}px monospace`
    ctx.fillText('SURVIVING', w * 0.12, h * 0.84)

    ctx.fillStyle = 'rgba(236,238,242,0.6)'
    ctx.font = `${Math.floor(w * 0.05)}px monospace`
    ctx.fillText('s&box · Source 2', w * 0.12, h * 0.9)

    return srgbTexture(c)
}

// ---------------------------------------------------------------------
// Club pennant for the desk, in the tricolour's own vertical stripes
// ---------------------------------------------------------------------
export function makePennant({ w = 512, h = 256, name = 'FLUMINENSE', year = '1902' } = {})
{
    const [c, ctx] = canvas(w, h)

    const GARNET = '#7c1130'
    const GREEN = '#0e5c3a'
    const WHITE = '#f1f0ec'

    // Alpha outside the triangle, so the plane reads as a pennant
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(w, h * 0.5)
    ctx.lineTo(0, h)
    ctx.closePath()
    ctx.clip()

    // Vertical stripes, the order on the shirt
    const stripes = [GARNET, WHITE, GREEN]
    const band = w / 12
    for (let i = 0; i < 12; i++)
    {
        ctx.fillStyle = stripes[i % 3]
        ctx.fillRect(i * band, 0, band + 1, h)
    }

    // Hoist band and the plaque that carries the name
    ctx.fillStyle = WHITE
    ctx.fillRect(0, 0, w * 0.1, h)
    ctx.fillStyle = 'rgba(241,240,236,0.94)'
    ctx.fillRect(w * 0.12, h * 0.36, w * 0.62, h * 0.28)

    ctx.fillStyle = GREEN
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.font = `700 ${Math.floor(h * 0.15)}px monospace`
    ctx.fillText(name, w * 0.145, h * 0.485)

    ctx.fillStyle = GARNET
    ctx.font = `700 ${Math.floor(h * 0.09)}px monospace`
    ctx.fillText(year, w * 0.145, h * 0.6)

    // Edge shading so it does not read as flat paper
    const shade = ctx.createLinearGradient(0, 0, w, 0)
    shade.addColorStop(0, 'rgba(0,0,0,0.25)')
    shade.addColorStop(0.35, 'rgba(0,0,0,0)')
    shade.addColorStop(1, 'rgba(0,0,0,0.18)')
    ctx.fillStyle = shade
    ctx.fillRect(0, 0, w, h)
    ctx.restore()

    const texture = new THREE.CanvasTexture(c)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
}

// ---------------------------------------------------------------------
// Football, wrapped in the club's colours
// ---------------------------------------------------------------------
export function makeBall({ w = 512, h = 256 } = {})
{
    const [c, ctx] = canvas(w, h)

    ctx.fillStyle = '#f1f0ec'
    ctx.fillRect(0, 0, w, h)

    // Two bands around the middle, plus the seams between the panels
    ctx.fillStyle = '#7c1130'
    ctx.fillRect(0, h * 0.36, w, h * 0.08)
    ctx.fillStyle = '#0e5c3a'
    ctx.fillRect(0, h * 0.56, w, h * 0.08)

    ctx.strokeStyle = 'rgba(20,24,32,0.25)'
    ctx.lineWidth = 3
    for (let i = 0; i < 6; i++)
    {
        const x = (i / 6) * w + w * 0.02
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.bezierCurveTo(x + w * 0.08, h * 0.35, x + w * 0.08, h * 0.65, x, h)
        ctx.stroke()
    }

    return srgbTexture(c)
}

// ---------------------------------------------------------------------
// What the laptop shows once the lid is open
// ---------------------------------------------------------------------

/**
 * A lock screen, not a desktop. The laptop is the work object in a room that
 * is otherwise about everything else, so it says where the work is and stops.
 *
 * The mark is the real "pismo, a Visa company" lockup, rasterised to PNG and
 * imported through the bundler rather than fetched from a path — an SVG with
 * no intrinsic size draws nothing on a canvas and reports no error, which is
 * a failure worth never repeating.
 */
export function makeLaptopScreen({ w = 1600, h = 1000 } = {})
{
    const [c, ctx] = canvas(w, h)

    const draw = (logo) =>
    {
        // Drawn exactly as it will be seen: the material is unlit, so nothing
        // in the room touches these colours. A screen makes its own light, and
        // pretending otherwise is what made the lamp wash across it.
        const sky = ctx.createLinearGradient(0, 0, 0, h)
        sky.addColorStop(0, '#fbfcfd')
        sky.addColorStop(1, '#e4e9f3')
        ctx.fillStyle = sky
        ctx.fillRect(0, 0, w, h)

        const glow = ctx.createRadialGradient(w / 2, h * 0.4, 0, w / 2, h * 0.4, w * 0.46)
        glow.addColorStop(0, 'rgba(20,52,203,0.09)')
        glow.addColorStop(1, 'rgba(20,52,203,0)')
        ctx.fillStyle = glow
        ctx.fillRect(0, 0, w, h)

        if (logo)
        {
            const width = w * 0.44
            const height = width * (logo.height / logo.width)
            ctx.drawImage(logo, (w - width) / 2, h * 0.4 - height / 2, width, height)
        }

        ctx.strokeStyle = 'rgba(20,52,203,0.2)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(w * 0.36, h * 0.58)
        ctx.lineTo(w * 0.64, h * 0.58)
        ctx.stroke()

        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = '#1434CB'
        ctx.font = `600 ${Math.floor(h * 0.042)}px monospace`
        ctx.fillText(t(strings.laptopRole), w / 2, h * 0.67)

        ctx.fillStyle = 'rgba(20,24,32,0.4)'
        ctx.font = `${Math.floor(h * 0.034)}px monospace`
        ctx.fillText(t(strings.laptopDomain), w / 2, h * 0.75)

        // An empty password field: the laptop is not the point of the room
        ctx.strokeStyle = 'rgba(20,52,203,0.18)'
        ctx.lineWidth = 2
        ctx.beginPath()
        if (ctx.roundRect) ctx.roundRect(w * 0.37, h * 0.84, w * 0.26, h * 0.07, 999)
        else ctx.rect(w * 0.37, h * 0.84, w * 0.26, h * 0.07)
        ctx.stroke()
    }

    draw(null)
    const texture = srgbTexture(c)

    const image = new Image()
    image.addEventListener('load', () => { draw(image); texture.needsUpdate = true })
    image.addEventListener('error', () => console.warn('[laptop] the pismo mark did not load'))
    image.src = pismoLogo

    return texture
}

// ---------------------------------------------------------------------
// One message on the door
// ---------------------------------------------------------------------

/**
 * A post-it, written by hand.
 *
 * The text is a stranger's, so it is drawn as text and never as anything else:
 * no markup, no measurement of anything but its width. It is also short by
 * contract — the service refuses past 140 characters — which is what lets a
 * square this small stay readable.
 */
export function makeNote({ text = '', name = '', country = '', paper = PAPER, blank = false, size = 320 } = {})
{
    const [c, ctx] = canvas(size, size)

    // Paper, with the faint gradient a real one has where the glue sits
    ctx.fillStyle = paper
    ctx.fillRect(0, 0, size, size)

    const glue = ctx.createLinearGradient(0, 0, 0, size * 0.3)
    glue.addColorStop(0, 'rgba(0,0,0,0.07)')
    glue.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = glue
    ctx.fillRect(0, 0, size, size * 0.3)

    ctx.fillStyle = 'rgba(0,0,0,0.05)'
    ctx.fillRect(0, size - 3, size, 3)

    if (blank)
    {
        ctx.strokeStyle = 'rgba(40,44,52,0.35)'
        ctx.lineWidth = size * 0.018
        ctx.lineCap = 'round'
        const arm = size * 0.13
        ctx.beginPath()
        ctx.moveTo(size / 2 - arm, size / 2)
        ctx.lineTo(size / 2 + arm, size / 2)
        ctx.moveTo(size / 2, size / 2 - arm)
        ctx.lineTo(size / 2, size / 2 + arm)
        ctx.stroke()
        return srgbTexture(c)
    }

    // The message. Long ones step down a size rather than spill off the paper.
    // The bottom strip is left alone for whoever signed it and where they were.
    const ink = '#2a2d33'
    const pad = size * 0.11
    const width = size - pad * 2
    const footer = size * 0.16
    const font = text.length > 90 ? 0.082 : text.length > 50 ? 0.095 : 0.115

    ctx.fillStyle = ink
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.font = `${Math.floor(size * font)}px "Caveat", "Segoe Script", cursive`

    const lineHeight = size * font * 1.22
    const lines = []
    let line = ''
    for (const word of String(text).split(/\s+/))
    {
        const attempt = line ? `${line} ${word}` : word
        if (ctx.measureText(attempt).width > width && line)
        {
            lines.push(line)
            line = word
        }
        else line = attempt
    }
    if (line) lines.push(line)

    const top = (size - footer - lines.length * lineHeight) / 2 + lineHeight * 0.72
    lines.forEach((entry, i) => ctx.fillText(entry, pad, top + i * lineHeight))

    // Signed in the same hand as the message, because it was written on the
    // same piece of paper by the same person.
    if (name)
    {
        ctx.textAlign = 'left'
        ctx.fillStyle = 'rgba(42,45,51,0.66)'
        ctx.font = `${Math.floor(size * 0.085)}px "Caveat", "Segoe Script", cursive`
        ctx.fillText(`— ${name}`, pad, size - pad * 0.72)
    }

    if (country)
    {
        ctx.textAlign = 'right'
        ctx.fillStyle = 'rgba(42,45,51,0.42)'
        ctx.font = `600 ${Math.floor(size * 0.072)}px monospace`
        ctx.fillText(country, size - pad * 0.7, size - pad * 0.6)
    }

    return srgbTexture(c)
}
