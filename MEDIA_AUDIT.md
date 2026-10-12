# Exercise media: licence audit and asset inventory

**Audit date:** 12 October 2026
**Result:** No third-party demonstration media is bundled. Every exercise uses REP's own movement diagram, clearly labelled *"No demonstration bundled"*. You can attach your own media per exercise.

## Sources investigated

| Source | What could be checked | Licence finding | Decision |
|---|---|---|---|
| **hasaneyldrm/exercises-dataset** (GitHub) — https://github.com/hasaneyldrm/exercises-dataset | Read `LICENSE`, `NOTICE.md` and `README.md` directly from the repository. | The **text data** (names, categories, instructions) is MIT. The **media** in `images/` and `videos/` is expressly excluded from MIT. It is © Gym visual, redistributed in that repository under *separate written permission* given to the repository, at 180×180 only, with mandatory attribution. The notice says cloning the repository does not grant any licence to the media, and that reuse is governed by Gym visual's Terms & Conditions. | **Media not used.** That permission belongs to that repository, not to REP. REP's exercise text is original and does not copy the dataset's instructions. |
| **Gym visual** — https://gymvisual.com/ (terms: https://gymvisual.com/content/3-terms-and-conditions-of-use) | The site and terms page could not be opened from the build environment (blocked by its network policy). The terms are referenced by the dataset's NOTICE, which says redistribution requires Gym visual's separate written permission. | Commercial product. Redistribution needs written permission or a purchased licence. Watermark terms could not be verified. | **Not used.** If you buy a licence that allows bundling in a personal app, see "Adding licensed media" below. |
| **WorkoutX** — https://workoutxapp.com/exercises.html | The page could not be opened from the build environment (blocked by its network policy). Search results only show it as an exercise-GIF API product. | **Unverified.** No licence text could be inspected. | **Not used and not hotlinked.** Hotlinking would also break offline use and leak requests to a third party. |

### Checks for each source

- Licence identified, and media-specific terms separated from data terms: done where readable (dataset repository). Not possible for Gym visual or WorkoutX from this environment.
- Commercial or non-commercial use, redistribution, modification and local bundling: **none confirmed as permitted for REP**.
- Attribution requirements: the dataset media requires "© Gym visual — https://gymvisual.com/". Moot, since it isn't used.
- Bulk access: the dataset offers JSON plus GIF/thumbnail folders. WorkoutX and Gym visual appear to offer API or purchase access. Neither was used.
- No access restrictions were bypassed. Nothing was scraped. No watermark was altered.

## What REP shows instead

- **Movement diagram:** an original SVG arrow showing the direction of force for the exercise's movement pattern (hinge, incline push, horizontal pull and so on). It is labelled as a diagram, never as a demonstration.
- **Text:** a short description, technique cues, setup steps and common mistakes, all written for REP.
- **Your own media:** on the exercise page, use **Attach your own demo** for a GIF, PNG, JPEG, WebP, MP4, WebM or MOV file up to 15 MB. It's stored in IndexedDB on the device, plays muted and looped with a pause control, respects Reduced Motion (GIFs wait for a tap), and works offline. Your credit or source text appears under it.

## Media manifest

`src/data/media.ts` has one entry per built-in exercise with these fields: `exerciseId`, `assetPath`, `format`, `attribution`, `license`, `sourceUrl`, `cachePolicy`, `fallback`, `verified` and `status`. Today every entry is `status: "not-bundled"`, `verified: false`, `assetPath: null`, `fallback: "movement-diagram"`.

### Missing assets (all built-in exercises)

Hyperextensions · Barbell incline bench press · Barbell flat bench press · Leg extensions · Leg curls · Seated cable row · Cable face pulls · EZ-bar biceps curls · Dumbbell hammer curls · Cable triceps pressdowns · Dead bug · Supine abdominal brace with heel slides · Dumbbell incline press · Dumbbell flat press · Chest-supported dumbbell row · One-arm dumbbell row · Lat pulldown · Bent-over dumbbell rear-delt raise · Cable biceps curl · Cable overhead triceps extension · Dumbbell overhead triceps extension · Kettlebell Romanian deadlift · Kettlebell goblet squat · Bird dog

The recovery movements are text-only by design.

## Adding licensed media to the bundle later

1. Confirm in writing that the licence allows redistribution in your app. Keep any watermark intact.
2. Put the file at `public/media/<exercise-id>.<mp4|webm|gif|webp|png|jpg>`. Lowercase letters, numbers and hyphens only. `resolveLocalAsset()` rejects any other path, including `..`, absolute URLs and query strings.
3. Fill in the manifest entry: `assetPath`, `format`, `attribution`, `license`, `sourceUrl`, `verified: true`, `status: "bundled"`, `cachePolicy: "runtime"`.
4. Run `npm run build:pages`. Media under `media/` is cached the first time it's viewed, then available offline.

## Bundled asset inventory (production build, `docs/`)

| File | Bytes |
|---|---:|
| `assets/index-*.js` (app + React, minified; ~112 KB gzipped) | 384,026 |
| `assets/index-*.css` | 31,382 |
| `assets/big-shoulders-display-latin-700-normal-*.woff2` | 14,424 |
| `assets/big-shoulders-display-latin-800-normal-*.woff2` | 14,556 |
| `assets/public-sans-latin-400-normal-*.woff2` | 14,632 |
| `assets/public-sans-latin-600-normal-*.woff2` | 14,592 |
| `icons/apple-touch-icon.png` (180×180) | 1,130 |
| `icons/icon-192.png` | 2,675 |
| `icons/icon-512.png` | 4,530 |
| `icons/icon-maskable-512.png` | 4,009 |
| `icons/icon-monochrome-512.png` | 3,910 |
| `icons/favicon-32.png` | 1,225 |
| `icons/rep-mark.svg` | 717 |
| `index.html` | 1,623 |
| `manifest.webmanifest` | 747 |
| `sw.js` | 2,749 |

**The service worker precaches 15 files, about 483 KB uncompressed** — roughly 190 KB over the network with gzip. That's the whole offline app. Only `.woff2` fonts are shipped. Hashed filenames change with each build.
