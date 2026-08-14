import {
  mdiAccount,
  mdiAccountMultiple,
  mdiAlertCircleOutline,
  mdiArrowUp,
  mdiBagPersonalOutline,
  mdiBriefcase,
  mdiCheck,
  mdiCircleSmall,
  mdiCompassOutline,
  mdiBeach,
  mdiBriefcaseOutline,
  mdiEarth,
  mdiEye,
  mdiEyeOff,
  mdiImageMultipleOutline,
  mdiImageOffOutline,
  mdiHeartOutline,
  mdiHiking,
  mdiHumanMaleFemaleChild,
  mdiMagnify,
  mdiMapMarkerOutline,
  mdiMapSearchOutline,
  mdiPencilOutline,
  mdiPlus,
  mdiCogOutline,
  mdiUpload,
  mdiSchool,
  mdiTeddyBear,
  mdiTrashCanOutline,
} from '@mdi/js'
import { aliases as vuetifyAliases, mdi } from 'vuetify/iconsets/mdi-svg'

/**
 * Icons as tree-shaken SVG paths rather than the `@mdi/font` webfont.
 *
 * The font ships ~400KB of woff2 and ~350KB of CSS covering 7,000+ icons; this
 * site uses about thirty. Importing paths from `@mdi/js` means only those end up
 * in the bundle, which matters on the phone connections most visitors will be on.
 *
 * COST: icon names must be registered here as aliases and referenced in
 * templates with a `$` prefix (`icon="$magnify"`), because there is no runtime
 * name→path lookup without the font. Adding an icon is a two-line change:
 * import it, add it below.
 *
 * `vuetifyAliases` supplies the ones Vuetify uses internally — $close, $clear,
 * $prev, $next, $dropdown and friends — so those work without being listed.
 */
export const iconAliases = {
  ...vuetifyAliases,

  alert: mdiAlertCircleOutline,
  arrowUp: mdiArrowUp,
  check: mdiCheck,
  circleSmall: mdiCircleSmall,
  earth: mdiEarth,
  eye: mdiEye,
  eyeOff: mdiEyeOff,
  imageMultiple: mdiImageMultipleOutline,
  imageOff: mdiImageOffOutline,
  magnify: mdiMagnify,
  mapMarker: mdiMapMarkerOutline,
  mapSearch: mdiMapSearchOutline,
  pencil: mdiPencilOutline,
  plus: mdiPlus,
  settings: mdiCogOutline,
  upload: mdiUpload,
  trash: mdiTrashCanOutline,

  // Trip categories — referenced by `icon` in src/data/categories.ts.
  catFamily: mdiHumanMaleFemaleChild,
  catCouple: mdiHeartOutline,
  catFriends: mdiAccountMultiple,
  catCompany: mdiBriefcaseOutline,
  catSolo: mdiAccount,
  catHiking: mdiHiking,
  catSea: mdiBeach,

  // Life chapters — referenced by `icon` in src/data/chapters.ts.
  chapterChildhood: mdiTeddyBear,
  chapterSchool: mdiBagPersonalOutline,
  chapterUniversity: mdiSchool,
  chapterWork: mdiBriefcase,
  chapterRecent: mdiCompassOutline,
}

export const iconSet = mdi
