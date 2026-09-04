/**
 * Stamps scripts/sw-template.js with content versions and writes dist/sw.js.
 *
 * Runs after `build`, over the built output rather than over the sources,
 * because the version has to answer one question: could any byte a visitor
 * has cached have changed? Only dist knows that — the bundle names carry
 * hashes Vite computes during the build, and a model swapped in static/
 * lands here too.
 *
 * A worker whose bytes are identical is not reinstalled by the browser, so
 * a build that changed nothing cacheable leaves every visitor's cache alone;
 * one that changed a model produces a different media version, and the old
 * cache is dropped on activate. That is the whole invalidation story, and it
 * is why the version is derived rather than written by hand: a version
 * somebody has to remember to bump is a version that ships stale.
 *
 * See package.json.
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')

/** The directories each cache is responsible for, mirroring ROUTES in the template. */
const GROUPS = {
    ASSETS: ['assets'],
    MEDIA: ['models', 'draco', 'basis', 'posters'],
}

function walk(dir)
{
    let out = []
    let entries
    try
    {
        entries = readdirSync(dir)
    }
    catch
    {
        // A group with no directory in this build contributes nothing rather
        // than failing it: posters could be dropped and the build stands.
        return out
    }
    for (const entry of entries.sort())
    {
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) out = out.concat(walk(full))
        else out.push(full)
    }
    return out
}

/**
 * Name and content of every file in the group, in a stable order. Names alone
 * would miss a model replaced in place, which is the exact mistake that
 * serves a stale room.
 */
function version(dirs)
{
    const hash = createHash('sha256')
    for (const dir of dirs)
    {
        for (const file of walk(join(dist, dir)))
        {
            hash.update(relative(dist, file).split(sep).join('/'))
            hash.update(readFileSync(file))
        }
    }
    return hash.digest('hex').slice(0, 12)
}

let sw = readFileSync(join(root, 'scripts/sw-template.js'), 'utf8')
const stamped = {}

for (const [name, dirs] of Object.entries(GROUPS))
{
    stamped[name] = version(dirs)
    sw = sw.replace(`__${name}_VERSION__`, stamped[name])
}

const left = sw.match(/__[A-Z_]+__/)
if (left) throw new Error(`sw-template.js has an unstamped placeholder: ${left[0]}`)

writeFileSync(join(dist, 'sw.js'), sw, 'utf8')

console.log(`sw.js  assets ${stamped.ASSETS}  media ${stamped.MEDIA}`)
