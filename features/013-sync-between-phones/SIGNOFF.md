---
id: 013
name: Sync between phones
slug: sync-between-phones
status: Testing
updated: 2026-10-03
---

# 013 Sync between phones

## In one line

Both parents see each other's entries, and the data survives a lost phone, using the plan in ADR-001.

## What we decided

- The plan is `docs/adr/ADR-001-data-storage-and-sync.md` (accepted 2026-10-03). One shared Google account. Each phone writes only its own `.jsonl` file in the hidden app-data folder. Every phone reads all the files and merges them. The newest `updatedAt` wins. On a tie, the higher `deviceId` wins.
- This feature has **no Claude Design signoff**. The owner asked for it to be built with placeholders first. The screen is plain and may be restyled later.
- Until the owner puts a real Google client ID in `src/config.js`, sync is switched off and the app says so.

## How it works

- Every entry is saved on the phone first. Sync never blocks logging.
- **Send:** a few seconds after any change, and when the network comes back. The phone adds its new and changed entries to its own file (one line per entry).
- **Receive:** when the app opens, when the phone comes back online, when the app comes back to the front, and every 3 minutes. A new or reset phone reads all files, which restores everything.
- **Status** (a link at the bottom of Today, and the **Sync and data** screen `#sync`): *Sync is not set up yet*, *Sign in to sync*, *Syncing…*, *Synced · 3:02 pm*, *Waiting for network*, *Could not sync*.
- **Sign-in** is Google's token sign-in. The token is kept in memory only, never stored. A phone that signed in before renews quietly when the app opens. If that fails, the status asks for a tap on **Sign in with Google**.
- **Export** (on the same screen): **Download CSV** (the prototype's 22 columns, then `feed_left_min`, `feed_right_min`, `sleep_source`) and **Download JSONL** (every entry, removed ones too).

## Data it captures

No new fields. Sync carries the existing records (and the `profile` record from 002) as they are. One rule is new: on equal `updatedAt`, the higher `deviceId` wins (ADR-001).

## Not in this version

- Live updates (the other phone sees new entries on its next receive).
- Choosing which phone is which ("deviceLabel" in the ADR).
- A real Google account: see "Turn on sync" in `DEPLOY.md`.

## Open questions

- Does Google keep the sign-in alive for more than 7 days while the Google Cloud project is in "Testing" mode? Check when the project is created. If not, publish the OAuth app (the `drive.appdata` scope should need no Google review).

## Build notes
**Built (2026-10-03), with a placeholder client ID. Not yet tried against real Google.**
- `src/sync.js` (new): file names, JSONL, compaction, the push and pull engine. It talks to a small backend interface, so the store of the files can change later.
- `src/drive.js` (new): the Google Drive backend (REST calls to the app-data folder).
- `src/google-auth.js` (new): Google sign-in. Memory-only token. Sync stays off while the client ID starts with `PLACEHOLDER`.
- `src/csv.js` (new): the CSV export.
- `src/sync-ui.js` (new) and the `#sync` screen: status, sign-in, Sync now, export buttons, and the background work.
- `src/store.js`: `mergeIn()` (apply received entries with the merge rule, in one transaction) and `onChange()` (so sync knows when to send). `src/records.js`: `isNewer()`, the merge rule with the tie-break.
- `src/config.js`: `googleClientId: 'PLACEHOLDER'`.
- **Tests:** unit tests for the engine, merge rule, JSONL, Drive calls and CSV (against a fake Drive, `tests/fake-drive.mjs`). Browser tests with two phones, a stub of Google's sign-in script and the fake Drive: sign in, send, receive, no network, a refused token, a quiet sign-in after restart, and the exports.
- **What the tests cannot show:** how real Google behaves (the sign-in window, the token life, Drive limits). That is the first thing to check once the client ID exists.

**Test link.** https://oudam-meas.github.io/baby-log/test/ (sync shows "not set up yet" there until the client ID is added).

## Feedback
(Filled in when someone tests it. Leave empty at sign-off.)
