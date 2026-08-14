import 'vuetify/styles'

import { createVuetify } from 'vuetify'
import { VDateInput } from 'vuetify/labs/VDateInput'

import { iconAliases, iconSet } from '@/plugins/icons'

/**
 * Bright travel-brand palette: near-white paper, petrol blue ink, teal accent,
 * generous rounding. Every colour the app uses is declared here — components
 * reference theme names (`primary`, `chapterWork`), never raw hex — so the whole
 * site re-skins from this one object.
 */
const skyTheme = {
  dark: false,
  colors: {
    background: '#f1f6f8',
    surface: '#ffffff',
    /** Tinted panel behind quieter sections. */
    'surface-bright': '#e4eff4',
    /** Hairline borders. */
    'surface-variant': '#d5e4ec',
    'on-surface-variant': '#61818f',

    /** Deep petrol blue — headings, buttons, the brand mark. */
    primary: '#1f5f7a',
    'on-primary': '#ffffff',
    /** Teal — links, active states, the second half of a two-tone heading. */
    secondary: '#12a5a0',
    accent: '#12a5a0',
    /** Solid blue used as a full card background in the `frame` template. */
    deep: '#2f6f91',
    'on-deep': '#ffffff',

    error: '#c0563f',
    info: '#3f8fbe',
    success: '#4f9e7f',
    warning: '#d99a4e',

    'on-background': '#173845',
    'on-surface': '#173845',

    // One colour per life chapter — timeline nodes and filter chips.
    chapterChildhood: '#e2955f',
    chapterSchool: '#12a5a0',
    chapterUniversity: '#3f8fbe',
    chapterWork: '#1f5f7a',
    chapterRecent: '#5fae9b',
  },
  variables: {
    'border-color': '#d5e4ec',
    'border-opacity': 1,
    'medium-emphasis-opacity': 0.75,
    // Vuetify's default shadows are grey and muddy on a blue-tinted page.
    'shadow-key-umbra-opacity': 0.06,
    'shadow-key-penumbra-opacity': 0.04,
    'shadow-key-ambient-opacity': 0.03,
  },
}

export const vuetify = createVuetify({
  // VDateInput is still a labs component in Vuetify 3.13, so vite-plugin-vuetify's
  // autoImport does not know about it — it has to be registered by hand.
  components: { VDateInput },

  theme: {
    defaultTheme: 'sky',
    themes: { sky: skyTheme },
  },
  icons: {
    defaultSet: 'mdi',
    aliases: iconAliases,
    sets: { mdi: iconSet },
  },
  defaults: {
    // Soft, heavily rounded surfaces with hairline borders rather than Material
    // elevation — the reference style has almost no visible shadow.
    VCard: { flat: true, rounded: 'xl' },
    VBtn: { variant: 'flat', rounded: 'pill', class: 'text-none' },
    VChip: { size: 'small', variant: 'tonal', rounded: 'pill' },
    VTextField: { variant: 'outlined', density: 'comfortable', rounded: 'lg' },
    VTextarea: { variant: 'outlined', density: 'comfortable', rounded: 'lg' },
    VSelect: { variant: 'outlined', density: 'comfortable', rounded: 'lg' },
    VCombobox: { variant: 'outlined', density: 'comfortable', rounded: 'lg' },
    VDateInput: { variant: 'outlined', density: 'comfortable', rounded: 'lg' },
    VDialog: { scrollable: true },
  },
  display: {
    // Matches the CSS breakpoints in src/styles/main.css.
    thresholds: { xs: 0, sm: 600, md: 960, lg: 1280, xl: 1920 },
  },
})
