/**
 * Writes the machine view and llms.txt from the same configs the room reads.
 *
 * The machine view is a plain-text mirror for crawlers, agents and anybody who
 * prefers it raw, so it carries no JavaScript: the content has to be in the
 * HTML that ships. Generating it is what keeps that copy honest — a hand-kept
 * mirror drifts from the room within a week, and a stale mirror is worse than
 * none.
 *
 * Runs before `dev` and before `build`. See package.json.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import profile from '../src/Experience/config/profile.js'
import projects from '../src/Experience/config/projects.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const WIDTH = 62
const rule = (label) => `── ${label} ${'─'.repeat(Math.max(0, WIDTH - label.length - 4))}`

/** `key ....... value`, the shape the old hand-written page used. */
const row = (key, value, pad = 16) =>
    `${key} ${'.'.repeat(Math.max(1, pad - key.length))} ${value}`

const escape = (text) => String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

/** English is the machine view's canonical language. */
const en = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value.en : value)

function section(label, lines) {
    return [rule(label), '', ...lines, ''].join('\n')
}

function experience() {
    const lines = []
    for (const job of profile.experience) {
        lines.push(`${job.title}`)
        lines.push(`  ${job.company} · ${job.employment}`)
        lines.push(`  ${job.from} — ${job.to}`)
        for (const note of job.notes) lines.push(`  · ${note}`)
        lines.push('')
    }
    return lines.slice(0, -1)
}

function education() {
    const lines = []
    for (const item of profile.education) {
        lines.push(`${item.title}`)
        lines.push(`  ${item.school}`)
        lines.push(`  ${item.from} — ${item.to}`)
        for (const note of item.notes) lines.push(`  · ${note}`)
        lines.push('')
    }
    return lines.slice(0, -1)
}

function stack() {
    return Object.entries(profile.stack).map(([group, items]) => row(group, items.join(', '), 16))
}

/** The six applications, straight from the config the wall draws from. */
function applications() {
    return projects.map((project, index) => {
        const number = String(index + 1).padStart(2, '0')
        return `[${number}] ${project.name.padEnd(6)} ${en(project.tag)}`
    })
}

function links() {
    return profile.links.map(([label, href]) =>
        row(label, `<a href="${escape(href)}">${escape(href)}</a>`, 14))
}

const banner = `██╗     ███████╗ ██████╗ ███╗   ██╗ █████╗ ██████╗ ██████╗  ██████╗
██║     ██╔════╝██╔═══██╗████╗  ██║██╔══██╗██╔══██╗██╔══██╗██╔═══██╗
██║     █████╗  ██║   ██║██╔██╗ ██║███████║██████╔╝██║  ██║██║   ██║
██║     ██╔══╝  ██║   ██║██║╚██╗██║██╔══██║██╔══██╗██║  ██║██║   ██║
███████╗███████╗╚██████╔╝██║ ╚████║██║  ██║██║  ██║██████╔╝╚██████╔╝
╚══════╝╚══════╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝  ╚═════╝`

const body = [
    section('PROFILE', [
        row('name', profile.name),
        row('role', profile.role),
        row('company', profile.company),
        row('location', profile.location),
        '',
        ...profile.summary,
    ]),
    section('EXPERIENCE', experience()),
    section('EDUCATION', education()),
    section('AWARDS', profile.awards.map((award) => `· ${award}`)),
    section('STACK', stack()),
    section('APPLICATIONS', [
        'Six applications on one VPS. Hub is the front door; the rest live behind it.',
        '',
        ...applications(),
    ]),
    section('PRODUCTS', [
        '[01] Bios Health .. multi-tenant SaaS for running a hospital operating theatre',
        '[02] Surviving .... first-person post-apocalyptic survival game (s&box / Source 2)',
    ]),
    section('LINKS', links()),
    section('FOR_AGENTS', [
        row('llms.txt', '<a href="./llms.txt">/llms.txt</a>', 14),
        row('human view', '<a href="./">/</a>', 14),
    ]),
].join('\n')

const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Machine view — ${escape(profile.name)}</title>
    <meta name="description" content="Plain-text mirror of ${escape(profile.name)}'s portfolio for AI agents, crawlers and humans who prefer it raw.">
    <style>
        :root { --bg: #07080c; --fg: #d7dbe3; --dim: #6f7482; --accent: #3dff74; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { background: var(--bg); color: var(--fg); }
        body { font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; line-height: 1.5; padding: 2rem 1.5rem 4rem; }
        pre { white-space: pre; overflow-x: auto; }
        .banner { color: var(--accent); font-size: 11px; line-height: 1.15; margin-bottom: 1.5rem; }
        .toggle { position: fixed; top: 1rem; right: 1.2rem; font-size: 0.72rem; letter-spacing: 0.14em; }
        .toggle a { color: var(--dim); text-decoration: none; }
        .toggle a:hover { color: var(--fg); }
        .toggle .active { color: var(--accent); }
        .toggle .sep { color: var(--dim); margin: 0 0.5rem; }
        .dim { color: var(--dim); }
        a { color: var(--fg); }
    </style>
</head>
<body>
    <div class="toggle"><a href="./">HUMAN</a><span class="sep">/</span><span class="active">MACHINE</span></div>

<pre class="banner">
${banner}
</pre>

<pre>${escape(profile.handle)} :: machine-readable index
<span class="dim">a plain-text mirror of this portfolio for AI agents, crawlers, and humans who prefer it raw.
generated from the same config the 3D room reads, so the two cannot drift.</span>

${body}</pre>
</body>
</html>
`

const llms = `# ${profile.name}

> ${profile.role} at ${profile.company}. ${profile.summary[0]}

## Pages

- [Human view](/): an interactive 3D room, in Portuguese or English
- [Machine view](/machine.html): plain-text mirror of everything below

## Now

${profile.experience[0].title} at ${profile.experience[0].company}, since ${profile.experience[0].from}.
Based in ${profile.location}.

## Applications

${projects.map((p) => `- **${p.name}** — ${en(p.tag)}`).join('\n')}

## Products

- **Bios Health** — multi-tenant SaaS for running a hospital operating theatre in real time
- **Surviving** — first-person post-apocalyptic survival game, built in s&box on Source 2

## Links

${profile.links.filter(([, href]) => href.startsWith('http')).map(([label, href]) => `- [${label}](${href})`).join('\n')}
`

mkdirSync(join(root, 'static'), { recursive: true })
writeFileSync(join(root, 'src/machine.html'), html, 'utf8')
writeFileSync(join(root, 'static/llms.txt'), llms, 'utf8')

console.log(`machine view: ${html.length} bytes · llms.txt: ${llms.length} bytes`)
