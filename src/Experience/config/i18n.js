import EventEmitter from '../Utils/EventEmitter.js'

/**
 * Two languages, one source.
 *
 * Every translatable value in this project is an object keyed by language and
 * read through `t()`. Keeping both languages side by side in the same entry is
 * deliberate: parallel files drift, and a portfolio in two languages where one
 * of them is a year out of date is worse than one language.
 *
 * The scene's own text lives in canvas textures, so a change here has to reach
 * further than the DOM. Modules that draw words expose `retext()` and are
 * called on change; nothing is rebuilt and nothing reloads.
 */

export const LANGUAGES = ['pt', 'en']

const STORAGE_KEY = 'basement.lang'

/** UI chrome: everything that is not project copy. */
export const strings = {
    loading: { pt: 'iniciando', en: 'starting' },
    ready: { pt: 'pronto', en: 'ready' },
    enter: { pt: 'ENTRAR', en: 'ENTER' },

    modeAsk: {
        pt: 'A sala foi feita para tela grande. No celular, como você prefere ver?',
        en: 'The room was made for a big screen. On a phone, how would you rather see it?',
    },
    modePerformance: { pt: 'PERFORMANCE', en: 'PERFORMANCE' },
    modeQuality: { pt: 'QUALIDADE', en: 'QUALITY' },
    modePerformanceHint: { pt: 'mais leve', en: 'lighter' },
    modeQualityHint: { pt: 'mais bonita', en: 'better looking' },
    modeSwitch: { pt: 'Imagem', en: 'Image' },

    openingLine: {
        pt: 'Uma sala com o que eu construí dentro.',
        en: 'A room with the things I have built in it.',
    },
    openingSkip: { pt: 'toque para entrar', en: 'tap to enter' },
    openingSkipDesk: { pt: 'clique para entrar', en: 'click to enter' },
    role: { pt: 'Software Engineer Backend', en: 'Backend Software Engineer' },

    explore: { pt: 'EXPLORAR', en: 'EXPLORE' },
    exploreBack: { pt: 'VOLTAR', en: 'BACK' },
    hintIdle: { pt: 'F explorar · ESC voltar', en: 'F to explore · ESC to go back' },
    hintFly: {
        pt: 'WASD mover · Space / Shift subir e descer · ESC voltar',
        en: 'WASD to move · Space / Shift up and down · ESC to go back',
    },

    back: { pt: 'VOLTAR', en: 'BACK' },
    close: { pt: 'FECHAR', en: 'CLOSE' },
    exit: { pt: 'SAIR', en: 'EXIT' },
    previous: { pt: 'Anterior', en: 'Previous' },
    next: { pt: 'Próximo', en: 'Next' },

    videoMissing: { pt: 'Demonstração ainda não publicada', en: 'Demo not published yet' },

    // Hotspot tooltips
    seeShelves: { pt: 'Produtos', en: 'Products' },
    seeProjects: { pt: 'Projetos pessoais', en: 'Personal projects' },
    seeVideos: { pt: 'Demonstração', en: 'Demo' },
    useComputer: { pt: 'PC', en: 'PC' },
    seeWork: { pt: 'Trabalho', en: 'Work' },
    seeAbout: { pt: 'Sobre mim', en: 'About me' },
    seeDetail: { pt: 'Detalhe', en: 'Detail' },
    seeNotes: { pt: 'Recados', en: 'Notes' },
    writeNote: { pt: 'Deixar um recado', en: 'Leave a note' },

    // The composer
    composeTitle: { pt: 'Deixe um recado', en: 'Leave a note' },
    composeHint: {
        pt: 'Fica na porta, para quem vier depois.',
        en: 'It goes on the door, for whoever comes next.',
    },
    composePlaceholder: { pt: 'escreva aqui…', en: 'write here…' },
    composeNamePlaceholder: { pt: 'seu nome (opcional)', en: 'your name (optional)' },
    readNote: { pt: 'ler o recado', en: 'read the note' },
    unsigned: { pt: 'sem assinatura', en: 'unsigned' },

    // The machine's desktop
    deskGames: { pt: 'jogos favoritos', en: 'favourite games' },
    deskFilms: { pt: 'filmes e séries', en: 'films and series' },
    deskSongs: { pt: 'músicas favoritas', en: 'favourite songs' },
    deskEmpty: { pt: 'nada aqui ainda', en: 'nothing here yet' },
    deskReadme: { pt: 'leia-me.txt', en: 'readme.txt' },
    deskIntro: {
        pt: [
            'Esses são mais alguns dos meus interesses.',
            'Clique nos ícones: o que eu jogo, o que eu assisto e o que eu ouço.',
        ],
        en: [
            'A few more of the things I am into.',
            'Click the icons: what I play, what I watch and what I listen to.',
        ],
    },
    deskFilm: { pt: 'filme', en: 'film' },
    deskSeries: { pt: 'série', en: 'series' },
    eggsLabelOne: { pt: 'segredo encontrado', en: 'secret found' },
    eggsLabelMany: { pt: 'segredos encontrados', en: 'secrets found' },
    composeFull: {
        pt: 'A porta está cheia. O seu entra do mesmo jeito.',
        en: 'The door is full. Yours goes up all the same.',
    },
    placeHint: {
        pt: 'Arraste o post-it para onde quiser colar',
        en: 'Drag the note where you want it',
    },
    composeSend: { pt: 'COLAR NA PAREDE', en: 'STICK IT ON' },
    composeSending: { pt: 'COLANDO…', en: 'STICKING…' },
    composeThanks: { pt: 'Colado. Obrigado por passar.', en: 'Stuck. Thanks for stopping by.' },
    composeOffline: {
        pt: 'O mural está fora do ar agora. Tente daqui a pouco.',
        en: 'The wall is offline right now. Try again in a bit.',
    },

    // Drawn into the scene
    tvTitle: { pt: 'PORTFÓLIO', en: 'PORTFOLIO' },
    tvCount: { pt: 'vídeos', en: 'videos' },
    tvHint: { pt: 'clique na TV para assistir', en: 'click the TV to watch' },
    laptopRole: { pt: 'SOFTWARE ENGINEER BACKEND', en: 'BACKEND SOFTWARE ENGINEER' },
    laptopDomain: { pt: 'core banking e cartões', en: 'core banking and cards' },

    // The first walk through the room
    tourNext: { pt: 'SEGUIR', en: 'NEXT' },
    tourSkip: { pt: 'PULAR', en: 'SKIP' },
    tourDone: { pt: 'COMEÇAR', en: 'START' },

    // The menu
    menuOpen: { pt: 'IR PARA', en: 'GO TO' },
    menuTitle: { pt: 'Lugares da sala', en: 'Places in the room' },
    menuClose: { pt: 'Fechar menu', en: 'Close menu' },
    menuAll: { pt: 'ver todos', en: 'see all' },

    langLabel: { pt: 'Idioma', en: 'Language' },
}

