/**
 * Quality switches, read from the query string.
 *
 * They exist because the machine that is slow is not the machine this is
 * written on. Throttling a desktop CPU leaves its GPU untouched, and a phone's
 * GPU is a different shape of thing — tile based, where a full-screen pass and
 * an MSAA resolve cost a proportion no amount of measuring here reproduces.
 * Two runs of the same configuration here disagreed by three milliseconds,
 * which is wider than the differences worth ranking.
 *
 * So the ranking is done on the device, by the person holding it, with `?perf`
 * showing the number. Each switch turns off one suspect:
 *
 *   ?dpr=1.5   render fewer pixels
 *   ?msaa=0    drop the multisampling on the composer's two targets
 *   ?bloom=0   drop the bloom pyramid and its ten passes
 *   ?blur=0    drop every backdrop-filter, which composite live over the scene
 *   ?fovcap=N  how wide the camera may open on a narrow screen. This one is
 *              not a quality setting but a framing one, and it turned out to
 *              be the heaviest of the lot: widening the view to fit the room
 *              on a phone took the overview station from 138 draw calls and
 *              249k triangles to 574 and 1.08M. Everything being on screen is
 *              exactly what costs.
 *
 * Whatever wins becomes the default for phones. Until then nothing changes for
 * anybody: absent a switch, every value below is what the room already used.
 */
const params = new URLSearchParams(window.location.search)

function number(name, fallback)
{
    const raw = params.get(name)
    if (raw === null) return fallback

    const value = parseFloat(raw)
    return Number.isFinite(value) ? value : fallback
}

/** `?x=0` is off, `?x` alone or any other value is on. */
function flag(name, fallback)
{
    if (!params.has(name)) return fallback
    return params.get(name) !== '0'
}

export const quality = {
    pixelRatio: number('dpr', null),
    samples: number('msaa', null),
    bloom: flag('bloom', true),
    fovCap: number('fovcap', null),
    blur: flag('blur', true),
}
