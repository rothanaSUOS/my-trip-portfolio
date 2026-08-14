import type { TripCategory } from '@/types/trip'

/**
 * What kind of trip it was.
 *
 * Two questions in one list, on purpose — "who was I with" (family, couple,
 * friends, company, solo) and "what kind of place" (hiking, sea). Splitting them
 * into separate fields would mean two pickers and two filters for what is really
 * one question a reader asks: what sort of trip was this? A trip can carry any
 * combination, so `categories` is a list rather than a single value.
 *
 * TO ADD ONE: append an entry here, add the id to `TripCategory` in
 * types/trip.ts, and register its icon in plugins/icons.ts. Nothing else needs
 * touching — the editor, the filters and the chips all read this array.
 */
export interface CategoryMeta {
  id: TripCategory
  label: string
  /** Icon alias registered in `src/plugins/icons.ts`, e.g. `$catFamily`. */
  icon: string
}

/** Order shown in the picker and the filter bar: company first, then setting. */
export const CATEGORIES: readonly CategoryMeta[] = [
  { id: 'family', label: 'Family', icon: '$catFamily' },
  { id: 'couple', label: 'Couple', icon: '$catCouple' },
  { id: 'friends', label: 'Friends', icon: '$catFriends' },
  { id: 'company', label: 'Company', icon: '$catCompany' },
  { id: 'solo', label: 'Solo', icon: '$catSolo' },
  { id: 'hiking', label: 'Hiking', icon: '$catHiking' },
  { id: 'sea', label: 'Sea', icon: '$catSea' },
]

const BY_ID = new Map(CATEGORIES.map((category) => [category.id, category]))

/** Metadata for one category, or undefined if the id is not recognised. */
export function categoryMeta(id: TripCategory): CategoryMeta | undefined {
  return BY_ID.get(id)
}

/**
 * Resolve a trip's stored ids to metadata, dropping anything unknown.
 *
 * `trips.json` is hand-editable and not typechecked at build time, so a typo
 * would otherwise render a blank chip. Skipping unknown ids keeps a bad entry
 * from looking like a UI bug.
 */
export function categoriesOf(ids: readonly TripCategory[] | undefined): CategoryMeta[] {
  return (ids ?? []).map(categoryMeta).filter((meta): meta is CategoryMeta => Boolean(meta))
}
