# Test report

**Date:** 12 October 2026 · **Build:** production bundle in `docs/`, served at `/REP/`

## Summary

| Check | Result |
|---|---|
| TypeScript strict type check (`npm run typecheck`) | ✅ Pass, no errors |
| Unit tests (Vitest) | ✅ 59 / 59 |
| Component tests (Vitest + React Testing Library, jsdom, fake IndexedDB) | ✅ 18 / 18 |
| End-to-end tests (Playwright, production build under `/REP/`) | ✅ 10 / 10, two consecutive full runs |
| Production build (`npm run build:pages`) | ✅ Pass |
| Linting | ⚠️ No ESLint configured. Strict TypeScript (`noUnused*`, `noUncheckedIndexedAccess`) is the static check. |

## What actually ran where

- **Unit and component tests** run in Node 22 with jsdom and `fake-indexeddb`.
- **End-to-end tests** ran in **headless Chromium 153** on Linux, using Playwright's iPhone 13 profile (390×844 viewport, touch, mobile user agent). The build was served by `scripts/serve-subpath.mjs`, which mirrors GitHub Pages: `/REP` redirects to `/REP/`, anything outside `/REP/` returns 404, and there are no rewrites. Playwright's own browser download is blocked in the build environment, so a Chromium binary from the `@sparticuz/chromium` npm package was used. On a normal machine, `npx playwright install chromium` is enough.

## End-to-end coverage (all passing)

1. Every request resolves under `/REP/`, with no failed or out-of-scope requests.
2. Manifest is valid (name, `start_url`/`scope` = `./`, standalone). All four icons and the `apple-touch-icon` return 200 as PNG. Apple meta tags are present.
3. Service worker registers with scope `/REP/` and takes control. **With the network switched off**, the app reloads, Workout A starts, navigation works, a set is logged, the media fallback shows, and the set survives another offline reload.
4. Direct navigation to and refresh of a deep route (`#/library/leg-curl`).
5. Full session: start A → log real sets for round 1 → quick-complete rounds 2–3 → **block 1 complete** → reload → resume from Home → end with 18 unlogged rounds confirmed → summary (9 completed, 3 sets) → history shows the session → Home recommends **B**.
6. Edit a prescribed weight (75 → 80 lb), save, and see it in the next session.
7. Create a custom exercise; it appears in the library.
8. Export a JSON backup (download) → import it into a **fresh browser context** with Replace all → history restored.
9. **Workout B:** block 1 has no blocking conflict and no seated row. Adding an exercise to block 1 shows the seated cable row **locked** with the F22 reason. Moving the row into block 1 shows a blocking conflict and **disables Save**.
10. **Service-worker update:** with a session open and a set logged, a new deployment shows "Update after your workout", with **no automatic reload**. Tapping Update reloads to the new version with the session and set intact. Only the new cache remains, and IndexedDB is untouched.

## Unit and component coverage

Unit tests cover:

- Seeded A/B definitions: exact exercise order, reps and loads, and that unknown loads are not invented.
- 3×3×3 validation: warnings when the shape changes, errors for invalid input, and Workout C needing no code change.
- F22 conflict rules, cable-pair confirmation, same-side and three-cable notices, and missing equipment.
- Substitution ranking and locking.
- The 27-position progression.
- Snapshot isolation.
- Set logging.
- Quick completion: no duplicate sets, and prescribed logging that is labelled and only happens when asked.
- Session-only substitution.
- Skip, progress and block completion.
- Pause and resume duration maths.
- JSON round-trip resume.
- Last/best performance using the same exercise ID only.
- Rotation and the week view.
- Unit conversion.
- Backup export sections.
- Import validation: invalid JSON, wrong app, newer schema, over 10 MB, missing fields, unsafe IDs, unknown fields dropped, HTML kept as text.
- Merge semantics.
- CSV escaping and formula-injection guarding.
- Media path traversal guard.
- IndexedDB stores, idempotent seeding, migrations, atomic session and set writes, merge and replace.

Component tests cover:

- Home first run with no fake history.
- The storage error state.
- The workout browser.
- Editor locking and weight editing.
- The active workout screen: position, prescription and honest "No earlier log".
- Set logging, editing and deleting.
- The quick-complete dialog.
- Substitution.
- The end-workout confirmation.
- Resume after remount.
- Pause.
- Library search and detail.
- Custom exercise creation with duplicate-name rejection.
- The recovery run.
- Invalid import.
- Export → import preview → merge.
- The kg display.

## Not verified — please check on your iPhone

These were **not** tested on a physical iPhone or in Safari/WebKit:

- **Add to Home Screen** in Safari: icon appearance, the "REP" name, and launching standalone.
- **Offline behaviour in iOS Safari or standalone mode.** Offline was only verified in desktop Chromium.
- Safe-area insets around the notch and home indicator, and `black-translucent` status bar rendering.
- Behaviour after **phone lock or app switching**. Saving happens on every tap, so reload and resume should cover this, but it wasn't observed on iOS.
- Whether iOS grants **persistent storage**, and whether Safari and Home Screen storage are shared on your iOS version.
- The share sheet for **Share backup** (Web Share with files). The **Download backup** path was verified in Chromium.
- Playback of user-attached **MOV/MP4** clips in iOS Safari.
- VoiceOver, Dynamic Type and larger text sizes. Layout uses rem units and was reviewed visually at the default size only.

**Suggested 5-minute check:** install from Safari → open from the Home Screen → start Workout A → log a set → lock the phone for a minute → reopen and confirm the set is there → turn on Airplane Mode → force-quit and reopen REP → confirm it loads and the set is still there → Settings → Share backup → Save to Files.
