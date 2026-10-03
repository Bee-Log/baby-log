---
id: 011
name: Edit an entry
slug: edit-an-entry
status: Testing
updated: 2026-10-03
---

# 011 Edit an entry

## In one line
Fix or delete a nappy or feed after it was saved, by tapping its row on Today.

## What we decided
- This feature comes from the owner's request in a build session ("allow edit too after save"). It was **not designed in Claude Design**, so there is no canvas screen. It reuses the look of the Feed screen (features 006 and 007). The partner should review the look when she tests it.
- Every row in the Today list is tappable ("Tap a row to edit" is in `features/001-install-and-open-the-app/artifacts/Main.dc.html`). A tap opens an Edit screen for that entry. The close button returns to Today without changes.
- **Breast feed:** the parent can change the started time, the side (Left, Right or Both), the minutes and the note.
- **Bottle feed:** the parent can change the fed time, the amount (0 to 240 ml, same controls as when logging) and the milk (Formula or Expressed).
- **Nappy:** the parent can change the time. A "Wee + Poo" row is two entries. A time change moves both by the same amount, so their order stays.
- **Delete** is on the same screen. It removes the entry (or both entries of a "Wee + Poo" row).
- **Undo** is offered for 6 seconds after "Save changes" and after "Delete".
- The time stays inside the same Today (6 am to 6 am), and it can never be in the future.
- A nappy cannot be changed from Wee to Poo. The parent deletes it and logs the right one.

## How it should work
1. Tap a row on Today. The Edit screen opens with the saved values.
2. Change what is wrong. Tap **Save changes**. The app returns to Today and shows the new values.
3. Or tap **Delete this entry**. The row goes away.
4. If it was a mistake, tap **Undo** in the message at the bottom.

## Data it captures
No new fields and no change to the record format.
- An edit changes the entry **in place**: the same `id`, new values in `t`, `d` and `note`, a newer `updatedAt`, and this phone's `deviceId`.
- This is the existing merge rule: the newest `updatedAt` wins.
- Delete sets `deleted: true` and a newer `updatedAt` (a tombstone). Undo writes the earlier values back with an even newer `updatedAt`.
- Fields that can change: feed `t`, `d.side`, `d.min`, `d.ml`, `d.milk`, `note`; nappy `t`.

## Not in this version
- Entries from other days (Today only shows today).
- Changing a nappy from Wee to Poo.
- Time per side for breast feeds.
- Editing sleep (sleep is not built yet).

## Open questions
- Does the partner like the look? There is no design for this screen.
- Should "Delete" ask "Are you sure?" It does not now, because Undo is there and a night-time parent has one hand free.

## Artifacts
None. This feature has no Claude Design screen. It reuses the controls of the Feed screen (`features/006-log-a-breast-feed/artifacts/Feed.dc.html`).

## Build notes
**Built (2026-10-03).**
- Every row in the Today list is now a link. The small text "Tap a row to edit" sits next to the "Today" title, as in the design.
- A new **Edit screen** (`#edit/<ids>`) opens for the tapped row. It has a close button, **Save changes** and **Delete this entry**.
  - Breast feed: started time, side (Left, Right, Both), minutes (type, or −1 / +1) and note.
  - Bottle feed: fed time, amount (type, or −10 / +10, 0 to 240 ml) and milk (Formula or Expressed).
  - Nappy: the time. A "Wee + Poo" row moves both entries by the same amount, and Delete removes both.
- After **Save changes** or **Delete**, a message offers **Undo** for 6 seconds. Undo says "Change undone" or "Restored".
- **Save changes with nothing changed** just returns to Today and writes nothing.
- A time that has not happened yet is refused ("That time has not happened yet."). Up to 5 minutes ahead is allowed, because the time picker works in 5-minute steps.
- An app update waits while the Edit screen is open, so a half-finished edit is not lost.

**Data.** No change to the record format and no new fields.
- An edit keeps the same `id` and sets a newer `updatedAt` and this phone's `deviceId`. The existing rule applies: the newest `updatedAt` wins.
- Delete writes a tombstone. Undo writes the earlier values back with an `updatedAt` newer than the edit or the tombstone, so Undo wins over it everywhere, even if the phone clock is behind.
- Details this screen does not know are kept, not dropped.

**Files changed.** `src/edit-ui.js` (new: the Edit screen), `src/records.js` (revise, restore, time inside a day), `src/store.js` (read one entry, save several in one step), `src/nav.js` (`#edit/<ids>`), `src/app.js` (tappable rows, routing, Undo message), `src/index.html`, `src/styles.css`, `src/sw.js` (new file in the offline list), `tests/edit.test.mjs` and `tests/browser/edit.test.mjs` (new), `tests/browser/helpers.mjs` (helpers to put entries into storage).

**Test link.** https://oudam-meas.github.io/baby-log/test/

**Tested.**
- `npm test`: 43 pass, also in Melbourne and New York time zones.
- `npm run test:browser`: 25 pass, 3 runs in a row. The edit tests use a fixed clock (2 pm), so they behave the same at any time of day. They cover: changing a bottle (offline) and Undo; changing a breast feed; a Wee + Poo row (time change, delete, Undo); deleting a feed and Undo; a future time refused; Save with no change; a missing entry; and an update waiting while the Edit screen is open.
- A test found a real bug before release: on the bottle Edit screen the breast fields also showed. It is fixed, and the test now guards it.
- `npm run build` passes. Screenshots at phone size were checked.

**Choices the signoff did not cover.**
- There is no Claude Design screen, so the look follows the Feed screen. The partner should say if she wants it changed.
- No "Are you sure?" on Delete, because Undo is there.
- The note can be edited on breast feeds only, because only the breast screen has a note.
- Editing keeps an entry inside its own Today (6 am to 6 am). A time before 6 am means after midnight.

**Known gaps.**
- Only today's entries can be edited, because Today shows only today.
- Editing, like everything else, stays on this phone until sync is built.

## Feedback
(Filled in when someone tests it. Leave empty at sign-off.)
