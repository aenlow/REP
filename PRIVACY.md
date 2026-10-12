# Privacy and backups

## Where your data lives

REP is a local-first app. Workouts, sessions, sets, notes, body weight, recovery logs, settings and any media you attach are stored in **IndexedDB, in this browser, on this device**. Nothing else holds a copy.

REP has:

- no account or sign-in
- no server or backend
- no analytics, telemetry, advertising or tracking pixels
- no third-party scripts, fonts or images; everything is served from the same GitHub Pages site
- no network requests except loading its own files. A Content Security Policy enforces this: `connect-src 'self'`.

The only party that sees any traffic is GitHub Pages, which serves the app's files, the same as for any website you visit. It never receives your workout data.

REP does **not** read from or write to Apple Health, and it does **not** sync with Apple Watch.

## Backups

**iOS can delete website data.** This can happen when the device is low on storage, after weeks without opening the app, or if you clear Safari data. REP cannot recover data that iOS has deleted.

- **Export regularly:** Settings → Backup → **Share backup**, then choose *Save to Files* (iCloud Drive works well), or **Download backup (.json)**. REP reminds you when your last backup is more than 14 days old.
- **Restore:** Settings → **Restore from a backup file**. You'll see a preview of what the file contains. Then choose **Merge**, which adds anything new and leaves existing records unchanged, or **Replace all**, which makes the device match the backup and asks for confirmation first.
- **CSV:** Sessions CSV and Sets CSV open in Numbers or Excel. Text cells that start with `=`, `+`, `-` or `@` are escaped so they can't run as formulas.

### What a backup contains

Schema version, export time, workout templates, exercises (including your edits and custom exercises), sessions, sets, notes, settings, recovery routines and logs, body-weight entries, and references to attached media (file name and credit only).

**Media files themselves are not in the backup.** Re-attach them on a new device.

### Backup files are personal information

They contain your training history, notes and body weight. Store them somewhere private. Don't commit them to a Git repository. The `.gitignore` excludes the default backup file names.

### Moving data is not syncing

Copying a backup to another device copies a snapshot. Changes made afterwards on either device stay on that device until you export and import again.

## Imported files are treated as untrusted

Imports are limited to 10 MB and must be REP backups with a schema version this app understands. Each field is validated, unknown fields are dropped, identifiers are restricted to safe characters, and notes are always shown as plain text, never as HTML. Media paths can only resolve inside the app's own `media/` folder. Nothing in an imported file is ever run as code.
