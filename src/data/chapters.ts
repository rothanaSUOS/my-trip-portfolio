import type { LifeChapter } from '@/types/trip'

/** Display metadata for each life chapter: label, colour and timeline icon. */
export interface ChapterMeta {
  id: LifeChapter
  label: string
  /** Vuetify theme colour name — see `src/plugins/vuetify.ts`. */
  color: string
  /** Icon alias registered in `src/plugins/icons.ts`, e.g. `$chapterWork`. */
  icon: string
}

/** Ordered oldest → newest. The filter bar renders them in this order. */
export const CHAPTERS: readonly ChapterMeta[] = [
  { id: 'childhood', label: 'Childhood', color: 'chapterChildhood', icon: '$chapterChildhood' },
  { id: 'school', label: 'School Years', color: 'chapterSchool', icon: '$chapterSchool' },
  { id: 'university', label: 'University', color: 'chapterUniversity', icon: '$chapterUniversity' },
  { id: 'work', label: 'Working Life', color: 'chapterWork', icon: '$chapterWork' },
  { id: 'recent', label: 'Recent', color: 'chapterRecent', icon: '$chapterRecent' },
]

const CHAPTER_BY_ID = new Map(CHAPTERS.map((chapter) => [chapter.id, chapter]))

/** Look up chapter metadata, falling back to the first chapter if unknown. */
export function chapterMeta(id: LifeChapter): ChapterMeta {
  return CHAPTER_BY_ID.get(id) ?? CHAPTERS[0]!
}
