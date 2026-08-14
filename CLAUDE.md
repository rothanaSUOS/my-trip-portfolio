# my-trip-portfolio

A single-page travel portfolio — every trip from childhood to now, as a grid of
poster cards with photos, dates, places and a short story each. Static site, no
backend, no database.

## Stack

Vue 3 · TypeScript (strict) · Vuetify 3 · Vite 6. Deployed to GitHub Pages.

**Options API only.** Every component is `defineComponent({ data, computed,
methods })`. There is no `<script setup>`, no Composition API, no Pinia, and no
vue-router in this project — do not introduce them. Adding page state? It goes in
`App.vue`'s `data()`.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server at `localhost:5173/my-trip-portfolio/` |
| `npm run build` | Typecheck then build to `dist/` |
| `npm run typecheck` | `vue-tsc --noEmit` — run this before saying a change works |
| `npm run preview` | Serve `dist/` locally, exactly as Pages will |

Note the dev URL includes `/my-trip-portfolio/` — see *Base path* below.

## Where things live

```
public/trips.json        THE CONTENT. Fetched at runtime; written by the editor.
src/
  data/chapters.ts       Life chapters: label, theme colour, icon alias.
  data/templates.ts      The five card layouts offered in the editor.
  types/trip.ts          Trip / Photo / TripLocation / TripTemplate interfaces.
  services/tripStore.ts  Reads trips.json, commits changes back through GitHub.
  services/github.ts     Minimal GitHub Contents API client.
  services/settings.ts   The owner's GitHub config, in localStorage.
  services/images.ts     Downscales and re-encodes uploaded photos.
  services/photoPreviews.ts  Local stand-ins for photos awaiting deploy.
  services/photos.ts     The ONLY place that turns a stored URL into an <img src>.
  utils/date.ts          Trip-date parsing and formatting. Never uses `new Date(str)`.
  utils/text.ts          Description → display text (see Descriptions below).
  utils/tripView.ts      Derived card fields, shared by all five templates.
  plugins/vuetify.ts     Theme colours. Every colour in the app is defined here.
  plugins/icons.ts       Icon alias → SVG path registry.
  components/
    TripGrid.vue         The listing: responsive grid + scroll reveal.
    TripCard.vue         Card shell — click, hover, edit/delete. Picks a template.
    templates/           The five layouts. Purely presentational.
    TripDetailDialog.vue Full trip view.
    TripEditorDialog.vue Create / edit form.
    TemplatePicker.vue   Visual template chooser.
    SettingsDialog.vue   Connect the repo / manage the token.
  styles/main.css        Fonts, shared type treatments, radius variables.
prototype/               The original single-file CDN prototype. Reference only, not built.
```

**State lives in `App.vue`.** The trip list, filters, which trip is open, which
photo the lightbox shows — all of it. Child components take props and emit
events; none of them own page state. If a component seems to need shared state,
lift it to `App.vue` rather than reaching for a store.

## How saving works

This is the single most important thing to understand about the app.

The site is static, so there is no server to save to. Instead the browser
commits straight to the repository through the **GitHub Contents API**:

1. Content lives in **`public/trips.json`**, not in a TypeScript module — so it
   can be rewritten by an HTTP call without touching source.
2. Rendering fetches the **deployed** `trips.json`. Visitors need no token and
   the common case is one static file fetch.
3. Saving reads the repo's current `trips.json`, applies the change, and writes
   it back **echoing the blob sha it read**. A concurrent edit from another
   device then fails loudly (409/422) instead of being silently clobbered.
4. The Pages workflow rebuilds on push, so the change is live in ~1 minute.

Between committing and that deploy finishing, the fetched JSON is still stale.
Saved trips are held in a small localStorage "pending" layer, merged over the
fetched data so the UI updates instantly, and dropped automatically once the
deployed file catches up (`loadTrips` compares them). `pendingCount()` drives
the "deploying" banner.

**Photos are committed before the trip that references them**, so a trip is
never written pointing at an image that does not exist yet. If a photo upload
fails, nothing is saved at all.

An uploaded photo is committed to `public/photos/…`, which means it is *in the
repo* but not yet *served* — not from Pages until the deploy finishes, and never
from a dev server, since the file went to GitHub rather than to the local
folder. Two independent mechanisms stop that showing as a broken image, and
between them nobody ever has to run a command or reload:

1. **Local stand-in.** `services/photoPreviews.ts` holds a small data URL keyed
   by the committed path; `resolvePhotoUrl` prefers it, `prunePreviews` drops it
   once the trip stops being pending. Small on purpose (800px, q0.6) —
   localStorage caps out around 5MB. Covers the browser that did the upload.
2. **Raw fallback.** `rawPhotoUrl` builds a raw.githubusercontent.com URL for
   any repo-relative path, and `TripPhoto.onError` retries with it once before
   giving up. raw serves the file from the repo the instant it is committed,
   with `access-control-allow-origin: *` and a real image content-type. Covers
   reloads, other devices, and the dev server. Public repos only — a private
   repo 404s and falls through to the placeholder.

