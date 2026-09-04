/**
 * Registers the cache worker, which is what makes a second visit cheap.
 *
 * Production only. Against the dev server a worker holding onto module URLs
 * is a debugging trap that costs more hours than it ever saves seconds, and
 * there is nothing to save there anyway.
 *
 * `?nosw` is the way out. A worker that starts serving something wrong keeps
 * serving it, and a site that can only be fixed by talking somebody through
 * their browser's storage settings is a site with no fix at all.
 */
const base = import.meta.env.BASE_URL
const GUARD = 'basement.nosw'

async function unregister()
{
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map((registration) => registration.unregister()))
}

async function drop()
{
    const names = await caches.keys()
    await Promise.all(names.map((name) => (name.startsWith('room-') ? caches.delete(name) : undefined)))
}

/**
 * Unregistering does not evict the worker from the page it is already
 * controlling: it goes on answering this load's requests, and each answer it
 * caches lands after the delete, which is how a first attempt leaves the
 * caches it just emptied full again. So when the page is still controlled,
 * reload once. `?nosw` survives the reload and the second pass runs
 * uncontrolled, where the deletion is final; the guard is what keeps that
 * from becoming a loop.
 */
async function eject()
{
    await unregister()
    await drop()

    if (navigator.serviceWorker.controller && !sessionStorage.getItem(GUARD))
    {
        sessionStorage.setItem(GUARD, '1')
        window.location.reload()
        return
    }

    sessionStorage.removeItem(GUARD)
}

if ('serviceWorker' in navigator)
{
    if (new URLSearchParams(window.location.search).has('nosw'))
    {
        eject().catch((error) => console.warn('[sw] could not eject', error))
    }
    else if (import.meta.env.PROD)
    {
        // After load: registering competes with the room's own downloads for
        // the connection, and the room is what the visitor is waiting for.
        window.addEventListener('load', () =>
        {
            navigator.serviceWorker
                .register(`${base}sw.js`, { scope: base })
                .catch((error) => console.warn('[sw] registration failed', error))
        })
    }
}
