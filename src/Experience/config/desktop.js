import { strings } from './i18n.js'
import steamLogo from '../../assets/icons/steam.png'

/**
 * What sits on the machine's desktop.
 *
 * Three icons, and every one of them opens something. It used to be five game
 * logos that opened nothing, which is the worst kind of icon: a visitor
 * presses it, the room does not answer, and the whole desktop reads as
 * decoration. The games did not disappear, they moved inside Steam, which is
 * where a person's games actually live.
 *
 * An icon is either a drawn mark from config/emblems.js or a `file`, which is
 * a real logo imported so the bundler gives back a URL that works in dev and
 * in the build. Both surfaces read the same field, so the icon painted on the
 * monitor and the icon in the window are always the same picture. Steam has a
 * proper logo in the project already; the other two are drawn until there are
 * files for them, and adding one is a single line here.
 *
 * The import matters. A logo pulled from static/ as an SVG comes back with no
 * intrinsic size and canvas draws nothing, silently, which is exactly how the
 * old desktop icons came up blank.
 */
export default [
    {
        id: 'steam',
        name: 'Steam',
        mark: 'steam',
        file: steamLogo,
        accent: '#66c0f4',
        window: { title: 'Biblioteca', kind: 'games' },
        label: strings.deskGames,
    },
    {
        id: 'netflix',
        name: 'Netflix',
        mark: 'netflix',
        accent: '#e50914',
        window: { title: 'Minha lista', kind: 'films' },
        label: strings.deskFilms,
    },
    {
        id: 'spotify',
        name: 'Spotify',
        mark: 'spotify',
        accent: '#1db954',
        window: { title: 'Playlist', kind: 'songs' },
        label: strings.deskSongs,
    },
]
