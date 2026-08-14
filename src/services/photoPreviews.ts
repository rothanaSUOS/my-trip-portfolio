/**
 * Local stand-ins for photos that are committed but not yet fetchable.
 *
 * Uploading writes the file to the repo, but the site can only *serve* it after
 * the Pages deploy finishes — and on a dev server, never, since the file went to
 * GitHub rather than to the local `public/` folder. Either way the freshly saved
 * trip would render a broken image for the next minute or forever.
 *
 * So each upload also stashes a small data URL here, keyed by the repo path it
 * was committed to. `resolvePhotoUrl` prefers it, and it is dropped once the
 * deployed data catches up — see `prunePreviews`.
 */

const KEY = 'wanderlog.previews.v1'

/** Repo path (`photos/2019-tokyo-01.jpg`) → data URL. */
type PreviewMap = Record<string, string>

function read(): PreviewMap {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}

    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === 'object' ? (parsed as PreviewMap) : {}
  } catch {
    return {}
  }
}

function write(previews: PreviewMap): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(previews))
  } catch {
    // Over quota — previews are a nicety, so drop them all rather than leaving
    // a half-written map behind. The photo still loads once deployed.
    try {
      localStorage.removeItem(KEY)
    } catch {
      // Storage is unavailable entirely; nothing to clean up.
    }
  }
}

/** In-memory mirror so `resolvePhotoUrl` stays synchronous and cheap. */
let cache: PreviewMap | null = null

function load(): PreviewMap {
  cache ??= read()
  return cache
}

export function getPreview(path: string): string | undefined {
  return load()[path]
}

export function setPreview(path: string, dataUrl: string): void {
  const previews = { ...load(), [path]: dataUrl }
  cache = previews
  write(previews)
}

/**
 * Drop previews whose photos are now genuinely reachable. Called with the set of
 * paths still awaiting deploy — anything else has landed and can go.
 */
export function prunePreviews(stillPending: Set<string>): void {
  const previews = load()
  const kept: PreviewMap = {}
  let changed = false

  for (const [path, dataUrl] of Object.entries(previews)) {
    if (stillPending.has(path)) kept[path] = dataUrl
    else changed = true
  }

  if (!changed) return

  cache = kept
  write(kept)
}