`App.startDeployPoll` then re-checks the deployed JSON every 20s while anything
is pending, so the page swaps to the real deployed data on its own. It stops
after ~5 minutes and the banner switches to pointing at the Actions tab, because
past that the deploy has almost certainly failed and silent polling would hide
it.

### The token

A fine-grained PAT with `Contents: Read and write` on this one repo, entered in
Settings and kept in localStorage on the owner's machine. `isConfigured()` gates
every piece of editing UI, so without it the site is plain read-only — which is
what every visitor gets.

Be careful with how this is described in the UI. It asks someone to paste a
credential into a web page; `SettingsDialog` states exactly where it is stored,
what it can do, and that a shared computer is a bad idea. Do not water that down.

## Templates

A trip's `template` field picks its card layout. Five exist:

| Template | Shape | Photos used |
| --- | --- | --- |
| `panel` | White card, photo above the story. The default. | 1 |
| `window` | Full-bleed photo, title over a gradient scrim. | 1 |
| `frame` | Photo mounted on a deep blue card. | 1 |
| `collage` | Two photos side by side, second offset down. | 2 |
| `quote` | Title on a frosted panel floating over the photo. | 1 |

Adding a template means: a value in `TripTemplate`, an entry in
`data/templates.ts`, a component in `components/templates/`, a case in
`TripCard.vue`'s `TEMPLATE_COMPONENTS` map, and a preview in
`TemplatePicker.vue`.

Templates are **purely presentational** — they take `trip` and `eager`, emit
nothing, and handle no events. `TripCard` owns the click target that opens the
detail dialog, which is why every template gets "view details" behaviour without
wiring anything up. Keep it that way; a template that handles its own clicks will
double-fire.

Each template gets its derived fields from one `tripView(this.trip)` computed
rather than repeating six computed properties five times.

Templates must **degrade gracefully** when a trip has fewer photos than the
layout wants — see `collage`, which falls back to a single wide frame. Never
render an empty box.

## Dates in the editor

The editor uses Vuetify's `VDateInput` (a **labs** component in 3.13, so it is
registered by hand in `plugins/vuetify.ts` — `autoImport` does not know about
labs components).

`VDateInput` always returns a full `Date`, but trips deliberately support
`YYYY-MM` and `YYYY` too — most childhood trips have no exact date. A three-way
precision toggle (Exact day / Month only / Year only) decides how much of the
picked date is kept; `fromDateObject`/`withPrecision` in `utils/date.ts` do the
truncation, and opening an existing trip adopts whatever precision it was
written with, so editing a childhood entry never promotes it to a fake exact
date.

Conversions read and write **local** date components, never `new Date(string)`.

## Google Photos

**Google removed the `photoslibrary.readonly` scope in March 2025.** An app can
no longer read a user's library. What remains is the Picker API, which requires
the *viewer* to be signed into the Google account that owns the photos — useless
for a public portfolio where visitors are strangers.

So this site stores **direct image URLs**. To get one:

1. Open the photo on `photos.google.com`.
2. Right-click the image → **Copy image address**.
3. Paste as the `url`. It looks like `https://lh3.googleusercontent.com/...`.

**An album share link will not work.** `photos.app.goo.gl/...` and
`photos.google.com/share/...` point at an HTML page, not an image. `TripPhoto`
and the editor both detect these and say so, rather than rendering a broken
image.

Alternative that never breaks: drop the file in `public/photos/` and use a
repo-relative path like `photos/2019-tokyo-01.jpg`.

Sizing is automatic — `resolvePhotoUrl` appends Google's `=w{W}-h{H}-c` suffix
per display size, and `resolvePhotoSrcset` adds a 2x variant. Never hard-code a
size suffix; store the bare URL.

## Adding a trip in code

Append to the array in `public/trips.json`. Nothing else needs changing — the
grid sorts by date, and stats, the country filter and photo counts are all
derived.

Note the tradeoff of moving content to JSON: it is no longer typechecked at
build time. `Trip` in `types/trip.ts` is still the contract, and `loadTrips`
validates only that the file parses as an array. A misspelled `chapter` now
shows up as a wrong-coloured card rather than a build error, so proofread edits
made by hand — or make them through the editor, which validates.

Conventions:
- `id` — `<year>-<slug>`, e.g. `2019-tokyo`. Must be unique.
- `date` — `YYYY-MM-DD`, or `YYYY-MM` when you only remember the month, or
  `YYYY` for a whole year. Formatting adapts to whatever precision you give.
- uploaded photos live at `photos/<trip-id>-<nn>.jpg` under `public/`, written
  by `services/images.ts` at max 2000px and JPEG q0.82 so the repo does not
  bloat — git keeps every version of a binary forever.
- `alt` — required on every photo. It is what screen readers announce and what
  shows if the image 404s.

