import { chapterMeta, type ChapterMeta } from '@/data/chapters'
import { formatTripRange, tripDuration } from '@/utils/date'
import { toTeaser } from '@/utils/text'
import type { Photo, Trip } from '@/types/trip'

/**
 * Everything a card needs to render a trip, derived once.
 *
 * Five template components present the same trip five different ways. Rather
 * than each repeating the same six computed properties, each declares a single
 * `view()` computed that calls `tripView(this.trip)`.
 */
export interface TripView {
  /** e.g. "28 March – 8 April 2019" */
  dateLabel: string
  /** e.g. "4 nights", or '' when the dates lack day precision. */
  durationLabel: string
  /** e.g. "Tokyo, Japan" */
  placeLabel: string
  /** Flag emoji, or '' when countryCode is absent. */
  flag: string
  /** Description flattened to one line for clamping. */
  teaser: string
  chapter: ChapterMeta
  /** First photo — the cover. Undefined when the trip has none. */
  cover: Photo | undefined
  /** Second photo, used by the collage layout. */
  second: Photo | undefined
  photoCount: number
}

export function tripView(trip: Trip): TripView {
  const nights = tripDuration(trip.date, trip.endDate)

  return {
    dateLabel: formatTripRange(trip.date, trip.endDate),
    durationLabel: nights ? (nights === 1 ? '1 night' : `${nights} nights`) : '',
    placeLabel: `${trip.location.name}, ${trip.location.country}`,
    flag: countryFlag(trip.location.countryCode),
    teaser: toTeaser(trip.description),
    chapter: chapterMeta(trip.chapter),
    cover: trip.photos[0],
    second: trip.photos[1],
    photoCount: trip.photos.length,
  }
}

/** Turn an ISO 3166-1 alpha-2 code into its flag emoji. */
export function countryFlag(code?: string): string {
  if (!code || code.length !== 2) return ''

  const REGIONAL_INDICATOR_A = 0x1f1e6
  return [...code.toUpperCase()]
    .map((char) => String.fromCodePoint(REGIONAL_INDICATOR_A + char.charCodeAt(0) - 65))
    .join('')
}
