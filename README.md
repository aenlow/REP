# REP

An offline workout log for one home gym and one training system: **3×3×3** — three blocks, three exercises per block, three rounds. REP shows what to do next, logs what you actually did, and keeps your history on your phone. No account, no server, no tracking.

Your Apple Watch keeps the time; REP keeps the plan and the record.

---

## Put it online with GitHub Pages (no build step needed)

The built site is already in the `docs/` folder. GitHub serves it directly from your `main` branch.

### 1. Create the repository

1. On github.com, click **+** (top right) → **New repository**.
2. Name it **`REP`**. The name becomes part of the web address.
3. Choose **Public**. GitHub Pages is free for public repositories; private repositories need a paid plan.
4. Leave "Add a README" **unticked**, then click **Create repository**.

### 2. Upload the files

1. Unzip `REP.zip` on your computer.
2. On the new repository page, click **uploading an existing file**. You can also use **Add file → Upload files**.
3. Open the unzipped `REP` folder. Select **everything inside it**, not the folder itself, and drag it onto the upload area.
   - On a Mac, Finder hides files that start with a dot. Press **⌘ Shift .** to show them so `.github`, `.gitignore` and `docs/.nojekyll` get uploaded too. These are optional: the site works without them, but the automatic test workflow needs `.github`.
   - The web uploader accepts up to 100 files at a time, and this project has fewer.
4. Click **Commit changes**.

Check that the repository's top level now shows `docs`, `src`, `package.json` and so on. If you see a single `REP` folder, you dragged the folder instead of its contents. Delete it and upload again.

### 3. Turn on Pages

1. In the repository, open **Settings** → **Pages** (left sidebar).
2. Under **Build and deployment** → **Source**, choose **Deploy from a branch**.
3. Under **Branch**, choose **`main`** and folder **`/docs`**, then click **Save**.
4. Wait a minute or two, then refresh the page. GitHub shows **"Your site is live at …"**.

Your address will be `https://YOUR-USERNAME.github.io/REP/`. The path matches the repository name exactly, including capitals. The app uses relative paths, so it works under whatever name you choose.

### Install on iPhone

1. Open the address in **Safari** on your iPhone.
2. Tap **Share** (the square with the arrow).
3. Scroll down and tap **Add to Home Screen**.
4. Check that the name says **REP** and the icon shows the grid mark.
5. Tap **Add**.
6. Open REP from your Home Screen. It runs full screen and works offline after the first load.

Menu wording and some web-app features vary between iOS versions. Safari and the Home Screen app may keep **separate storage**. Install first and log from the Home Screen icon, or move your data with a backup.

### Updating later

Make changes on a computer with Node 20+ and run:

```bash
npm ci
npm test
npm run build:pages   # rebuilds docs/
```

Then upload or commit the changed files, including `docs/`. Open REP on your phone afterwards and it will show **"A new version of REP is ready"**. Tap **Update** when you're not mid-set. Your workouts are never touched by an update.

**Alternative deployment:** `.github/workflows/deploy-pages.yml` builds and deploys from GitHub Actions. To use it, set **Settings → Pages → Source** to **GitHub Actions**, then go to **Actions → Deploy to GitHub Pages → Run workflow**. Use one method, not both.

---

## What's in the app

| Area | What it does |
|---|---|
| **Home** | The next workout in your A → B rotation (start any workout manually too). Shows Continue if a session is open, your last session, this week's recorded sessions, and a link to recovery. |
| **Workouts** | Workout A and B, seeded exactly from your plan. Edit weights, reps, sets, notes, order and exercises. Create a Workout C, duplicate a workout, or reset to the original. History is always kept. |
| **Active workout** | Block and round position, a 3×3 session map, the prescription, your last logged performance, and notes. Log each set (weight, reps, optional RPE/RIR and a note), or tap **Complete** for the whole round. Also Substitute, Skip, Pause and End. Saved after every tap, so you can resume after a reload or a locked phone. |
| **History** | Session list, a by-exercise record of real sets with your best set, and body-weight entries. |
| **Library** | Search and filter by muscle, equipment and movement. Each exercise has cues, setup, common mistakes, alternatives, availability status, your saved setup (bench angle, rack height, cable and so on) and your notes. Add custom exercises. |
| **Recovery** | A separate, editable gentle mobility routine. Movements can be marked Available, Temporarily restricted or Needs clinician review. Logged separately from workouts. |
| **Settings** | lb/kg, auto-logging, owned equipment, checked cable pairings, JSON backup and restore, CSV export, storage status and install steps. |

### How quick Complete is logged

- If you've already logged sets for that round, **Complete** just marks the round done. It never creates duplicate sets.
- If you haven't, REP asks: **Log as prescribed** or **Mark done, no numbers**. Turn on *auto-log* in Settings to skip the question.
- Sets logged from the prescription are labelled **"as prescribed"** everywhere, so they're never confused with numbers you entered.

### Equipment rules (Major Fitness F22)

REP checks each block with deterministic local rules:

