/**
 * The two things that exist outside the personal server.
 *
 * Same job as config/projects.js and the same rule: one entry drives the panel
 * in the room, the machine view and llms.txt, so the three cannot describe the
 * same product differently. They used to be written by hand inside
 * scripts/build-machine.mjs, which is precisely the drift that script exists
 * to prevent.
 *
 * Anything a reader reads is `{ pt, en }` and goes through config/i18n.js. The
 * name of a product is not translated, and neither is a stack.
 *
 * THE COPY RULE, as in config/projects.js: say what the thing is FOR, never
 * how it was built and never a feature list.
 */
export default [
    {
        id: 'bios',
        name: 'Bios Health',
        tag: { pt: 'SaaS de centro cirúrgico', en: 'Operating theatre SaaS' },
        body: {
            pt: [
                'Plataforma multiempresa para gerir o centro cirúrgico de um hospital em tempo real. Acompanha a jornada inteira do paciente: agendamento, pré-operatório, cirurgia, recuperação na SRPA e alta.',
                'Tudo isso vira um painel ao vivo para a diretoria, no lugar de planilha e relatório mensal. Documentos em PDF são lidos por visão computacional e viram dado estruturado sozinhos.',
            ],
            en: [
                'A multi-tenant platform for running a hospital operating theatre in real time. It follows the whole patient journey: scheduling, pre-op, surgery, recovery and discharge.',
                'All of it becomes a live board for the executive team, in place of a spreadsheet and a monthly report. PDFs are read by computer vision and turn into structured data on their own.',
            ],
        },
        meta: [
            ['Backend', 'Go · MySQL'],
            ['Frontend', 'Next.js · React · TypeScript'],
            ['Infra', 'Terraform · Kubernetes'],
            [{ pt: 'Estado', en: 'Status' }, { pt: '1.000+ commits', en: '1,000+ commits' }],
        ],
    },
    {
        id: 'surviving',
        name: 'Surviving',
        tag: { pt: 'Jogo de sobrevivência', en: 'Survival game' },
        body: {
            pt: [
                'Jogo de sobrevivência em primeira pessoa, pós-apocalíptico e com zumbis, para multiplayer assimétrico. A frase que resume é do próprio documento de design: sobreviva num mundo que quer te matar, com zumbis, o ambiente e às vezes outros jogadores.',
                'O ciclo é avaliar fome, sede, temperatura, saúde e sanidade, sair para explorar e saquear, fabricar e reparar, e fortalecer uma posição antes da noite. Recursos escassos e morte permanente. O PvP existe, mas nunca é incentivado.',
            ],
            en: [
                'A first-person post-apocalyptic survival game with zombies, built for asymmetric multiplayer. The line that sums it up comes from its own design document: survive a world that wants you dead — the zombies, the environment, and sometimes the other players.',
                'The loop is reading hunger, thirst, temperature, health and sanity, going out to explore and loot, crafting and repairing, and hardening a position before night. Scarce resources and permanent death. PvP exists but is never encouraged.',
            ],
        },
        meta: [
            [{ pt: 'Motor', en: 'Engine' }, 's&box · Source 2'],
            [{ pt: 'Linguagem', en: 'Language' }, 'C#'],
            [{ pt: 'Estado', en: 'Status' }, { pt: 'em construção · repositório aberto', en: 'in progress · open repository' }],
        ],
    },
]
