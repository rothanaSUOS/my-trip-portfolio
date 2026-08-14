/**
 * Photo source adapter.
 *
 * The site takes photo URLs from `src/data/trips.ts` and renders them directly —
 * no API calls, no auth, no backend. This module is the single place that knows
 * how to turn a stored URL into a `src` for a given display size, so swapping
 * photo hosts later only touches this file.
 *
 * WHY NOT THE GOOGLE PHOTOS API: in March 2025 Google removed the
 * `photoslibrary.readonly` scope. An app can now only see media it created
 * itself, or items the *signed-in viewer* hands over through the Photos Picker.
 * A public portfolio has no signed-in viewer, so there is no supported way for
 * visitors' browsers to read your library. Direct image links are the workable
 * path. See CLAUDE.md → "Google Photos" for how to get them.
 */

import { getPreview } from '@/services/photoPreviews'
import { guessRepoFromLocation, loadConfig } from '@/services/settings'

/**
 * Hosts Google serves photo content from. Both appear in URLs copied out of
 * Google Photos depending on where you copy from.
 */
const GOOGLE_PHOTO_HOSTS = ['googleusercontent.com', 'usercontent.google.com']

/**
 * Google Photos links carry an optional size suffix after `=`, e.g.
 * `...=w2400-h1600-no`. We strip whatever is there and append our own.
 */
const SIZE_SUFFIX = /=[-\w]+$/

/** Display sizes used across the app. Keep these in sync with the CSS widths. */
export const PHOTO_SIZES = {
  /** Timeline card cover. */
  thumb: { w: 640, h: 480 },
  /** Photo grid inside the detail dialog. */
  grid: { w: 900, h: 675 },
  /** Full-screen lightbox. */
  full: { w: 2000, h: 1500 },
} as const

export type PhotoSize = keyof typeof PHOTO_SIZES

/** True if the URL is served by Google's image CDN and supports size suffixes. */
export function isGooglePhotoUrl(url: string): boolean {
  return GOOGLE_PHOTO_HOSTS.some((host) => url.includes(host))
}

/**
 * True for a Google Photos URL carrying `authuser`, which ties it to a specific
 * signed-in Google account.
 *
 * These load perfectly for the person who copied them and fail for everyone
 * else, so they look fine while you build the page and are broken for every
 * visitor — the worst kind of bug to ship. Worth refusing up front.
 */
export function isSessionBoundPhotoUrl(url: string): boolean {
  return /[?&]authuser=/.test(url)
}

/**
 * A `photos.google.com/share/...` or `photos.app.goo.gl/...` link is an album
 * *page*, not an image — putting one in an `<img src>` renders nothing. Callers
 * use this to warn during development instead of shipping a broken card.
 */
export function isGooglePhotosAlbumLink(url: string): boolean {
  return url.includes('photos.google.com/share') || url.includes('photos.app.goo.gl')
}

/**
 * Resolve a stored photo URL into an `<img src>` at the requested size.
 *
 * - Google CDN links get a `=w{W}-h{H}-c` suffix so Google serves a correctly
 *   sized, cropped JPEG rather than the full-resolution original.
 * - Absolute non-Google URLs pass through untouched.
 * - Everything else is treated as a path inside `public/` and gets the Vite base
 *   prefix, so it still resolves when hosted at `/my-trip-portfolio/`.
 */
export function resolvePhotoUrl(url: string, size: PhotoSize = 'grid'): string {
  const trimmed = url.trim()
  if (!trimmed) return ''

  // A just-uploaded photo is in the repo but not yet served — show the local
  // stand-in until the deploy makes the real file reachable.
  const preview = getPreview(trimmed)
  if (preview) return preview

  const { w } = PHOTO_SIZES[size]

  if (isGooglePhotoUrl(trimmed)) {
    // Width only. Asking for `-h{H}-c` made Google crop to our box, which fought
    // the card rendering the photo at its own shape. CSS does any cropping.
    return `${trimmed.replace(SIZE_SUFFIX, '')}=w${w}`
  }

  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:')) {
    return trimmed
  }

  // Repo-relative path under public/ — join with the deploy base path.
  const base = import.meta.env.BASE_URL || '/'
  return `${base.replace(/\/$/, '')}/${trimmed.replace(/^\//, '')}`
}

/**
 * Where a repo-relative photo can be fetched from GitHub directly.
 *
 * `public/photos/x.jpg` is committed the moment you save, but it is only
 * *served* once Pages redeploys — and on a dev server it is never served at all,
 * because the file went to GitHub rather than to the local folder.
 * raw.githubusercontent.com serves it from the repo immediately, with CORS
 * headers that allow an <img>, so a photo never has to wait on a deploy.
 *
 * Returns '' for absolute URLs (nothing to fall back to) and when the repo is
 * unknown. Private repos return a URL that 404s — the fallback simply fails and
 * the placeholder shows, same as before.
 */
export function rawPhotoUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed || /^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:')) return ''

  const config = loadConfig()
  const owner = config?.owner || guessRepoFromLocation().owner
  const repo = config?.repo || guessRepoFromLocation().repo
  if (!owner || !repo) return ''

  const branch = config?.branch || 'main'
  const path = `public/${trimmed.replace(/^\//, '')}`

  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`
}

/**
 * `srcset` for Google-hosted photos so mobile downloads a smaller file. Returns
 * an empty string for other sources, where we have no size control — an empty
 * `srcset` attribute is ignored by the browser, so `src` alone applies.
 */
export function resolvePhotoSrcset(url: string, size: PhotoSize = 'grid'): string {
  // A preview is a single fixed-size data URL; offering densities would make the
  // browser pick a variant that does not exist.
  if (getPreview(url.trim())) return ''
  if (!isGooglePhotoUrl(url)) return ''

  const { w } = PHOTO_SIZES[size]
  const stripped = url.trim().replace(SIZE_SUFFIX, '')

  return [1, 2].map((density) => `${stripped}=w${w * density} ${density}x`).join(', ')
}

/** Cover photo for a trip, or `undefined` when it has no photos yet. */
export function coverPhotoOf<T extends { photos: readonly unknown[] }>(trip: T) {
  return trip.photos[0]
}