- **Blocked:** a barbell exercise in the rack, such as flat or incline bench, can't share a block with an exercise that lowers the cable arm into the rack, such as the seated cable row. You can't save a workout that does this. Substitute and Add exercise show these options locked, with the reason. If you re-rig a cable differently, change that exercise's cable setup in the Library first.
- **Check your setup:** two cable exercises on opposite sides are *not* assumed to fit. REP asks you to confirm once, then remembers that pairing. Forget it in Settings at any time.
- **Heads up:** three cable exercises, a shared cable side, a shared rack, or flat and incline bench in one block are allowed, with a note that you'll re-rig each round.

The seeded Workout A and B blocks contain no blocking conflicts. The seated row and face pull pair in block 2 asks for your one-time confirmation.

### Exercise demonstrations

REP **does not bundle third-party exercise animations**, because none of the investigated sources gives a licence that lets this project redistribute them (see [MEDIA_AUDIT.md](MEDIA_AUDIT.md)). Each exercise shows REP's own diagram, labelled *"No demonstration bundled"*, plus text cues.

To add a real demonstration, open an exercise in the Library and tap **Attach your own demo**. You can use a GIF, image or short video (MP4/WebM/MOV, up to 15 MB) that you have the right to use, such as a clip you filmed. It's stored on your phone and works offline.

---

## Privacy and backups

See [PRIVACY.md](PRIVACY.md). In short:

- Everything stays in your browser's storage on your device. REP has no server or analytics, and makes no network requests beyond loading its own files.
- **iOS can clear website data**, for example under storage pressure or after a long period without use. REP cannot recover data that iOS deletes. **Export a backup regularly** (Settings → Backup → Share backup → Save to Files or iCloud Drive). REP reminds you after 14 days.
- A backup is a file you move yourself. REP does **not** sync between devices.
- REP has **no** Apple Health or Apple Watch connection.

---

## Development

Requires Node 20 or newer.

```bash
npm ci
npm run dev           # local dev server
npm run typecheck
npm test              # unit + component tests (Vitest, jsdom, fake IndexedDB)
npm run build:pages   # production build into docs/
npm run serve:pages   # serve docs/ at http://localhost:4173/REP/ (same subpath as GitHub Pages)
npx playwright install chromium && npm run test:e2e   # browser tests against the docs/ build
npm run icons         # regenerate icons (needs Python + Pillow)
```

### Stack

Vite, React 19 and strict TypeScript. Storage uses IndexedDB via `idb`. A custom service worker is generated at build time, with a precache list and a content-hash version. Styling is a custom CSS token system. Fonts are Big Shoulders Display and Public Sans, bundled locally under the OFL. There is no backend and no analytics.

### Structure

```
src/
  app/            App shell, hash router, data store, install guide
  components/     Dialog, Stepper, ExerciseMedia, SessionMap, ExercisePicker, icons, brand mark
  features/       home, workouts (list + editor), session (active workout + set logger),
                  history, exercises (library, detail, form), recovery, settings
  data/           Seed data: exercises, Workout A/B, recovery routine, equipment, media manifest
  db/             IndexedDB schema, versioned migrations, seeding, repository functions
  lib/            Pure logic: session engine, conflict rules, validation, history,
                  backup/import, CSV, units, service-worker registration
  sw/             Service worker template
  styles/         tokens.css, app.css
public/           manifest, icons
docs/             BUILT SITE served by GitHub Pages (generated — don't edit by hand)
tests/            unit/ and component/ (Vitest)
e2e/              Playwright tests (run against docs/ under /REP/)
scripts/          icon generator, subpath static server
```

### Design decisions worth knowing

- **Hash routing** (`#/workouts/workout-a`): GitHub Pages has no server rewrites, so refreshing any screen still loads.
- **Relative base path** (`./`): the same build works at `/REP/`, `/rep/`, a fork, or a custom domain.
- **Weights are stored in pounds** and converted for display, so switching units never rewrites history.
- **Sessions snapshot their template.** Editing a workout doesn't change an open session or past history.
- **Seeding is additive and runs once.** User edits to built-in workouts and exercises are never overwritten, and a deleted Workout A doesn't come back.
- **Storage failure is explicit.** If IndexedDB can't open, REP shows an error instead of pretending to save.
- **Service worker updates wait for you.** It caches only same-origin app files and never touches IndexedDB.

---

## Known limitations

- **Not tested on a physical iPhone.** Automated browser tests ran in desktop Chromium with an iPhone 13 viewport, not in Safari or WebKit. Installing to the Home Screen, standalone mode, safe areas and offline behaviour on real iOS still need checking on your phone. See [TEST_REPORT.md](TEST_REPORT.md).
- **No bundled exercise demonstrations** (licensing). Attach your own per exercise.
- **Attached media isn't included in backups.** Re-attach it after restoring on a new device.
- **iOS may evict storage.** Back up regularly; installing to the Home Screen and allowing persistent storage both help.
- **No timer,** by design. Duration is start to finish minus paused time.
- **Safari and Home Screen storage** may be separate on some iOS versions.
- Exercise cues are general technique reminders, not medical advice. Availability labels are personal tracking aids, not clearance.
