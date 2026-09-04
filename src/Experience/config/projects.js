/**
 * The six applications shown as framed prints on the slat wall.
 *
 * Colours and marks come from the Hub portal tiles, so the wall and the portal
 * show the same identity. One entry drives both the printed art and the panel
 * text, so the wall and the copy can never drift apart. Order here is the order
 * on the wall: top row left to right, then bottom row.
 *
 * Anything a reader reads is `{ pt, en }` and goes through config/i18n.js. The
 * name of an application is not translated, and neither is a stack.
 *
 * THE COPY RULE: say what the thing is FOR, never how it was built and never a
 * feature list. Open with the plain noun phrase for what it IS, then why
 * somebody reaches for it.
 */
export default [
    {
        id: 'hub',
        name: 'Hub',
        color: '#8a8cf0',
        mark: 'hub',
        tag: {
            pt: 'Hub de autenticação e navegação entre ferramentas',
            en: 'Sign-in and the way between the tools',
        },
        body: {
            pt: [
                'Uma conta só para entrar em todas as ferramentas do servidor. Quem assina vê um portal com o que pode abrir e vai direto, sem repetir login em cada aplicação.',
                'É também onde as contas são criadas e revogadas.',
            ],
            en: [
                'One account for every tool on the server. You sign in once and land on a portal showing what you can open, with no second login on the way in.',
                'It is also where accounts are created and revoked.',
            ],
        },
        meta: [
            [{ pt: 'Stack', en: 'Stack' }, 'Go · Postgres'],
            [{ pt: 'Estado', en: 'Status' }, { pt: '62 commits · em uso', en: '62 commits · in use' }],
        ],
    },
    {
        id: 'orb',
        name: 'Orb',
        color: '#6fb5e8',
        mark: 'orb',
        tag: {
            pt: 'Agregador de feeds, vídeos e newsletters',
            en: 'One place for the feeds, videos and newsletters',
        },
        body: {
            pt: [
                'Junta num lugar só tudo o que você acompanha: sites por RSS, canais do YouTube, lives da Twitch e da Kick, comunidades do Reddit e newsletters que chegam por e-mail.',
                'Os vídeos entram numa linha do tempo que separa o que está ao vivo, o que já passou e o que está marcado. Tem modo de leitura limpa, aviso de publicação e importação da sua lista por OPML.',
            ],
            en: [
                'Everything you follow in one place: sites over RSS, YouTube channels, Twitch and Kick streams, Reddit communities and newsletters that arrive by email.',
                'Video lands on a timeline that separates what is live, what has aired and what is scheduled. Clean reading mode, publish alerts, and your existing list imports over OPML.',
            ],
        },
        meta: [
            [{ pt: 'Stack', en: 'Stack' }, 'TypeScript · SQLite'],
            [{ pt: 'Front', en: 'Front' }, 'PWA'],
            [{ pt: 'Estado', en: 'Status' }, { pt: '99 commits · o mais ativo', en: '99 commits · the busiest' }],
        ],
    },
    {
        id: 'fin',
        name: 'Fin',
        color: '#e19447',
        mark: 'fin',
        tag: {
            pt: 'Analisador de gastos com dados bancários reais',
            en: 'Spending, read from the real bank data',
        },
        body: {
            pt: [
                'Lê o extrato do seu banco e mostra para onde o dinheiro foi: por categoria, por mês, e o que mudou em relação ao mês passado. Inclui as assinaturas que passaram despercebidas.',
                'Deliberadamente determinístico, sem modelo de linguagem.',
            ],
            en: [
                'Reads your bank statement and shows where the money went: by category, by month, and what moved since last month. Including the subscriptions nobody noticed.',
                'Deliberately deterministic, with no language model in it.',
            ],
        },
        meta: [
            [{ pt: 'Stack', en: 'Stack' }, 'Go · SQLite'],
            [{ pt: 'Front', en: 'Front' }, 'React · TypeScript · three.js'],
            [{ pt: 'Instância', en: 'Instance' }, { pt: 'uma por pessoa', en: 'one per person' }],
        ],
    },
    {
        id: 'cal',
        name: 'Cal',
        color: '#f4c542',
        mark: 'cal',
        tag: {
            pt: 'Contador de calorias com estimativa por foto',
            en: 'Calorie tracking that reads a photo',
        },
        body: {
            pt: [
                'Registro do que se come no dia, com o total batendo com a meta. A entrada pode ser uma foto do prato ou uma frase, e o app estima porção e calorias a partir dela.',
                'Acompanha peso e medidas ao longo do tempo, no mesmo lugar.',
            ],
            en: [
                'What you ate today, adding up against the target. Entry can be a photo of the plate or a sentence, and the app estimates portion and calories from it.',
                'Weight and measurements are tracked over time in the same place.',
            ],
        },
        meta: [
            [{ pt: 'Stack', en: 'Stack' }, 'Go · Postgres'],
            [{ pt: 'Estado', en: 'Status' }, '18 commits'],
        ],
    },
    {
        id: 'fut',
        name: 'Fut',
        color: '#f4f8fa',
        mark: 'fut',
        tag: {
            pt: 'Prancheta tática de futebol online',
            en: 'Football tactics board, online',
        },
        body: {
            pt: [
                'Prancheta tática de futebol online. Serve para montar o time, ensaiar uma jogada e acertar o posicionamento com o pessoal, cada um na sua casa.',
                'É a prancheta da beira do campo levada para a internet. Em vez de rabiscar num quadro e torcer para todo mundo entender igual, todos abrem o mesmo campo e veem a jogada do ângulo que quiserem.',
            ],
            en: [
                'A football tactics board that works online. It is for picking the side, walking through a move and settling where everyone stands, with each of you at home.',
                'The touchline board, moved onto the internet. Instead of scribbling on one and hoping everybody read it the same way, you all open the same pitch and watch the move from whatever angle you like.',
            ],
        },
        meta: [
            [{ pt: 'Stack', en: 'Stack' }, 'Go · WebSocket · three.js'],
            [{ pt: 'Estado', en: 'Status' }, '73 commits'],
        ],
    },
    {
        id: 'lvl',
        name: 'Lvl',
        color: '#7dc98a',
        mark: 'lvl',
        tag: {
            pt: 'Orquestrador de servidores de jogos online',
            en: 'Runs the game servers',
        },
        body: {
            pt: [
                'Liga e desliga os servidores de jogo da casa sem ninguém abrir um terminal. Mostra quem está dentro, quanto a máquina aguenta e faz backup do mundo.',
                'Atende Minecraft, Factorio e Project Zomboid.',
            ],
            en: [
                'Starts and stops the house game servers without anybody opening a terminal. Shows who is on, what the box can take, and backs the world up.',
                'It serves Minecraft, Factorio and Project Zomboid.',
            ],
        },
        meta: [
            [{ pt: 'Stack', en: 'Stack' }, 'Go · Docker'],
            [{ pt: 'Jogos', en: 'Games' }, 'Minecraft · Factorio · Zomboid'],
            [{ pt: 'Estado', en: 'Status' }, { pt: 'no ar', en: 'live' }],
        ],
    },
]
