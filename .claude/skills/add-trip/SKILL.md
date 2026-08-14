---
name: add-trip
description: Add, edit or remove a trip on the travel portfolio, including its photos and card template. Use when the user wants to record a journey ("add my Japan trip", "put the 2015 Vietnam one in", "I went to Bali last month"), attach or replace photos, change how a trip's card looks, fix a date or place, or delete entries. Also covers turning Google Photos links into working image URLs.
---

# Adding a trip

## First: which way is the user adding it?

Both paths publish — they write to the same place.

**In the browser** — the site's "Add a trip" button opens a full editor
(template picker, photo upload, date picker) and commits straight to the repo
through the GitHub API. This is the normal way, and it is usually the better
answer: it validates input, resizes photos, and needs no help from you. Point
the user at it when they are asking how to add a trip *themselves*. It requires
the one-time Settings connection; if they have not done that, the button is not
even shown and the hero says "Connect to publish".

**In code** — editing `public/trips.json`. Do this when the user asks *you* to
add a trip. Content is JSON, not TypeScript — it is fetched at runtime.

## Before writing anything

Gather these from the user. Ask for whatever is missing rather than inventing
it — this is their life, and a plausible-sounding invented detail is worse than
an absent one.

**Required:** title · date · place (city + country) · description
**Optional but good:** end date · highlights · tags · photos · template

If they give you a bare prompt like "add my Japan trip", ask for the date and a
sentence or two about it before editing. If they hand you a photo URL and
nothing else, still ask — a card with no story is the one thing this site is
for.

Write the description in **their voice**, from what they told you. Do not
embellish with details they did not give: no invented weather, meals, or
feelings. Two to four sentences is the right length. If they gave you one line,
one line is the entry.

## The entry

```json
{
  "id": "2019-tokyo",
  "title": "Cherry Blossoms and Vending Machines",
  "date": "2019-03-28",
  "endDate": "2019-04-08",
  "location": { "name": "Tokyo", "country": "Japan", "countryCode": "jp" },
  "chapter": "work",
  "template": "frame",
  "description": "...",
  "highlights": ["Hanami in Ueno Park"],
  "tags": ["work", "city", "spring"],
  "photos": [
    { "id": "p1", "url": "photos/2019-tokyo-01.jpg", "alt": "Cherry blossoms over a canal" }
  ]
}
```

`id` is `<year>-<slug>` and must be unique. `endDate` is omitted for a single
day. Order in the array does not matter — the grid sorts by date. Append to the
end; it keeps diffs small.

**JSON is not typechecked.** `Trip` in `src/types/trip.ts` is still the
contract, but a typo in `chapter` or `template` now produces a wrong-looking
card instead of a build error. Proofread, and check the result in the browser.

### Dates

Use the precision the user actually remembers. All three are valid and format
correctly:

| Stored | Renders as |
| --- | --- |
| `'2019-03-28'` | 28 March 2019 |
| `'2004-07'` | July 2004 |
| `'1998'` | 1998 |

Childhood trips are usually `YYYY-MM` or `YYYY`. Do not pad a vague memory into
a fake exact date.

`endDate` uses the same format. Nights-away is computed only when both ends have
a day component, which is intended — a month-precision trip has no meaningful
duration.

### Chapters

Pick from the five in `src/data/chapters.ts`, based on where the user was in
their life — not the trip's style:

`childhood` · `school` · `university` · `work` · `recent`

If their life does not map onto these (no university, say), edit `chapters.ts` —
relabel or add one — rather than forcing a bad fit. A new chapter needs a
matching theme colour in `plugins/vuetify.ts` and an icon alias in
`plugins/icons.ts`.

### Templates

`template` picks the card layout. Choose it from the **photos**, not the mood:

| Template | Use when |
| --- | --- |
| `panel` | Default. Anything. Photo above the story on a white card. |
| `window` | One strong wide/landscape shot worth showing full-bleed. |
| `frame` | A portrait shot that would crop badly full-bleed. |
| `collage` | Two good photos. **Needs two** — falls back to one wide frame otherwise. |
| `quote` | The trip has one line worth putting front and centre. |

Vary them across the grid; six identical `panel` cards waste the whole system.
Omit the field to get `panel`.

## Photos

Every photo needs `id` (`p1`, `p2`, … within the trip), `url` and `alt`.

**`alt` is required and is not decorative.** Describe what is in the frame in a
short phrase — screen readers announce it, and it is displayed if the image
fails to load. "Photo 1" is not alt text.

The **first photo is the cover**. Put the best one first. `collage` uses the
first two.

### Getting a working Google Photos URL

1. Open the photo on `photos.google.com`
2. Right-click the image → **Copy image address**
3. Paste the bare URL — it starts `https://lh3.googleusercontent.com/`

Store it **without a size suffix**. `resolvePhotoUrl` appends the right
`=w{W}-h{H}-c` per display size automatically.

**Album links do not work.** If the user gives you `photos.app.goo.gl/...` or
`photos.google.com/share/...`, that is a web page, not an image — tell them and
ask for the direct image address. Do not put it in the file hoping it resolves;
the card will render an "Album link" placeholder.

Why not just call the Google Photos API: Google removed the
`photoslibrary.readonly` scope in March 2025, so no app can read a library
anymore. The Picker API that replaced it requires the person *viewing* the page
to be signed into the account that owns the photos, which cannot work for a
public site.

### Local files instead

Drop the file in `public/photos/` and use a repo-relative path:

```ts
{ id: 'p1', url: 'photos/2019-tokyo-01.jpg', alt: '...' }
```

No leading slash — `resolvePhotoUrl` prepends the deploy base path. This never
breaks, at the cost of repo size. Suggest it when the user is worried about
links dying.

## Editing and deleting

Same file. To edit, find the entry by `id`. To delete, remove the object.

Careful: if the user recently saved from the browser editor, that change sits in
a localStorage "pending" layer until the deploy catches up, and it is merged
*over* the fetched data. So an edit you make to `trips.json` can look like it
did nothing in their browser. It clears itself once the deployed file matches;
if they are stuck, the key is `wanderlog.pending.v1`.

## After editing

1. `node -e "JSON.parse(require('fs').readFileSync('public/trips.json','utf8'))"` —
   a trailing comma breaks the whole site, and nothing at build time catches it.
2. `npm run typecheck` if you touched anything under `src/`.
3. `npm run dev` and look at the new card. Confirm the photo actually loads —
   a bad Google URL fails silently in every way except visually.
4. Check it at phone width too if you changed anything structural.

Note that cards fade in on scroll, so a screenshot taken without scrolling shows
them blank. Scroll in steps with pauses before judging.

Report what you added and flag anything you had to guess at.
