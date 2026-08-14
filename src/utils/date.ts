/**
 * Date helpers for trip entries.
 *
 * Trip dates are stored as `YYYY-MM-DD` or `YYYY-MM` strings, never as `Date`
 * objects: `new Date('2004-07')` is parsed as UTC midnight and can render as
 * June in negative-offset timezones. Everything here works on the string parts.
 */

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

interface DateParts {
  year: number
  /** 1-12, or undefined when the trip only records a year. */
  month?: number
  /** 1-31, or undefined when the trip only records a month. */
  day?: number
}

/** Split a `YYYY`, `YYYY-MM` or `YYYY-MM-DD` string into numeric parts. */
export function parseTripDate(date: string): DateParts {
  const [year, month, day] = date.split('-').map(Number)
  return {
    year: year ?? 0,
    month: month || undefined,
    day: day || undefined,
  }
}

/** Calendar year of a trip — the timeline's primary grouping key. */
export function yearOf(date: string): number {
  return parseTripDate(date).year
}

/**
 * Human-readable date at the precision actually recorded:
 * `2019-04-12` → "12 April 2019", `2004-07` → "July 2004", `1998` → "1998".
 */
export function formatTripDate(date: string): string {
  const { year, month, day } = parseTripDate(date)
  if (!month) return String(year)

  const monthName = MONTHS[month - 1] ?? ''
  return day ? `${day} ${monthName} ${year}` : `${monthName} ${year}`
}

/**
 * A trip's date range, collapsing redundant parts:
 * same month  → "12–18 April 2019"
 * same year   → "28 April – 3 May 2019"
 * across years→ "28 December 2019 – 3 January 2020"
 */
export function formatTripRange(date: string, endDate?: string): string {
  if (!endDate || endDate === date) return formatTripDate(date)

  const start = parseTripDate(date)
  const end = parseTripDate(endDate)

  if (start.year === end.year && start.month === end.month && start.day && end.day) {
    return `${start.day}–${end.day} ${MONTHS[(start.month ?? 1) - 1]} ${start.year}`
  }

  if (start.year === end.year) {
    const startShort = start.day
      ? `${start.day} ${MONTHS[(start.month ?? 1) - 1]}`
      : (MONTHS[(start.month ?? 1) - 1] ?? '')
    return `${startShort} – ${formatTripDate(endDate)}`
  }

  return `${formatTripDate(date)} – ${formatTripDate(endDate)}`
}

/** Nights away, or `undefined` when either end lacks a day component. */
export function tripDuration(date: string, endDate?: string): number | undefined {
  if (!endDate) return undefined

  const start = parseTripDate(date)
  const end = parseTripDate(endDate)
  if (!start.day || !end.day) return undefined

  const startMs = Date.UTC(start.year, (start.month ?? 1) - 1, start.day)
  const endMs = Date.UTC(end.year, (end.month ?? 1) - 1, end.day)
  return Math.max(0, Math.round((endMs - startMs) / 86_400_000))
}

/** How much of a date the author actually remembers. */
export type DatePrecision = 'day' | 'month' | 'year'

/** The precision a stored date string carries. */
export function precisionOf(date: string): DatePrecision {
  const parts = date.split('-').length
  if (parts >= 3) return 'day'
  return parts === 2 ? 'month' : 'year'
}

/**
 * Stored string → `Date`, for handing to Vuetify's date picker.
 *
 * Built from local components rather than `new Date(string)`, which parses
 * `'2004-07'` as UTC midnight and lands on June in negative-offset timezones.
 * Missing parts default to the 1st of January.
 */
export function toDateObject(date: string): Date | null {
  if (!date) return null

  const { year, month, day } = parseTripDate(date)
  if (!year) return null

  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

/**
 * `Date` → stored string, truncated to the requested precision. Reads local
 * components so the calendar day the user clicked is the day that gets stored.
 */
export function fromDateObject(date: Date | null, precision: DatePrecision = 'day'): string {
  if (!date || Number.isNaN(date.getTime())) return ''

  const year = String(date.getFullYear()).padStart(4, '0')
  if (precision === 'year') return year

  const month = String(date.getMonth() + 1).padStart(2, '0')
  if (precision === 'month') return `${year}-${month}`

  return `${year}-${month}-${String(date.getDate()).padStart(2, '0')}`
}

/** Re-truncate an already-stored date to a different precision. */
export function withPrecision(date: string, precision: DatePrecision): string {
  return fromDateObject(toDateObject(date), precision)
}

/** Sort comparator: newest trip first. Pads so `2004-7` sorts beside `2004-07`. */
export function byDateDescending(a: { date: string }, b: { date: string }): number {
  return sortKey(b.date).localeCompare(sortKey(a.date))
}

function sortKey(date: string): string {
  const { year, month, day } = parseTripDate(date)
  return [
    String(year).padStart(4, '0'),
    String(month ?? 0).padStart(2, '0'),
    String(day ?? 0).padStart(2, '0'),
  ].join('-')
}