class Locale extends EventEmitter
{
    constructor()
    {
        super()
        this.current = this.initial()
    }

    /** `?lang=` wins, then what was chosen before, then the browser. */
    initial()
    {
        const asked = new URLSearchParams(window.location.search).get('lang')
        if (LANGUAGES.includes(asked)) return asked

        try
        {
            const stored = window.localStorage.getItem(STORAGE_KEY)
            if (LANGUAGES.includes(stored)) return stored
        }
        catch (error)
        {
            // Private windows throw on storage. A default is fine.
        }

        return String(navigator.language || '').toLowerCase().startsWith('pt') ? 'pt' : 'en'
    }

    set(language)
    {
        if (!LANGUAGES.includes(language) || language === this.current) return

        this.current = language
        document.documentElement.lang = language === 'pt' ? 'pt-BR' : 'en'

        try
        {
            window.localStorage.setItem(STORAGE_KEY, language)
        }
        catch (error)
        {
            // Not being able to remember the choice is not a reason to refuse it.
        }

        this.trigger('change', language)
    }

    toggle()
    {
        this.set(this.current === 'pt' ? 'en' : 'pt')
    }

    /**
     * Reads a translatable value. Anything that is not an object keyed by
     * language passes through untouched, so a shared value — a name, a stack,
     * a number — needs no ceremony.
     */
    t(value)
    {
        if (value === null || typeof value !== 'object') return value
        if (Array.isArray(value)) return value.map((item) => this.t(item))
        if (this.current in value) return value[this.current]
        return value
    }
}

export const locale = new Locale()

/** Shorthand, because this is read far more often than it is written. */
export const t = (value) => locale.t(value)
