# Wanderlog — A Life in Trips

A personal travel portfolio: every journey from childhood to now, shown as a
grid of poster cards with photos, dates, places and a short story each.
Single-page, static, no backend.

Vue 3 · TypeScript · Vuetify 3 · Vite.

## Running it

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173/my-trip-portfolio/` — the path prefix is
deliberate, see *Hosting* below.

```bash
npm run build      # typecheck + build to dist/
npm run preview    # serve dist/ exactly as it will be hosted
```

## One-time setup: connect the repo

Out of the box the site is **read-only** — that is what visitors see. To let the
"Add a trip" button actually publish, connect it to this repository once:

1. Make a token at
   [GitHub → fine-grained tokens → Generate new](https://github.com/settings/personal-access-tokens/new)
   - Repository access → **Only select repositories** → this repo
   - Permissions → Repository permissions → **Contents: Read and write**
2. On the site, click **Connect to publish**, fill in your username, the repo
   name and the token, and hit Connect.

The token is checked before it is stored, and kept in that browser's local
storage on that device only. It is never committed and only ever sent to
api.github.com.

⚠️ Anyone who can use that browser can use the token to write to the repo. Don't
do this on a shared or public computer, and scope the token to this one repo.

## Adding trips

### 1. In the browser (this is the normal way)

Click **Add a trip**, fill in the form, hit save. That commits to the repo,
GitHub Actions rebuilds, and it's live in about a minute — no code editing. A
banner shows while a change is deploying, and your new trip appears immediately
in the meantime.

- **Photos**: upload a file straight from your computer or phone, *or* paste an
  image URL. Uploads are automatically resized to 2000px and re-encoded as JPEG
  before committing, so full-size phone photos don't bloat the repo. Your new
  photo shows immediately from a local copy while the deploy catches up.
- **Dates** use a calendar picker. Because childhood trips often have no exact
  date, an **Exact day / Month only / Year only** toggle controls how much of
  the picked date is kept, so `1998` and `2004-07` are just as valid as
  `2019-03-28`.

### 2. In code

Edit **`public/trips.json`** directly. Add an object to the array and the grid,
stats, filters and counts all update:

```json
{
  "id": "2019-tokyo",
  "title": "Cherry Blossoms and Vending Machines",
  "date": "2019-03-28",
  "endDate": "2019-04-08",
  "location": { "name": "Tokyo", "country": "Japan", "countryCode": "jp" },
  "chapter": "work",
  "template": "frame",
  "description": "A work conference that turned into eleven days.",
  "highlights": ["Hanami in Ueno Park", "Kamakura day trip"],
  "tags": ["work", "city", "spring"],
  "photos": [
    { "id": "p1", "url": "photos/2019-tokyo-01.jpg", "alt": "Cherry blossoms" }
  ]
}
```

Dates take whatever precision you remember: `2019-03-28`, `2004-07` or `1998`
all format correctly — useful for childhood trips.

The six entries shipped in that file are placeholders using picsum.photos so the
site renders on first run. Replace them.

### You never need to run anything after saving

Saving commits to the repo, and the page handles the rest by itself:

- Your new photo shows immediately from a local copy.
- On a reload or another device, photos are fetched straight from the repo via
  raw.githubusercontent.com, so they work before the deploy finishes.
- The page re-checks every 20 seconds and switches to the live data on its own
  when the deploy lands. No reload, no `git pull`, no commands.

If a photo still shows a placeholder, the repo is probably private (raw needs it
public) or the branch in Settings is wrong. If the banner says the change still
isn't live after a few minutes, check the **Actions** tab — the deploy failed.

## Card templates

Each trip picks how its card looks:

| Template | Shape | Photos |
| --- | --- | --- |
| **Panel** | White card, photo above the story. The default. | 1 |
| **Window** | Full-bleed photo with the title over it. | 1 |
| **Frame** | Photo mounted on a deep blue card. Good for portraits. | 1 |
| **Collage** | Two photos side by side. | 2 |
| **Quote** | Title on a floating panel over the photo. | 1 |

Mixing them is the point — that is what gives the grid its collage rhythm.

## Photos

### From Google Photos

1. Open the photo on `photos.google.com`
2. Right-click the image → **Copy image address**
3. Paste that URL (`https://lh3.googleusercontent.com/...`)

Sizing is handled for you — don't add a `=w800` suffix yourself.

⚠️ **Album share links don't work.** `photos.app.goo.gl/...` points at a web
page, not an image. If a card shows "Album link — needs a direct image URL",
that's the cause.

> Why not sign in and pull the album automatically? Google removed the
> `photoslibrary.readonly` scope in March 2025. Apps can no longer read a
> library; the replacement Picker API needs the *viewer* signed into your
> account, which can't work for a public site.

### From your own files

Use the upload button in the editor — it resizes, commits to
`public/photos/`, and fills in the path for you. Or drop images in
`public/photos/` yourself and reference them relatively:

```json
{ "id": "p1", "url": "photos/2019-tokyo-01.jpg", "alt": "Cherry blossoms" }
```

Either way the links can never expire, which pasted Google Photos URLs can.

## Hosting

Set up once: repo **Settings → Pages → Source → GitHub Actions**. After that
every push to `main` builds and deploys via
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

Site lands at `https://<username>.github.io/my-trip-portfolio/`.

**Custom domain or a different host?** The build needs the base path to match
how the site is served:

| Host | Build with |
| --- | --- |
| GitHub Pages project site | `npm run build` (default `/my-trip-portfolio/`) |
| Custom domain, Netlify, Vercel | `BASE_URL=/ npm run build` |

## Repository layout

```
public/trips.json          your content
public/photos/             uploaded photos
src/data/templates.ts      the five card layouts
src/components/TripGrid.vue          the listing
src/components/templates/            the five layouts
src/components/TripEditorDialog.vue  the in-browser editor
src/components/SettingsDialog.vue    connect the repo / manage the token
src/services/tripStore.ts  reads trips.json, commits changes back
src/services/github.ts     GitHub Contents API client
src/services/images.ts     resizes uploads before committing
src/plugins/vuetify.ts     theme — every colour in the app
prototype/                 the original single-file prototype, kept for reference
```

`CLAUDE.md` documents the conventions in more depth.

---

### ⚠️ Note on the git repository

This project directory sits inside a git repository rooted at your **home
directory** (`/Users/rothana`), which currently has ~1,800 files staged —
including `.android/adbkey`, an ADB **private key**. Committing that would put a
private key into git history.

Before committing anything, make this folder its own repository:

```bash
cd ~/my-trip-portfolio
git init
git add .
git commit -m "Initial commit"
```

Then deal with the home-directory repo separately — `git -C ~ reset` unstages
everything without touching your files.
