import projects from './projects.js'
import products from './products.js'

/**
 * Text shown in the side panel. Keys match the hotspot ids in Interactions.js.
 * The six print entries are generated from config/projects.js, so the wall and
 * the copy always describe the same thing.
 *
 * Everything a reader reads is `{ pt, en }` and is resolved through
 * config/i18n.js when the panel opens.
 */
const content = {
    products: {
        eyebrow: { pt: 'Vitrine', en: 'Showcase' },
        title: { pt: 'Produtos', en: 'Products' },
        body: {
            pt: [
                'Duas coisas que existem fora do servidor pessoal: um SaaS hospitalar e um jogo em construção.',
                'Clique para ver o detalhe.',
            ],
            en: [
                'Two things that exist outside the personal server: a hospital SaaS and a game being built.',
                'Click for the detail.',
            ],
        },
        meta: [
            [{ pt: 'Produtos', en: 'Products' }, String(products.length)],
            ...products.map((product) => [product.name, product.tag]),
        ],
    },

    prints: {
        eyebrow: { pt: 'Seis aplicações', en: 'Six applications' },
        title: { pt: 'Projetos pessoais', en: 'Personal projects' },
        body: {
            pt: [
                'Seis aplicações rodando no mesmo servidor. O Hub é a porta de entrada e os outros cinco vivem atrás dele, sem login próprio.',
                'Clique para ver o projeto.',
            ],
            en: [
                'Six applications on one server. Hub is the front door and the other five live behind it, with no login of their own.',
                'Click to see the project.',
            ],
        },
        meta: [
            [{ pt: 'Total', en: 'Total' }, { pt: '6 aplicações', en: '6 applications' }],
            ['Backend', { pt: 'Go e TypeScript', en: 'Go and TypeScript' }],
            [{ pt: 'Hospedagem', en: 'Hosting' }, { pt: 'VPS próprio', en: 'own VPS' }],
        ],
    },

    board: {
        eyebrow: { pt: 'Frase', en: 'Quote' },
        kicker: { pt: 'Sobre ideias que pareciam loucas', en: 'On ideas that looked mad' },
        title: 'Arsène Wenger',
        body: {
            pt: [
                '"The biggest things in life have been achieved by people who, at the start, we would have judged crazy. And yet if they had not had these crazy ideas the world would have been more stupid."',
                'Wenger falava de futebol, mas a frase não é sobre futebol. É sobre a distância entre parecer maluco no começo e parecer óbvio no fim.',
            ],
            en: [
                '"The biggest things in life have been achieved by people who, at the start, we would have judged crazy. And yet if they had not had these crazy ideas the world would have been more stupid."',
                'Wenger was talking about football, but the line is not about football. It is about the distance between looking mad at the start and looking obvious at the end.',
            ],
        },
        meta: [
            [{ pt: 'Autor', en: 'Author' }, 'Arsène Wenger'],
            [{ pt: 'Clube', en: 'Club' }, 'Arsenal'],
        ],
    },

    notes: {
        eyebrow: { pt: 'Recados', en: 'Notes' },
        title: { pt: 'O mural', en: 'The wall' },
        body: {
            pt: [
                'Recados de quem passou por aqui, colados na porta.',
            ],
            en: [
                'Notes from people who came through, stuck to the door.',
            ],
        },
        meta: [],
    },

    work: {
        eyebrow: { pt: 'Trabalho', en: 'Work' },
        kicker: { pt: 'Onde eu trabalho hoje', en: 'Where I work today' },
        title: 'Pismo',
        body: {
            pt: [
                'Software Engineer Backend na Pismo desde 2024, plataforma brasileira de core banking e processamento de cartões que hoje faz parte da Visa.',
                'É a camada que bancos e fintechs usam para emitir cartão, manter conta e processar transação: o tipo de sistema em que a conta precisa fechar, no volume em que fechar significa alguma coisa.',
                'Antes, três anos e oito meses na Stone Age, de estagiário a engenheiro, num SaaS que precisava escalar sem cair. O resto do que eu construo acontece fora do expediente.',
            ],
            en: [
                'Backend software engineer at Pismo since 2024, the Brazilian core banking and card processing platform that is now part of Visa.',
                'It is the layer banks and fintechs use to issue cards, hold accounts and process transactions: the kind of system where the books have to balance, at the volume that makes balancing mean something.',
                'Before that, three years and eight months at Stone Age, from intern to engineer, on a SaaS that had to scale without falling over. Everything else I build happens outside working hours.',
            ],
        },
        meta: [
            [{ pt: 'Cargo', en: 'Role' }, { pt: 'Software Engineer Backend', en: 'Backend Software Engineer' }],
            [{ pt: 'Empresa', en: 'Company' }, 'Pismo'],
            [{ pt: 'Antes', en: 'Before' }, { pt: 'Stone Age · 2021 a 2024', en: 'Stone Age · 2021 to 2024' }],
        ],
    },

    about: {
        eyebrow: { pt: 'Sobre mim', en: 'About me' },
        kicker: { pt: 'A parte que não é trabalho', en: 'The part that is not work' },
        title: 'Leonardo',
        body: {
            pt: [
                'Engenheiro da computação, carioca e tricolor.',
                'Apaixonado por esporte, competição e videogame. O fio comum é a disputa, o formato que termina com placar.',
                'Vivo entre o estudo, a disputa e a diversão.',
            ],
            en: [
                'Computer engineer, born in Rio, Fluminense supporter.',
                'In love with sport, competition and games. The thread running through them is the contest, the format that ends with a score.',
                'I live between studying, competing and having fun.',
            ],
        },
        meta: [
            [{ pt: 'Formação', en: 'Degree' }, { pt: 'Engenharia da Computação', en: 'Computer Engineering' }],
            [{ pt: 'Base', en: 'Based in' }, 'Rio de Janeiro'],
            [{ pt: 'Time', en: 'Club' }, 'Fluminense'],
            [{ pt: 'Fora do teclado', en: 'Away from the keyboard' }, { pt: 'esporte · competição · games', en: 'sport · competition · games' }],
        ],
    },
}

products.forEach((product, index) =>
{
    const number = String(index + 1).padStart(2, '0')

    content[`product.${number}`] = {
        eyebrow: { pt: `Produto · ${number}`, en: `Product · ${number}` },
        kicker: product.tag,
        title: product.name,
        body: product.body,
        meta: product.meta,
    }
})

projects.forEach((project, index) =>
{
    const number = String(index + 1).padStart(2, '0')

    content[`print.${number}`] = {
        eyebrow: { pt: `Projeto · ${number}`, en: `Project · ${number}` },
        kicker: project.tag,
        title: project.name,
        body: project.body,
        meta: project.meta,
    }
})

export default content
