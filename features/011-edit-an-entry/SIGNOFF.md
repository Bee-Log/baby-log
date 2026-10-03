---
id: 011
name: Edit an entry
slug: edit-an-entry
status: Building
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
(Filled in by the build step. Leave empty at sign-off.)

## Feedback
(Filled in when someone tests it. Leave empty at sign-off.)
