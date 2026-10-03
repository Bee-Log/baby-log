---
id: 005
name: Log a nappy
slug: log-a-nappy
status: Done
updated: 2026-10-03
---

# 005 Log a nappy

## In one line

Record a wee or a poo with one tap.

## What we decided

- Nappy logging is one tap: separate Wee and Poo buttons on Today, no form.

## How it should work

- See `artifacts/Main.dc.html`.
- Tap Wee or Poo on Today.
- Nappies appear in the Today timeline, for example "Nappy · Wee" or "Nappy · Wee + Poo".

## Data it captures

- Common record fields as in `app-rules.md`: `id`, `t`, `end`, `note`, `by`, `deviceId`, `updatedAt`, `deleted`. Times are milliseconds since 1970 (UTC).
- Wee button: one record, `type` — `'pee'`, `t` — when tapped.
- Poo button: one record, `type` — `'poop'`, `t` — when tapped.
- Wee and poo together = two records (one `pee`, one `poop`) with the same `t`.
- One tap saves no `d` fields. The prototype's optional `d.amount` (pee) and `d.colour`, `d.texture`, `d.size` (poop) are not in this design.

## Not in this version

- Edit the time of a nappy.

## Open questions

- How to log wee and poo together in the screen: one button, or both taps (two records either way)?
- How to undo a wrong tap? (`app-rules.md`: removal sets `deleted: true`.)

## Artifacts

- `artifacts/Main.dc.html` — Today screen (artboard "1 · Today (home)"): header with profile link, last feed card, sleep panel with Start / Wake toggle, Feed / Wee / Poo buttons, today's timeline, bottom navigation. For this feature: the Wee and Poo buttons and the nappy rows in the timeline. Design prototype from the "Simple Baby Log" canvas; it needs the canvas runtime (`support.js`) to run, so open it in the canvas or read it as a reference.

## Build notes
**Built (2026-10-03).**
- Today shows two large peach buttons, **Wee** and **Poo** (as in `artifacts/Main.dc.html`). One tap saves an entry with the current time. No form.
- After each tap, a message at the bottom says "Wee saved" or "Poo saved", with an **Undo** button for 6 seconds. Undo marks the entry `deleted: true` (a tombstone), so sync can carry the delete later.
- Under the buttons, a "Today" list shows nappies, newest first: "Nappy · Wee", "Nappy · Poo" or "Nappy · Wee + Poo".
- This is the first feature that stores data. All storage goes through `src/store.js`, with the shared-origin safeguards the owner chose (option C, recorded in `CLAUDE.md` and `app-rules.md`).

**Files changed.** `src/records.js` (new: record format, tombstone, 6 am day, nappy rows), `src/store.js` (new: IndexedDB, safeguards), `src/app.js`, `src/index.html`, `src/styles.css`, `src/sw.js` (new files in the offline list), `tests/records.test.mjs` (new), `tests/browser/nappy.test.mjs` (new), `tests/browser/helpers.mjs` (new, shared by the browser tests), `tests/browser/update.test.mjs` (uses the shared helpers), `CLAUDE.md` and `.claude/skills/build-feature/references/app-rules.md` (data-protection decision).

**Test link.** https://oudam-meas.github.io/baby-log/test/

**Tested.**
- `npm test`: 19 pass. Includes the exact record fields from `app-rules.md`, refusing bad records, tombstones that always move `updatedAt` forward, the 6 am day (also on a 23-hour daylight-saving day, run in four time zones), nappy grouping, and the storage-name safeguards.
- `npm run test:browser`: 8 pass, 3 runs in a row. New: one tap saves and survives a reload; wee and poo show as one row but are two records; Undo leaves a tombstone; logging works offline; TEST entries never reach LIVE storage; an update does not reload the page while Undo is showing.
- `npm run build` passes. A screenshot at phone size matches the design.

**Choices the signoff did not cover.**
- Wee and poo together: tap both buttons. That makes two records (as the signoff says). A wee and a poo within 2 minutes show as one "Wee + Poo" row.
- Wrong tap: an Undo message for 6 seconds, as in the earlier prototype.
- The **Feed** button is not shown yet. It comes with 006 and 007. "Tap a row to edit" is not shown, because editing is not designed.
- "Today" means 6 am to 6 am, as decided in 008.
- Storage indexes follow ADR-001 (`type`, `t`, `[type, t]`, `updatedAt`), so later features need no data migration.
- The app asks the browser to keep the data (`navigator.storage.persist()`).
- An update now waits until the Undo message has gone before it reloads the page (the limit noted in 001).

**Known gaps.**
- Entries stay on the phone that logged them. The other parent does not see them yet. Sync is not signed off yet (see ADR-001).
- Clearing the browser data, or uninstalling the app, deletes the entries on that phone until sync exists.

## Feedback
- 2026-10-03: Tested OK on the TEST address (Wee, Poo, Undo, offline, entries kept after closing the app).
