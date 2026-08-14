import { readFile, writeFile, encodeText, encodeBytes, type GitHubConfig } from '@/services/github'
import { prunePreviews } from '@/services/photoPreviews'
import { loadConfig } from '@/services/settings'
import type { Trip } from '@/types/trip'

/**
 * Trip storage.
 *
 * The source of truth is `public/trips.json` **in the repo**. The site fetches
 * the deployed copy to render, and the editor commits changes back through the
 * GitHub API. Saving a trip is therefore a real publish — no code editing, no
 * export step.
 *
 * The one wrinkle is latency: a commit takes ~1 minute to rebuild and deploy, so
 * between saving and seeing it live the deployed JSON is still stale. Saved
 * trips are held in a small localStorage "pending" layer and merged over the
 * fetched data so the UI updates instantly, then dropped automatically once the
 * deployed file catches up. `pendingCount()` drives the "deploying" banner.
 */

const DATA_PATH = 'public/trips.json'
const PENDING_KEY = 'wanderlog.pending.v1'

interface Pending {
  /** Trips saved locally, keyed by id, awaiting deploy. */
  saved: Record<string, Trip>
  /** Ids deleted locally, awaiting deploy. */
  deleted: string[]
}

const EMPTY: Pending = { saved: {}, deleted: [] }

// ── Pending layer ──────────────────────────────────────────────────────────

function readPending(): Pending {
  try {
    const raw = localStorage.getItem(PENDING_KEY)
    if (!raw) return { saved: {}, deleted: [] }

    const parsed = JSON.parse(raw) as Partial<Pending>
    return {
      saved: parsed.saved && typeof parsed.saved === 'object' ? parsed.saved : {},
      deleted: Array.isArray(parsed.deleted) ? parsed.deleted : [],
    }
  } catch {
    return { ...EMPTY }
  }
}

function writePending(pending: Pending): void {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(pending))
  } catch {
    // Only cross-reload persistence is lost; this session still works.
  }
}

/** How many local changes have not yet appeared in the deployed data. */
export function pendingCount(): number {
  const pending = readPending()
  return Object.keys(pending.saved).length + pending.deleted.length
}

// ── Reading ────────────────────────────────────────────────────────────────

/**
 * The deployed trip list, with any not-yet-deployed local changes merged in.
 *
 * Reads the *deployed* `trips.json` rather than asking GitHub, so visitors need
 * no token and the common case costs one static file fetch.
 */
export async function loadTrips(): Promise<Trip[]> {
  const remote = await fetchDeployedTrips()
  const pending = readPending()

  // Drop pending entries the deploy has caught up with, so the banner clears
  // itself and a later edit in the repo is not masked forever by stale local state.
  const remoteById = new Map(remote.map((trip) => [trip.id, trip]))
  let changed = false

  for (const [id, trip] of Object.entries(pending.saved)) {
    const live = remoteById.get(id)
    if (live && JSON.stringify(live) === JSON.stringify(trip)) {
      delete pending.saved[id]
      changed = true
    }
  }

  pending.deleted = pending.deleted.filter((id) => {
    const stillThere = remoteById.has(id)
    if (!stillThere) changed = true
    return stillThere
  })

  if (changed) writePending(pending)

  // Photo stand-ins are only needed while their trip is still awaiting deploy.
  prunePreviews(
    new Set(
      Object.values(pending.saved).flatMap((trip) => trip.photos.map((photo) => photo.url)),
    ),
  )

  const deleted = new Set(pending.deleted)
  const merged = remote.filter((trip) => !deleted.has(trip.id)).map((trip) => pending.saved[trip.id] ?? trip)

  // Pending trips that do not exist remotely yet are additions.
  const additions = Object.values(pending.saved).filter((trip) => !remoteById.has(trip.id))

  return [...merged, ...additions]
}

/** Fetch the deployed `trips.json`. Cache-busted so a fresh deploy is seen. */
async function fetchDeployedTrips(): Promise<Trip[]> {
  const base = import.meta.env.BASE_URL || '/'
  const url = `${base.replace(/\/$/, '')}/trips.json?t=${Date.now()}`

  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error(`Could not load trips.json (${response.status})`)

  const data = (await response.json()) as unknown
  if (!Array.isArray(data)) throw new Error('trips.json is not an array')

  return data as Trip[]
}

// ── Writing ────────────────────────────────────────────────────────────────

function requireConfig(): GitHubConfig {
  const config = loadConfig()
  if (!config) throw new Error('Connect a GitHub repository in Settings before saving.')
  return config
}

/**
 * Commit a trip. Reads the repo's current `trips.json`, applies the change and
 * writes it back with the sha it read, so a concurrent edit from another device
 * fails loudly rather than being silently clobbered.
 */
export async function saveTrip(trip: Trip): Promise<void> {
  const config = requireConfig()
  const { trips, sha } = await readRepoTrips(config)

  const index = trips.findIndex((existing) => existing.id === trip.id)
  const isNew = index === -1

  if (isNew) trips.push(trip)
  else trips[index] = trip

  await commitTrips(
    config,
    trips,
    sha,
    `${isNew ? 'Add' : 'Update'} trip: ${trip.title}`,
  )

  const pending = readPending()
  pending.saved[trip.id] = trip
  pending.deleted = pending.deleted.filter((id) => id !== trip.id)
  writePending(pending)
}

/** Commit a deletion. */
export async function deleteTrip(id: string): Promise<void> {
  const config = requireConfig()
  const { trips, sha } = await readRepoTrips(config)

  const removed = trips.find((trip) => trip.id === id)
  const next = trips.filter((trip) => trip.id !== id)

  await commitTrips(config, next, sha, `Delete trip: ${removed?.title ?? id}`)

  const pending = readPending()
  delete pending.saved[id]
  if (!pending.deleted.includes(id)) pending.deleted.push(id)
  writePending(pending)
}

/**
 * Commit an already-resized photo and return the path to store on the trip.
 * Photos go in first so a trip is never saved pointing at a missing image.
 */
export async function uploadPhoto(
  bytes: Uint8Array,
  path: string,
  message: string,
): Promise<string> {
  const config = requireConfig()

  // Overwriting an existing slot needs that file's current sha.
  const existing = await readFile(config, `public/${path}`)
  await writeFile(config, `public/${path}`, encodeBytes(bytes), message, existing.sha)

  return path
}

async function readRepoTrips(config: GitHubConfig): Promise<{ trips: Trip[]; sha: string | null }> {
  const file = await readFile(config, DATA_PATH)
  if (!file.text.trim()) return { trips: [], sha: file.sha }

  let parsed: unknown
  try {
    parsed = JSON.parse(file.text)
  } catch {
    throw new Error('trips.json in the repository is not valid JSON. Fix it there first.')
  }

  if (!Array.isArray(parsed)) throw new Error('trips.json in the repository is not an array.')

  return { trips: parsed as Trip[], sha: file.sha }
}

function commitTrips(config: GitHubConfig, trips: Trip[], sha: string | null, message: string) {
  const json = `${JSON.stringify(trips, null, 2)}\n`
  return writeFile(config, DATA_PATH, encodeText(json), message, sha)
}

/** True if an id is already taken, so the editor can reject duplicates. */
export function isIdTaken(trips: Trip[], id: string, exceptId?: string): boolean {
  if (id === exceptId) return false
  return trips.some((trip) => trip.id === id)
}
