/**
 * The Hub portal emblems, copied op for op from hub-web/templates/portal.html.
 * Every shape lives in a 44 x 44 box with a stroke width of 2.
 *
 * Shared on purpose: the framed prints draw them on canvas and the desktop
 * draws them as SVG, so both surfaces show the same mark.
 */
export const EMBLEMS = {
    hub: [
        { rect: [11, 11, 22, 22, 6] },
        { circle: [22, 22, 3.4], fill: true },
    ],
    orb: [
        { circle: [22, 22, 8] },
        { ellipse: [22, 22, 16, 6.5, -20] },
        { circle: [36.5, 16.5, 2.2], fill: true },
    ],
    fin: [
        { rect: [6, 9, 32, 26, 5] },
        { path: 'M12 28 L18 22 L24 25.5 L32 15' },
        { circle: [32, 15, 2.6], fill: true },
    ],
    cal: [
        { path: 'M22 8 C 24 13 30 17 30 24 A 8 8 0 0 1 14 24 C 14 17 20 13 22 8 Z' },
        { path: 'M22 21 C 23 23.5 26 24.5 26 27.5 A 4 4 0 0 1 18 27.5 C 18 24.5 21 23.5 22 21 Z', fill: true },
    ],
    fut: [
        { rect: [9, 12, 26, 20, 2] },
        { path: 'M22 12v20' },
        { circle: [22, 22, 4] },
        { circle: [22, 22, 1.6], fill: true },
    ],
    lvl: [
        { path: 'M13 21l9-8 9 8' },
        { path: 'M13 30l9-8 9 8' },
    ],

    // The three on the machine's desktop. Drawn here rather than shipped as
    // logo files: the same ops paint the monitor's canvas and the window in
    // the overlay, so the icon on the screen in the room and the icon you
    // click are the same drawing, and no trademark image lives in the repo.
    steam: [
        { circle: [22, 22, 15] },
        { circle: [27.5, 17, 6] },
        { circle: [27.5, 17, 2.4], fill: true },
        { circle: [15, 28, 4.6] },
        { path: 'M11.5 24.5 L23 18.5' },
    ],
    netflix: [
        { path: 'M13 7 h6.5 v30 H13 Z', fill: true },
        { path: 'M24.5 7 H31 v30 h-6.5 Z', fill: true },
        { path: 'M13 7 h6.5 L31 37 h-6.5 Z', fill: true },
    ],
    // A sheet of paper with writing on it, for the note that opens with the
    // desktop. Drawn rather than fetched, like the rest of these.
    txt: [
        { path: 'M12 6 h14 l6 6 v26 H12 Z' },
        { path: 'M26 6 v6 h6' },
        { path: 'M17 20 h12 M17 26 h12 M17 32 h7' },
    ],
    spotify: [
        { circle: [22, 22, 15] },
        { path: 'M13.5 16.5 C 19.5 14.5, 26.5 15.5, 31.5 18.5' },
        { path: 'M15 22 C 20 20.5, 25.5 21.5, 29.5 24' },
        { path: 'M16.5 27 C 20.5 26, 24.5 26.5, 27.5 29' },
    ],
}

/** Same ops, rendered as inline SVG for the DOM. */
export function emblemSvg(mark, size = 44)
{
    const ops = EMBLEMS[mark]
    if (!ops) return ''

    const shapes = ops.map((op) =>
    {
        const fill = op.fill ? 'fill="currentColor" stroke="none"' : ''

        if (op.rect)
        {
            const [x, y, w, h, r] = op.rect
            return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ${fill}/>`
        }
        if (op.circle)
        {
            const [x, y, r] = op.circle
            return `<circle cx="${x}" cy="${y}" r="${r}" ${fill}/>`
        }
        if (op.ellipse)
        {
            const [x, y, rx, ry, rotation] = op.ellipse
            return `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(${rotation} ${x} ${y})" ${fill}/>`
        }
        if (op.path) return `<path d="${op.path}" ${fill}/>`
        return ''
    })

    return `<svg viewBox="0 0 44 44" width="${size}" height="${size}" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes.join('')}</svg>`
}

/**
 * Same ops, drawn onto a 2D canvas. Shared by the framed prints and the TV
 * menu so a mark is never redrawn by hand for a second surface.
 */
export function drawEmblem(ctx, ops, cx, cy, size, color)
{
    if (!ops) return

    const scale = size / 44

    ctx.save()
    ctx.translate(cx - size / 2, cy - size / 2)
    ctx.scale(scale, scale)
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    for (const op of ops)
    {
        ctx.beginPath()

        if (op.rect)
        {
            const [x, y, w, h, r] = op.rect
            if (ctx.roundRect) ctx.roundRect(x, y, w, h, r)
            else ctx.rect(x, y, w, h)
        }
        else if (op.circle)
        {
            const [x, y, r] = op.circle
            ctx.arc(x, y, r, 0, Math.PI * 2)
        }
        else if (op.ellipse)
        {
            const [x, y, rx, ry, rotation] = op.ellipse
            ctx.ellipse(x, y, rx, ry, (rotation * Math.PI) / 180, 0, Math.PI * 2)
        }
        else if (op.path)
        {
            const path = new Path2D(op.path)
            if (op.fill) ctx.fill(path)
            else ctx.stroke(path)
            continue
        }

        if (op.fill) ctx.fill()
        else ctx.stroke()
    }

    ctx.restore()
}
