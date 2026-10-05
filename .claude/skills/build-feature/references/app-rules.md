# App rules for every feature

These rules come from decisions made with the owner. Follow them unless a signoff explicitly says otherwise.

## What the app is
A newborn routine log for two parents (feeds, sleep, pee, poop, crying, growth). It is an installable web app (PWA) hosted as static files. It must work on a phone, with one hand, at night.

## Offline first
- The phone is the main store. Save every entry on the device first (IndexedDB), then sync later.
- Cache the app files with a service worker so the app opens with no internet.
- Never block logging because the network is down.

## Data format (portable)
One record per entry, stored as plain JSON:

```
v           format version: 2. An entry without v is version 1 (made before feature 014)
id          unique string (client generated)
type        feed | sleep | pee | poop | cry | growth | profile
babyId      the baby it belongs to (the id of that baby's profile). Required from version 2
t           start time, milliseconds since 1970 (UTC)
end         end time in ms, or null (sleep only)
d           object with the type-specific fields from the signoff
note        text, may be empty
by          name of who logged it, may be empty
deviceId    id of the phone that last wrote the record
updatedAt   ms time of the last change
deleted     true if the entry was removed (a "tombstone"), otherwise absent
```

Babies (feature 014): every entry belongs to one baby. Nothing can be logged until a baby is chosen, and screens show only the chosen baby's entries (`src/baby.js`; the choice is kept on the phone as meta `currentBaby`, not synced).
- **Version 1 entries** (no `v`, no `babyId`) belong to the baby with the id `'profile'`, the one profile of feature 002. They are read with this rule and never rewritten. A phone that has such entries but no profile shows them as "Entries from before"; adding the details creates the profile `'profile'`.
- **Unreadable entries** (`src/schema.js`): a version higher than this app's (`'newer'`), or a missing or wrong field (`'invalid'`). They are kept, synced and exported in JSONL as they are, but not shown and not in the CSV. The Sync screen counts them. Fields the app does not know are allowed and kept.
- A change to the format raises `v` (in `records.js`) and teaches `schema.js` to read the older versions.

Profile (feature 002): one record per baby with `type: 'profile'`. Its `id` is the baby's id (the first profile has `id: 'profile'`, later ones a random id) and its `babyId` is the same. It merges like every other entry (newest `updatedAt` wins). `d` has `nickname` (up to 20 characters), `dateOfBirth` (`YYYY-MM-DD`), `sex` (`'girl'` or `'boy'`, picks the WHO tables) and `photo` (a small square JPEG as a `data:` URL, or an empty string). `t` is when it was first saved. It is not a log entry, so lists and totals ignore it.

Feed details inside `d` (features 006, 007, 012):
- Breast: `kind: 'Breast'`, `side: 'Left' | 'Right' | 'Both'`, `min` (total whole minutes), and optional `leftMin` and `rightMin` (whole minutes per side). When the per-side fields are present, `min = leftMin + rightMin`. Entries saved before feature 012 have only `side` and `min`.
- Bottle: `kind: 'Bottle'`, `milk: 'Formula' | 'Breast milk'`, `ml` (0 to 240).

Growth details inside `d` (feature 010): `weight` (grams, a whole number) and `height` (length in cm, measured lying down, one decimal). A measurement has one or both. `t` is when it was measured (midday for a date that is not today). The WHO numbers are in `src/who-data.js` (made by `scripts/make-who-data.mjs`; see `docs/research/who-growth-standards.md`).

Sleep details inside `d` (features 003, 004): `source: 'live'` (tapped Start sleep / Wake up as it happened) or `'manual'` (added afterwards). A running sleep has `end: null`.

- Never overwrite history silently. To remove an entry, set `deleted: true` and update `updatedAt`.
- Keep a CSV export. One row per entry, with readable columns. The first version of the columns is in the earlier prototype's export; keep those names. New columns go at the end (`baby_id` and `baby` name each row's baby).
- Do not store anything that would lock the data into one backend. The same JSON must be easy to move to another database later.

## Sync with Google Drive
Full reasoning and rejected options: `docs/adr/ADR-001-data-storage-and-sync.md`. Sync is a feature of its own and goes through a signoff.

- **One shared Google account.** Both phones sign in with the same account, made only for baby-log. Its password and 2-step code live in 1Password. No credentials in the repository; only the public OAuth client ID may appear in code.
- **Scope `drive.appdata`** (the hidden app-data folder). It needs no app review and does not show in the normal Drive.
- **One file per phone.** Layout: `baby-log/devices/<deviceId>.jsonl` for LIVE and `baby-log-test/devices/<deviceId>.jsonl` for TEST (the name is `driveFolder` in `src/config.js`). Format is JSON Lines: one full record per line, in the record format above.
- **A phone writes only its own file**, never another phone's. A change appends a line with the full record and a new `updatedAt`. A delete appends the record with `deleted: true`.
- **Compaction.** A phone may rewrite its own file and keep only the newest line per `id` (tombstones included). This is safe because only that phone writes that file.
- **Push** after a change (short debounce) and when the network returns. **Pull** when the app opens, when the network returns, and every few minutes while open. A pull lists `devices/*.jsonl`, downloads the files that changed since the last pull, and merges each line into the phone store.
- **Merge rule.** Match by `id`. The larger `updatedAt` wins. A tombstone wins over an older live record. If `updatedAt` is equal, the record whose `deviceId` sorts higher wins, so every phone reaches the same result.
- **New or reset phone:** sign in, pull all files, merge, continue.
- **Sign-in tokens** last about one hour and live in memory only. Open Google's sign-in window **only from a tap**: on phones even a "quiet" renewal opens a window, and doing it automatically caused a loop (2026-10-04). Without a good token, show "Sign in to sync" and wait.
- **Status shown to the user:** synced, waiting for network, or sign-in needed.
- **Export.** Keep the CSV export (prototype column names) and add a JSONL export of all records. The hidden folder cannot be browsed, so the export buttons are the way to get the data out. DuckDB is for later analysis only, not used inside the app.

## Test data stays separate
A test build must never touch the real data. Use a different storage name prefix (for example `test-`) and a different Drive folder name for test builds. Show a clear "TEST" label in the app when running as a test.

## Shared origin: protect real data in code
TEST (`/baby-log/test/`), LIVE (`/baby-log/`) and any other GitHub Pages site of this account run on one origin, so they can see each other's storage. The owner chose to protect data in code for now:
- All storage goes through `src/store.js`. Its database name is fixed from the build: `test-baby-log` for TEST, `baby-log` for LIVE. It refuses any other name.
- Never list, open or delete other databases (`indexedDB.databases()`, `indexedDB.deleteDatabase`). Tests check this.
- Ask the browser to keep the data (`navigator.storage.persist()`), so it is not cleared when the phone is low on space.
- Do not publish other GitHub Pages sites on this account while it holds real data, or move LIVE to its own domain first.

## Security and hosting
- Only a client ID may appear in the code. No secrets.
- Static hosting only. No servers.
- Changes reach `main` only by a pull request. Claude Code may merge it once checks pass. Direct pushes to `main` are blocked.

## Two addresses: test and live
- `main` publishes the TEST address automatically.
- The LIVE address changes only when a feature is marked Done (see `feature-ready`). The **Release LIVE** workflow does this; see `DEPLOY.md`.
- Keep the steps in `DEPLOY.md` at the repository root: how each address is published, how to roll back, and the two links. Create it in the first build if it is missing.
- Rolling back live must be one simple step.
