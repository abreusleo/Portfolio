/**
 * Cache for the second visit. Generated into dist/ by scripts/build-sw.mjs,
 * which stamps the two versions below; never edit the copy in dist/.
 *
 * Cache-first, and only for the things whose bytes cannot change without
 * their name or their version changing with them. The HTML is deliberately
 * not among them: it is the one file that names all the others, so a stale
 * copy of it is a stale site, and it is small enough that the network costs
 * nothing. Nothing is downloaded ahead of being asked for either — a first
 * visit fills the cache with exactly what the room used, at no extra cost,
 * where a precache would spend megabytes on files this visitor may never
 * need while the room is still loading.
 *
 * Two caches rather than one because they go stale on different clocks. The
 * bundles change whenever a line of code does; the models and decoders sit
 * still for months. Sharing a version would throw away six megabytes of
 * models every time a paragraph was reworded.
 */
const CACHES = {
    assets: 'room-assets-__ASSETS_VERSION__',
    media: 'room-media-__MEDIA_VERSION__',
}

const ROUTES = [
    ['assets/', 'assets'],
    ['models/', 'media'],
    ['draco/', 'media'],
    ['basis/', 'media'],
    ['posters/', 'media'],
]

/** Resolved against the registration, so a base path other than / still works. */
const routes = ROUTES.map(([path, cache]) => [new URL(path, self.registration.scope).pathname, cache])

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) =>
{
    event.waitUntil((async () =>
    {
        // Only this worker's own caches: something else on the origin may
        // have its own, and deleting those is not this one's business.
        const keep = new Set(Object.values(CACHES))
        const names = await caches.keys()
        await Promise.all(names.map((name) =>
            (name.startsWith('room-') && !keep.has(name)) ? caches.delete(name) : undefined))

        // Take over the page that just loaded rather than waiting for every
        // tab to close. The alternative leaves a visitor running new code
        // against the previous deploy's models for as long as they keep a
        // tab open, which is the worse of the two failures.
        await self.clients.claim()
    })())
})

self.addEventListener('fetch', (event) =>
{
    const request = event.request
    if (request.method !== 'GET') return

    const url = new URL(request.url)
    if (url.origin !== self.location.origin) return

    const route = routes.find(([prefix]) => url.pathname.startsWith(prefix))
    if (!route) return

    event.respondWith(cacheFirst(request, CACHES[route[1]]))
})

async function cacheFirst(request, cacheName)
{
    const cache = await caches.open(cacheName)

    const hit = await cache.match(request)
    if (hit) return hit

    const response = await fetch(request)

    // A redirect, a 404 or a partial kept in the cache is a broken asset
    // served for as long as the version holds, which is far worse than the
    // round trip it saves. Only a plain same-origin 200 is worth keeping.
    if (response.ok && response.type === 'basic' && response.status === 200)
    {
        cache.put(request, response.clone())
    }

    return response
}
