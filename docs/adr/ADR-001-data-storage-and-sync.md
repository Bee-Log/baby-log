# ADR-001: Data storage and sync

- **Status:** Proposed. The owner accepts it by merging the pull request that adds this file.
- **Date:** 2026-10-03
- **Decider:** owner (oudam-meas)
- **Where it goes:** `docs/adr/ADR-001-data-storage-and-sync.md`

## Context

Two parents log a newborn's routines on their own phones. They log feeds, sleep, nappies, crying and growth, often at night with one hand.

What we need:

- Logging must work fully offline and never wait for the network.
- Each parent must see the other parent's entries. Live updates are not required. Seeing them when the app opens is enough.
- The data must survive a lost phone or cleared browser data.
- No servers to run. No cost at this size.
- The data must stay portable, so an AI or DuckDB can analyse it later.

A problem with the earlier plan: Google Drive's hidden app-data folder is private to one Google account. If each parent signs in with their own account, the phones never see each other's data.

## Decision

Work like WhatsApp backups, but with one backup file per phone. Both phones use one shared Google account.

### 1. One shared Google account for the app

- The owner creates a Google account only for baby-log.
- Its password and 2-step code are kept in 1Password, shared by both parents.
- Both phones sign in to the app with this account.
- No credentials ever go into the repository. Only the public OAuth client ID may appear in code.

### 2. The phone is the main store (structured)

IndexedDB on each phone holds the structured data:

| Store | Key | Indexes | Purpose |
|---|---|---|---|
| `records` | `id` | `type`, `t`, `[type, t]`, `updatedAt` | every entry, in the record format from `app-rules.md` |
| `meta` | key name | none | `deviceId`, `deviceLabel`, last sync time, last seen version of each device file |

- Every entry is saved here first. Sync happens after.
- Derived views (today's feeds, last sleep, daily totals) are computed from `records`. They may be cached, but they can always be rebuilt.
- Test builds use the `test-` prefix for every database and store name (already in `src/config.js`).

### 3. Google Drive holds simple files (one per phone)

- Scope: `drive.appdata` (the hidden app-data folder). It does not show in the normal Drive.
- Layout inside the app-data folder:

```
baby-log/devices/<deviceId>.jsonl        LIVE builds
baby-log-test/devices/<deviceId>.jsonl   TEST builds
```

- Format: JSON Lines. One full record per line, in the record format from `app-rules.md`.
- Each phone only ever writes its **own** file. It never writes another phone's file.
- A change appends a new line with the full record and a new `updatedAt`. A delete appends the record with `deleted: true`.
- Compaction: a phone may rewrite its own file, keeping only the newest line per `id` (tombstones included). This is safe, because only that phone writes that file.

### 4. Sync

- **Push:** after a change (short debounce), and when the network comes back.
- **Pull:** when the app opens, when the network comes back, and every few minutes while the app is open.
- **Pull steps:** list `devices/*.jsonl`, download the files that changed since the last pull, and merge each line into `records`.
- **Merge rule (unchanged):** match by `id`. The larger `updatedAt` wins. A tombstone wins over an older live record.
- **Tie-break (new):** if `updatedAt` is equal, the record whose `deviceId` sorts higher wins. This makes every phone reach the same result.
- **New or reset phone:** sign in, pull all files, merge, and continue. This is the WhatsApp-style restore.
- **Sign-in:** browser tokens last about one hour. Renew them quietly. Show a small "Sign in again" button only if renewal fails.
- **Status shown to the user:** synced, waiting for network, or sign-in needed.

### 5. Export and analysis

- The app keeps the CSV export (the column names come from the prototype). It also gets a JSONL export of all records.
- The hidden folder cannot be browsed on the Drive website, so the export buttons are the way to get the data out.
- Later analysis (DuckDB, AI) reads the exported JSONL or CSV. DuckDB is **not** used inside the app.

## Consequences

**Good**

- It is a small change from the rules already decided. The merge rules stay the same.
- No new cloud service, no server, no app review. As far as we know, `drive.appdata` needs none. Confirm this when setting up Google Cloud.
- Drive itself is the backup. A new phone restores by pulling.
- The files are plain JSON Lines and portable.

**Bad, accepted**

- Anyone with the 1Password entry can read all the data.
- No live updates. The other phone sees new entries on its next pull.
- The data can only be taken out through the app's export buttons.
- Device files grow until they are compacted. This is fine at this data size.

## Alternatives considered

| Option | Why not chosen |
|---|---|
| Each parent's own Google account, hidden folder | The phones cannot see each other's data. |
| Shared normal Drive folder (`drive.file` and Google Picker) | Works across two accounts, but needs a picker step and more permission handling. Not needed now that we share one account. |
| One shared backup file, exactly like WhatsApp | Two phones would overwrite each other's entries. |
| Firebase Firestore | Live updates, but adds a hosted database, its own login, and a non-portable format. |
| Cloudflare R2, plus a daily Worker copy to Google Drive | Works with any accounts, but adds a cloud account, an access key on each phone, and a scheduled job. Keep it as the fallback if we leave Google. |
| DuckDB-WASM as the phone store | Built for analysis, not small frequent writes. No sync. Large download. Use it for analysis only. |

## Changes for Claude Code to make

Do these in one pull request. The owner must approve it, because it changes the sync rules.

1. Add this file as `docs/adr/ADR-001-data-storage-and-sync.md`.
2. Update `.claude/skills/build-feature/references/app-rules.md`, section "Sync with Google Drive", to match sections 1 to 4 above. Include the shared account, the file layout, the append-only device files, compaction, and the tie-break.
3. Update `CLAUDE.md`, "Decisions already made". Replace the sync line with one line pointing to this ADR.
4. Add `driveRoot: 'baby-log' | 'baby-log-test'` to `src/config.js` if it is not already covered by `driveFolder`. Do not build sync yet. Sync is a feature, and it goes through a signoff.
5. Run `npm test` and `npm run build`. Open the pull request. Do not merge it until the owner approves.

## Owner tasks (outside the repo)

1. Create the shared Google account. Store the password and 2-step code in 1Password.
2. Create a Google Cloud project and an OAuth client ID of type "Web application".
   - Authorised JavaScript origin: `https://oudam-meas.github.io`
   - Scope: `https://www.googleapis.com/auth/drive.appdata`
   - While the consent screen is in "Testing" mode, add the shared account as a test user.
3. Give the client ID to the build session. It is public and may go in `src/config.js`. Never share the client secret.
