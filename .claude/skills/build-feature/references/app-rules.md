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
id          unique string (client generated)
type        feed | sleep | pee | poop | cry | growth
t           start time, milliseconds since 1970 (UTC)
end         end time in ms, or null (sleep only)
d           object with the type-specific fields from the signoff
note        text, may be empty
by          name of who logged it, may be empty
deviceId    id of the phone that last wrote the record
updatedAt   ms time of the last change
deleted     true if the entry was removed (a "tombstone"), otherwise absent
```

Feed details inside `d` (features 006, 007, 012):
- Breast: `kind: 'Breast'`, `side: 'Left' | 'Right' | 'Both'`, `min` (total whole minutes), and optional `leftMin` and `rightMin` (whole minutes per side). When the per-side fields are present, `min = leftMin + rightMin`. Entries saved before feature 012 have only `side` and `min`.
- Bottle: `kind: 'Bottle'`, `milk: 'Formula' | 'Breast milk'`, `ml` (0 to 240).

- Never overwrite history silently. To remove an entry, set `deleted: true` and update `updatedAt`.
- Keep a CSV export. One row per entry, with readable columns. The first version of the columns is in the earlier prototype's export; keep those names.
- Do not store anything that would lock the data into one backend. The same JSON must be easy to move to another database later.

## Sync with Google Drive
- Use the hidden app data folder in Google Drive (scope `drive.appdata`). It needs no app review and does not show in the user's normal Drive.
- Each device writes its own file of records. On sync, read the other device files and merge by `id`. The record with the larger `updatedAt` wins. A tombstone wins over an older live record.
- Sync when the app opens, after changes, and when the network comes back. Sign-in tokens in a browser expire about hourly; renew quietly and show a small "Sign in again" button only if renewal fails.
- A new phone signs in, pulls all files, merges, and continues.
- Show a small, honest sync status: synced, waiting for network, or sign-in needed.

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
