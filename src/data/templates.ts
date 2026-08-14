import type { TripTemplate } from '@/types/trip'

/**
 * The card layouts a trip can be presented with, as offered in the editor's
 * template picker.
 */
export interface TemplateMeta {
  id: TripTemplate
  label: string
  /** One line explaining when this layout works, shown under the picker. */
  hint: string
  /** How many photos the layout actually shows. Used to warn in the editor. */
  photosUsed: number
}

export const TEMPLATES: readonly TemplateMeta[] = [
  {
    id: 'panel',
    label: 'Panel',
    hint: 'White card, photo above the story. The safe default — works for anything.',
    photosUsed: 1,
  },
  {
    id: 'window',
    label: 'Window',
    hint: 'Full-bleed photo with the title over it. Best for one strong landscape shot.',
    photosUsed: 1,
  },
  {
    id: 'frame',
    label: 'Frame',
    hint: 'Photo framed on a deep blue card. Good for portrait shots.',
    photosUsed: 1,
  },
  {
    id: 'collage',
    label: 'Collage',
    hint: 'Two photos side by side. Needs at least two.',
    photosUsed: 2,
  },
  {
    id: 'mosaic',
    label: 'Mosaic',
    hint: 'Three photos: one tall on the left, two stacked right. Extra photos become a “+N” badge.',
    photosUsed: 3,
  },
  {
    id: 'grid',
    label: 'Grid',
    hint: 'Four photos in an even 2×2. Extra photos become a “+N” badge.',
    photosUsed: 4,
  },
  {
    id: 'quote',
    label: 'Quote',
    hint: 'Title centred on a floating panel over the photo. For a trip with a line to remember.',
    photosUsed: 1,
  },
]

export const DEFAULT_TEMPLATE: TripTemplate = 'panel'

const TEMPLATE_BY_ID = new Map(TEMPLATES.map((template) => [template.id, template]))

/** Look up template metadata, falling back to the default for unknown ids. */
export function templateMeta(id: TripTemplate | undefined): TemplateMeta {
  return (id && TEMPLATE_BY_ID.get(id)) || TEMPLATE_BY_ID.get(DEFAULT_TEMPLATE)!
}
