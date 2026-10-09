---
id: 011
name: Edit an entry
slug: edit-an-entry
status: Done
updated: 2026-10-03
---

# 011 Edit an entry

## In one line
Fix or delete a nappy or feed after it was saved, by tapping its row on Today.

## What we decided
- This feature comes from the owner's request in a build session ("allow edit too after save"). It was **not designed in Claude Design**, so there is no canvas screen.
- **Editing a feed uses the Feed screen itself**, not a separate form. It opens with the entry's values, with the same Breast / Bottle switch at the top and the same controls. The owner asked for this after trying a first version with a different form: logging and editing must look and work the same.
- Every row in the Today list is tappable ("Tap a row to edit" is in `features/001-install-and-open-the-app/artifacts/Main.dc.html`). The close button returns to Today without changes.
- **Breast feed:** the same round Left and Right buttons, now used as choices (choose one, or both for "Both"; at least one stays chosen). The minutes are typed in the same style as the bottle amount, with −1 / +1. "Started at" and the note are in the card below.
- **Bottle feed:** exactly the bottle controls used for logging: drag the bottle, type the amount, −10 / +10, Formula or Expressed, and "Fed at".
- **The kind can be changed.** The parent can switch Breast / Bottle while editing, to fix a feed saved as the wrong kind. The details of the other kind start from defaults, and the note is kept.
- **Nappy:** a small screen with the time and Delete. A "Wee + Poo" row is two entries. A time change moves both by the same amount, and Delete removes both. A nappy cannot be changed from Wee to Poo (delete it and log the right one).
- **Delete** is on the edit screens. It asks for a second tap ("Tap again to delete"). **There is no Undo for now**, because the Undo button covered other buttons (owner feedback).
- The time stays inside the same Today (6 am to 6 am), and can never be more than 5 minutes ahead of now.

## How it should work
1. Tap a row on Today. The Feed screen (or the nappy screen) opens with the saved values.
2. Change what is wrong. Tap **Save changes**. The app returns to Today and shows the new values.
3. Or tap **Delete this entry**. The row goes away.

## Data it captures
No new fields and no change to the record format.
- An edit changes the entry **in place**: the same `id`, new values in `t`, `d` and `note`, a newer `updatedAt`, and this phone's `deviceId`.
- This is the existing merge rule: the newest `updatedAt` wins.
- Delete sets `deleted: true` and a newer `updatedAt` (a tombstone).
- Fields that can change: feed `t`, `d.kind`, `d.side`, `d.min`, `d.ml`, `d.milk`, `note`; nappy `t`.
- Changing a feed between Breast and Bottle replaces `d` with the new kind's fields. Nothing is left over from the old kind.

## Not in this version
- Entries from other days (Today only shows today).
- Changing a nappy from Wee to Poo.
- Time per side for breast feeds.
- Editing sleep (sleep is not built yet).

## Open questions
- Does the partner like the look? The edit form reuses the Feed screen, so it should feel familiar.
- Should Undo come back? It is removed for now. Delete asks for a second tap instead.

## Artifacts
None. This feature has no Claude Design screen. It reuses the Feed screen (`features/006-log-a-breast-feed/artifacts/Feed.dc.html`).

## Build notes
**Update (2026-10-03, after the owner tried it).** Undo was removed: the Undo button covered other buttons. Delete now asks for a second tap. The notes below were written before that, so wherever they mention Undo, read "removed". Other changes: **Fed at** and **Note** are the card for both kinds, the **Expressed** button fits on small phones, and messages sit at the top of full screens, above the TEST banner. See `docs/ux/feed-and-edit-experience.md`.

**Built (2026-10-03), then rebuilt the same day after the owner's feedback.**

*First version.* A separate Edit screen with different controls (Left / Right / Both chips, a different layout). The owner tried it and said it was not like the logging form.

