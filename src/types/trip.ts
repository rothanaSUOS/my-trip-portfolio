/**
 * Domain types for the travel timeline.
 *
 * Everything the site renders comes from `src/data/trips.ts`, which is typed
 * against these interfaces — so a typo in a trip entry is a build error, not a
 * blank card at runtime.
 */

/** Life chapter a trip belongs to. Drives the colour of its timeline node. */
export type LifeChapter = 'childhood' | 'school' | 'university' | 'work' | 'recent'

/**
 * How a trip is laid out on the timeline. Each value maps to a component in
 * `src/components/templates/`, registered in `src/data/templates.ts`.
 *
 * Templates change presentation only — every trip carries the same fields, so
 * switching template never loses data.
 */
export type TripTemplate = 'window' | 'panel' | 'frame' | 'collage' | 'quote'

/**
 * What kind of trip it was — who you were with, or what sort of place.
 * A trip can have several. See `src/data/categories.ts` for labels and icons.
 */
export type TripCategory =
  | 'family'
  | 'couple'
  | 'friends'
  | 'company'
  | 'solo'
  | 'hiking'
  | 'sea'

/** A single photo attached to a trip. */
export interface Photo {
  /** Stable id, unique within its trip. Used as the `:key` in photo grids. */
  id: string
  /**
   * Image source. Either:
   *  - a Google Photos / googleusercontent.com direct link, or
   *  - a repo-relative path under `public/` such as `photos/2019-japan-01.jpg`.
   *
   * See `src/services/photos.ts` for how these get resolved and resized.
   */
  url: string
  /** Required — screen readers and broken-image fallbacks both use this. */
  alt: string
  /** Optional caption shown under the photo in the lightbox. */
  caption?: string
}

/** Where a trip happened. */
export interface TripLocation {
  /** City, region or landmark, e.g. "Siem Reap". */
  name: string
  /** Country name, e.g. "Cambodia". */
  country: string
  /** ISO 3166-1 alpha-2, lowercase — used for the flag emoji, e.g. "kh". */
  countryCode?: string
}

/** One entry on the timeline. */
export interface Trip {
  /** Stable, URL-safe id. Convention: `<year>-<slug>`, e.g. `2019-tokyo`. */
  id: string
  title: string
  /**
   * Start date as `YYYY-MM-DD` or `YYYY-MM` (use `YYYY-MM` when you only
   * remember the month — common for childhood trips).
   */
  date: string
  /** Optional end date, same format. Omit for single-day trips. */
  endDate?: string
  location: TripLocation
  /** A paragraph or two. Rendered as plain text, newlines preserved. */
  description: string
  chapter: LifeChapter
  /** Short bullets shown as chips on the detail dialog. */
  highlights?: string[]
  /** What kind of trip it was, e.g. `['family', 'sea']`. Any number, or none. */
  categories?: TripCategory[]
  photos: Photo[]
  /** Card layout. Defaults to `panel` when omitted. */
  template?: TripTemplate
  /** Pin to the top of the "Featured" rail on the intro screen. */
  featured?: boolean
}

/** Aggregate numbers shown in the header, derived from the trip list. */
export interface TripStats {
  tripCount: number
  countryCount: number
  photoCount: number
  /** Calendar years spanned, e.g. 1998–2026 → 28. */
  yearSpan: number
  firstYear: number
  lastYear: number
}
