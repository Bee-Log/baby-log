---
id: 013
name: Sync between phones
slug: sync-between-phones
status: Done
updated: 2026-10-05
---

# 013 Sync between phones

## In one line

Both parents see each other's entries, and the data survives a lost phone, using the plan in ADR-001.

## What we decided

- The plan is `docs/adr/ADR-001-data-storage-and-sync.md` (accepted 2026-10-03). One shared Google account. Each phone writes only its own `.jsonl` file in the hidden app-data folder. Every phone reads all the files and merges them. The newest `updatedAt` wins. On a tie, the higher `deviceId` wins.
- This feature has **no Claude Design signoff**. The owner asked for it to be built with placeholders first. The screen is plain and may be restyled later.
- Sync is switched on by the public Google client ID in `src/config.js` (added 2026-10-04, project `project-45070-beelog`). With an empty or `PLACEHOLDER` value it stays off and the app says so.

## How it works

- Every entry is saved on the phone first. Sync never blocks logging.
- **Send:** a few seconds after any change, and when the network comes back. The phone adds its new and changed entries to its own file (one line per entry).
- **Receive:** when the app opens, when the phone comes back online, when the app comes back to the front, and every 3 minutes. A new or reset phone reads all files, which restores everything.
- **Status** (a link at the bottom of Today, and the **Sync and data** screen `#sync`): *Sync is not set up yet*, *Sign in to sync*, *Syncing…*, *Synced · 3:02 pm*, *Waiting for network*, *Could not sync*.
- **Sign-in** is Google's token sign-in. The token is kept in memory only, never stored. **Google's window opens only when someone taps "Sign in"** (changed 2026-10-04). On a phone, a "quiet" renewal also opens Google's window, and doing it by itself caused a loop: the window opened and closed again and again, and the status stayed on "Syncing…". Now a newly opened app shows "Sign in to sync". After one tap it syncs by itself (after changes, on coming back to the app, and every 3 minutes) until the sign-in runs out after about an hour. Then it shows "Sign in to sync" again.
- **No endless waiting (added 2026-10-04).** The sign-in window gives up after 3 minutes. A sync that has not finished after a minute is treated as failed and can be tried again. The Sync screen shows a small "Details: ..." line with the technical reason, so a failure can be reported exactly.
- **Export** (on the same screen): **Download CSV** (the prototype's 22 columns, then `feed_left_min`, `feed_right_min`, `sleep_source`) and **Download JSONL** (every entry, removed ones too).

## Data it captures

No new fields. Sync carries the existing records (and the `profile` record from 002) as they are. One rule is new: on equal `updatedAt`, the higher `deviceId` wins (ADR-001).

## Not in this version

- Live updates (the other phone sees new entries on its next receive).
- Choosing which phone is which ("deviceLabel" in the ADR).
- A real Google account: see "Turn on sync" in `DEPLOY.md`.

## Open questions

- Signing in about once an hour is the cost of keeping the token in memory only, with no server. Making it last longer needs an owner decision (for example LIVE on its own web address so a token may be stored, or a different sync service).

- Does Google keep the sign-in alive for more than 7 days while the Google Cloud project is in "Testing" mode? Check when the project is created. If not, publish the OAuth app (the `drive.appdata` scope should need no Google review).

## Build notes
**Built (2026-10-03). The real client ID was added on 2026-10-04. Not yet tried against real Google: the first sign-in on a phone is the first real test.**
- `src/sync.js` (new): file names, JSONL, compaction, the push and pull engine. It talks to a small backend interface, so the store of the files can change later.
- `src/drive.js` (new): the Google Drive backend (REST calls to the app-data folder).
- `src/google-auth.js` (new): Google sign-in. Memory-only token. Sync stays off while the client ID starts with `PLACEHOLDER`.
- `src/csv.js` (new): the CSV export.
- `src/sync-ui.js` (new) and the `#sync` screen: status, sign-in, Sync now, export buttons, and the background work.
- `src/store.js`: `mergeIn()` (apply received entries with the merge rule, in one transaction) and `onChange()` (so sync knows when to send). `src/records.js`: `isNewer()`, the merge rule with the tie-break.
- `src/config.js`: `googleClientId` (a placeholder at first; the real public client ID was added on 2026-10-04).
- **Tests:** unit tests for the engine, merge rule, JSONL, Drive calls and CSV (against a fake Drive, `tests/fake-drive.mjs`). Browser tests with two phones, a stub of Google's sign-in script and the fake Drive: sign in, send, receive, no network, a refused token, a quiet sign-in after restart, and the exports.
- **What the tests cannot show:** how real Google behaves (the sign-in window, the token life, Drive limits). That is the first thing to check once the client ID exists.

**Test link.** https://oudam-meas.github.io/baby-log/test/ (sync shows "not set up yet" there until the client ID is added).

## Feedback
- 2026-10-05: Released to LIVE on the owner's instruction ("Yes live"), at commit b9e42f0.
- 2026-10-05: The owner had to tap Sign in twice. Google's script was downloaded only on the tap, and the window opened after the download; a phone can block a window that opens late. Now the script loads when the app opens, so the tap opens Google's window at once.
- 2026-10-05: Released to LIVE at commit e0892cb (owner: "Release now"): sign in with one tap.
- 2026-10-05: Owner decision, after the move to `bee-log.github.io` (its own origin): the sign-in is kept on the phone until it expires (about an hour). A reload or reopening the app within that time stays signed in and syncs at once, without Google's window. After the hour, one tap on Sign in is still needed (Google gives no longer sign-in without a server).