## Descriptions

Descriptions are template literals, so editor line wraps become real `\n`
characters. `formatStory()` in `utils/text.ts` collapses single newlines to
spaces and keeps blank lines as paragraph breaks — the markdown rule. Render
descriptions through `formatStory` (dialog) or `toTeaser` (card), never raw.

## Dates

Trip dates are **strings, parsed by hand** in `utils/date.ts`. Do not pass them
to `new Date()`: `new Date('2004-07')` parses as UTC midnight and renders as
June in any negative-offset timezone. Sorting uses zero-padded string compare.

## Styling

The look is a bright travel-brand aesthetic: near-white paper, petrol blue ink,
teal accent, big soft radii, hairline borders instead of Material shadows.

- **Theme colours only.** Reference them as `rgb(var(--v-theme-primary))` in CSS
  or `color="primary"` on a Vuetify component. No raw hex outside
  `plugins/vuetify.ts`. Exceptions are deliberate and local: the photo scrims in
  `window`/`quote`, and the opaque lightbox backdrop.
- Font is Poppins throughout. `.font-display` is light-weight with tight
  leading, and a `<strong>` inside it goes semibold — that is the two-tone
  heading treatment ("A life in **trips**"). `.font-meta` is small uppercase
  with wide tracking.
- Radii come from `--radius-sm/md/lg/xl` in `main.css`. Buttons and chips are
  pills, set as Vuetify defaults.
- Component styles are `<style scoped>`. Only fonts, shared type treatments and
  the radius variables belong in `main.css`.

## Responsive

Mobile-first. The grid is 1 column, 2 columns at 600px, 3 at 960px, with every tile the same
height (`grid-auto-rows: 1fr`). Phone-
specific tweaks (stacked filter and editor rows, hidden lightbox arrows in
favour of swipe) live at 599px. Dialogs go fullscreen at `smAndDown`.

Verify changes at 390px and 1440px before calling them done.

## Icons

Icons are tree-shaken SVG paths from `@mdi/js`, not the `@mdi/font` webfont —
that font cost ~400KB of woff2 and ~350KB of CSS for the eighteen icons this site
uses. The cost is that `icon="mdi-close"` does not work; icons must be
registered in `plugins/icons.ts` and referenced with a `$` prefix
(`icon="$magnify"`). Adding one is a two-line change. Vuetify's internal
aliases — `$close`, `$clear`, `$prev`, `$next`, `$dropdown` — come free.

There is no vertical chevron in the built-in aliases; the editor's photo reorder
buttons rotate `$prev`/`$next` by 90° (both clockwise — that turns "<" into "^"
and ">" into "v").

## Base path

Vite's `base` defaults to `/my-trip-portfolio/` because GitHub Pages serves
project sites from `/<repo-name>/`. That is why the dev URL has the prefix too.
Deploying to a custom domain, Netlify or Vercel? Build with `BASE_URL=/`.

Anything constructing a URL to a file in `public/` must go through
`import.meta.env.BASE_URL` — `resolvePhotoUrl` already does.

## Deploying

Push to `main`; `.github/workflows/deploy.yml` builds and publishes. One-time
setup: repo **Settings → Pages → Source → GitHub Actions**.

## Gotchas

- **Vite dep cache.** A flood of `Missing ref owner context` / `onScopeDispose`
  warnings in dev means stale optimized deps loaded Vue twice. `rm -rf
  node_modules/.vite` and restart. It is not a code bug and never affects the
  production build.
- **`noUncheckedIndexedAccess` is on.** `array[0]` is `T | undefined`. Handle it;
  do not reach for `!` to silence it unless the invariant is genuinely local.
- **Scroll-reveal and automated testing.** `TripGrid` fades cards in via
  IntersectionObserver, so a full-page screenshot with no scrolling captures
  most cards at `opacity: 0`, and a fast scripted scroll loop outruns the
  observer callbacks. Scroll in steps with ~400ms pauses before asserting.
- **VBtnGroup collapses in a column flexbox.** It carries `overflow: hidden`,
  which makes its min-content height 0, so as a shrinkable flex item it
  flattens to nothing. Give it `flex: 0 0 auto` — see `.editor__precision`.
- **"Image failed to load" after saving.** Expected before the preview layer
  existed; if it reappears, check `photoPreviews` is being written on upload.
  On localhost the underlying file genuinely is not there until `git pull` —
  `TripPhoto.hint()` says which remedy applies based on the hostname.
- **Testing the GitHub path.** Real commits need a real token. Stub
  `window.fetch` for `api.github.com` and drive the UI — that verifies request
  order, shas and payloads, which is the part this repo actually owns.
- **`this.$refs` inside nested `v-for`.** It does not reliably collect every
  element across both loop levels. `TripGrid` queries the DOM for
  `[data-trip-id]` instead.
- The repo root is `/Users/rothana` (the whole home directory). Be careful with
  any `git add` — see the note in README.md.
