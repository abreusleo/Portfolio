/**
 * What is inside the three apps on the machine.
 *
 * All three lists are written by hand and read from here, but they are shaped
 * the way a live feed would answer, so swapping one of them for real data
 * later changes where the array comes from and nothing else. The Steam side of
 * that is already designed in docs/steam-proxy.md, down to the JSON.
 *
 * Nothing here is translated. A film keeps its title, a band keeps its name,
 * and a game keeps whatever Valve calls it.
 */

/**
 * The games, shown as the vertical library art Steam serves for them.
 *
 * `appid` is all that is needed: the art comes from Valve's own CDN at
 * https://cdn.cloudflare.steamstatic.com/steam/apps/<appid>/library_600x900.jpg,
 * which is public, keyless, and the same picture the Steam client shows. Every
 * id below was looked up through Steam's own store search and each one answers
 * 200 for that image.
 *
 * `cover` overrides the id, for anything Steam has no page for: a Riot-only
 * game, or one announced but unreleased. Those need a file in static/posters/
 * instead.
 *
 * Anything with neither, or whose image fails to arrive, is drawn as a plain
 * card with its title on it. A hole in a grid of covers reads as broken; a
 * card reads as a game whose art has not turned up.
 */
export const games = [
    { id: 'rust', title: 'Rust', appid: 252490 },
    { id: 'arc', title: 'ARC Raiders', appid: 1808500 },
    // Steam's current listing for GTA V. The pre-Enhanced one is 271590 and
    // its art still resolves, if that is the edition you mean.
    { id: 'gtav', title: 'Grand Theft Auto V', appid: 3240220 },
    { id: 'factorio', title: 'Factorio', appid: 427520 },
    { id: 'satisfactory', title: 'Satisfactory', appid: 526870 },
    { id: 'finals', title: 'THE FINALS', appid: 2073850 },
]

/**
 * Films and series, shown as posters.
 *
 * There is no open source of poster art the way there is for games, so each
 * one is a file dropped in static/posters/ under the name below. Same fallback
 * as the games: a missing file becomes a card with the title and the year, so
 * the window is never broken while the art is still being gathered.
 *
 * `kind` is 'film' or 'series' and only feeds the small label under the cover.
 *
 * A title is normally left alone, the way a band's name is. The exception is a
 * show that genuinely goes by a different name in each place, and for those the
 * usual { pt, en } pair works: writing only the English one would leave a
 * Brazilian reading a title nobody here uses, and only the Portuguese one does
 * the same to everybody else.
 */
export const films = [
    { id: 'inception', title: 'Inception', year: 2010, kind: 'film', poster: 'inception.jpg' },
    { id: 'interstellar', title: 'Interstellar', year: 2014, kind: 'film', poster: 'interstellar.jpg' },
    { id: 'family-guy', title: 'Family Guy', year: 1999, kind: 'series', poster: 'family-guy.jpg' },
    { id: 'la-casa-de-papel', title: 'La Casa de Papel', year: 2017, kind: 'series', poster: 'la-casa-de-papel.jpg' },
    { id: 'brooklyn-99', title: 'Brooklyn Nine-Nine', year: 2013, kind: 'series', poster: 'brooklyn-99.jpg' },
    {
        id: 'chris',
        title: { pt: 'Todo Mundo Odeia o Chris', en: 'Everybody Hates Chris' },
        year: 2005,
        kind: 'series',
        poster: 'todo-mundo-odeia-o-chris.jpg',
    },
]

/**
 * The playlist. Text only, on purpose: album art would need the same gathering
 * the posters need, and a list of songs reads perfectly well as a list.
 */
export const songs = [
    { title: 'Too Sweet', artist: 'Hozier' },
    { title: 'Baile Inolvidable', artist: 'Bad Bunny' },
    { title: 'The One That Got Away', artist: 'Katy Perry' },
    { title: 'I Want It That Way', artist: 'Backstreet Boys' },
    { title: 'Mockingbird', artist: 'Eminem' },
]

/** Where Valve keeps the vertical library art. */
export const STEAM_ART = (appid) =>
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/library_600x900.jpg`
