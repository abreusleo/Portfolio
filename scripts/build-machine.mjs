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
import products from '../src/Experience/config/products.js'
import content from '../src/Experience/config/content.js'

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

/** Greedy wrap, so a paragraph stays inside the column the rules draw. */
function wrap(text, indent) {
    const lines = []
    let line = ''
    for (const word of String(text).split(' ')) {
        if (line && (line + ' ' + word).length > WIDTH) { lines.push(indent + line); line = word }
        else line = line ? line + ' ' + word : word
    }
    if (line) lines.push(indent + line)
    return lines
}

/**
 * `[label, value]` pairs, either half of which may be a { pt, en }.
 *
 * The dotted column is measured against the longest label in the group rather
 * than fixed, because one label longer than the fixed width collapses its own
 * run of dots to a single one and breaks the alignment for the whole block.
 */
function metaRows(meta, indent) {
    const pairs = (meta ?? []).map(([label, value]) => [en(label), en(value)])
    const pad = Math.max(16, ...pairs.map(([label]) => label.length + 1))
    return pairs.map(([label, value]) => indent + row(label, value, pad))
}

/**
 * One numbered entry: what it is called, what it is for, what it does, and
 * the rows under it. The same four things the panel in the room shows, which
 * is the whole point of generating this from the config the room reads.
 */
function entry(index, name, tag, body, meta) {
    const number = String(index + 1).padStart(2, '0')
    const lines = [`[${number}] ${name} — ${en(tag)}`, '']
    for (const paragraph of en(body) ?? []) lines.push(...wrap(paragraph, '     '), '')
    lines.push(...metaRows(meta, '     '))
    return [...lines, '']
}

function applications() {
    return projects.flatMap((project, i) => entry(i, project.name, project.tag, project.body, project.meta))
}

function productList() {
    return products.flatMap((product, i) => entry(i, product.name, product.tag, product.body, product.meta))
}

/** A panel's prose, as the room shows it. */
function prose(key, indent) {
    return (en(content[key].body) ?? []).flatMap((paragraph) => [...wrap(paragraph, indent ?? ''), ''])
}

/**
 * The lead line of an overview panel. Its last paragraph is the room telling
 * the visitor to click something, which means nothing on a page of text.
 */
function lead(key) {
    return wrap((en(content[key].body) ?? [])[0] ?? '', '')
}

/** The markdown twin of entry(), for llms.txt. */
function mdEntry(name, tag, body, meta) {
    const lines = [`### ${name}`, '', `_${en(tag)}_`, '']
    for (const paragraph of en(body) ?? []) lines.push(paragraph, '')
    for (const [label, value] of meta ?? []) lines.push(`- **${en(label)}** — ${en(value)}`)
    return lines.join('\n')
}

/** A panel's prose as markdown paragraphs. */
function mdProse(key) {
    return (en(content[key].body) ?? []).join('\n' + '\n')
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
    section('EXPERIENCE', [...prose('work'), ...experience()]),
    section('EDUCATION', education()),
    section('AWARDS', profile.awards.map((award) => `· ${award}`)),
    section('STACK', stack()),
    section('APPLICATIONS', [...lead('prints'), '', ...applications()]),
    section('PRODUCTS', [...lead('products'), '', ...productList()]),
    section('ABOUT', [...prose('about'), ...metaRows(content.about.meta, '')]),
    section('QUOTE', prose('board')),
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

> ${profile.role} at ${profile.company}, based in ${profile.location}.

This file, [the machine view](/machine.html) and the 3D room carry the same
content: all three are generated from one set of configs.

## Pages

- [Human view](/): an interactive 3D room, in Portuguese or English
- [Machine view](/machine.html): the same content as plain text

## Summary

${profile.summary.map((line) => `- ${line}`).join('\n')}

## Experience

${mdProse('work')}

${profile.experience.map((job) => [
    `### ${job.title} — ${job.company}`,
    '',
    `${job.employment} · ${job.from} — ${job.to}`,
    ...(job.notes.length ? ['', ...job.notes.map((note) => `- ${note}`)] : []),
].join('\n')).join('\n' + '\n')}

## Education

${profile.education.map((item) => [
    `### ${item.title} — ${item.school}`,
    '',
    `${item.from} — ${item.to}`,
    ...(item.notes.length ? ['', ...item.notes.map((note) => `- ${note}`)] : []),
].join('\n')).join('\n' + '\n')}

## Awards

${profile.awards.map((award) => `- ${award}`).join('\n')}

## Stack

${Object.entries(profile.stack).map(([group, items]) => `- **${group}** — ${items.join(', ')}`).join('\n')}

## Applications

${(en(content.prints.body) ?? [])[0]}

${projects.map((p) => mdEntry(p.name, p.tag, p.body, p.meta)).join('\n' + '\n')}

## Products

${(en(content.products.body) ?? [])[0]}

${products.map((p) => mdEntry(p.name, p.tag, p.body, p.meta)).join('\n' + '\n')}

## About

${mdProse('about')}

${content.about.meta.map(([label, value]) => `- **${en(label)}** — ${en(value)}`).join('\n')}

## Quote

${mdProse('board')}

## Links

${profile.links.filter(([, href]) => href.startsWith('http')).map(([label, href]) => `- [${label}](${href})`).join('\n')}
`

mkdirSync(join(root, 'static'), { recursive: true })
writeFileSync(join(root, 'src/machine.html'), html, 'utf8')
writeFileSync(join(root, 'static/llms.txt'), llms, 'utf8')

console.log(`machine view: ${html.length} bytes · llms.txt: ${llms.length} bytes`)