*Now.* Editing a feed opens the **Feed screen itself** (`#edit/<id>`), so logging and editing share one form.
- The Breast / Bottle switch is at the top. Switching kind while editing turns the entry into the other kind.
- Bottle: the same bottle, amount, −10 / +10, milk and "Fed at" as for logging.
- Breast: the same round Left / Right buttons, used as choices. Minutes are typed in the same style as the bottle amount (−1 / +1). "Started at" and the note are in the card.
- Logging shows the timer and "Last time" or "Last bottle". Editing shows the typed minutes and "Started at" instead, plus **Save changes** and **Delete this entry**.
- A nappy keeps a small screen (`edit-ui.js`): the time and Delete.
- After **Save changes** or **Delete**, a message offers **Undo** for 6 seconds ("Change undone" or "Restored"). Saving with nothing changed just returns to Today and writes nothing.
- A time that has not happened yet is refused ("That time has not happened yet."). An app update waits while an edit screen is open.

**Data.** No change to the record format and no new fields.
- An edit keeps the same `id` and sets a newer `updatedAt` and this phone's `deviceId`. The existing rule applies: the newest `updatedAt` wins.
- Delete writes a tombstone. Undo writes the earlier values back with an `updatedAt` newer than the edit or tombstone, so Undo wins everywhere, even if the phone clock is behind.
- Details the screen does not know are kept when the kind stays the same.

**Files changed (this rebuild).** `src/feed-ui.js` (edit mode on the Feed screen), `src/edit-ui.js` (now nappy only), `src/app.js` (routing by entry type, one shared "save with Undo"), `src/records.js` (shared helpers), `src/index.html`, `src/styles.css` (a global `[hidden]` rule), `tests/browser/edit.test.mjs` (rewritten).

**Test link.** https://oudam-meas.github.io/baby-log/test/

**Tested.**
- `npm test`: 43 pass, also in Melbourne and New York time zones.
- `npm run test:browser`: 27 pass, 3 runs in a row. The edit tests use a fixed clock (2 pm). They cover: the Feed screen opening in edit mode with the switch and the same controls; changing a bottle (offline) and Undo; the Left / Right choices and typed minutes; switching Breast <-> Bottle while editing; a Wee + Poo row; delete and Undo; a future time refused; Save with no change; a missing entry; and an update waiting while editing.
- A global rule now makes the `hidden` attribute always win over a style that sets `display`. An earlier test found that kind of bug once (breast fields showing on the bottle screen).
- `npm run build` passes. Screenshots at phone size were checked.

**Choices the signoff did not cover.**
- There is no Claude Design screen. The look is the Feed screen's. The partner should say if she wants it changed.
- No "Are you sure?" on Delete, because Undo is there.
- Time per side is still not stored (only the side and the total minutes).
- Editing keeps an entry inside its own Today (6 am to 6 am). A time before 6 am means after midnight.

**Known gaps.**
- Only today's entries can be edited, because Today shows only today.
- Like everything else, edits stay on this phone until sync is built.

## Feedback
- 2026-10-03 (owner): the first version used a different form from logging, with different controls. Rebuilt so editing opens the Feed screen itself.
- 2026-10-03 (owner): the edit form must be the same as the logging form. Done in the second version.
- 2026-10-03 (owner): **Expressed** overflowed its button; a stray line under Fed at; the Undo button covered other buttons. Fixed: narrower bottle on small phones, one line only between two visible rows, Undo removed (Delete asks for a second tap), messages sit at the top of full screens.
- 2026-10-03 (owner): **Fed at** and **Note** are now the card for both Breast and Bottle, when logging and when editing.
- 2026-10-03 (owner): released to LIVE on the owner's instruction ("Release them"). The owner had tried it on TEST; the partner's test was not waited for.
- 2026-10-09 (owner): the date of a wee or poo can be edited, not only the time. Edit nappy now has **Date and time**. A nappy moved to another day leaves the Today list, and the message says where it went. No change to the record format.
