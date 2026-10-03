---
id: 012
name: Breast minutes per side
slug: breast-minutes-per-side
status: Done
updated: 2026-10-03
---

# 012 Breast minutes per side

## In one line
Save and edit the minutes for the Left side and the Right side of a breast feed separately, with compact controls instead of two big round buttons.

## What we decided
- This feature comes from the owner's feedback on features 006 and 011: the big round Left / Right buttons use too much space, "you can select both somehow sometimes", and the owner wants to **edit Left and Right separately**. There is no Claude Design screen yet. The proposal and the other options are in `docs/ux/feed-and-edit-experience.md`.
- **The owner approved two new optional fields** (2026-10-03): `d.leftMin` and `d.rightMin`, whole minutes.
- The breast form has **two compact rows**, Left and Right, about 64 px tall each. The same two rows are used for logging and for editing.
- **Logging:** each row shows that side's running time and one button: **Start** (nothing is running), **Pause** (this side is running) or **Switch** (the other side is running). The running row is highlighted. The big total timer stays at the top.
- **Editing:** each row shows the minutes for that side, with − and + buttons and a number that can be typed. The total is shown at the top as text. Nobody chooses Left, Right or Both: it is worked out from the minutes.
- **Total.** `d.min` stays and always equals `leftMin + rightMin`, so the old rule "minutes in total" and the CSV keep working.
- **Side.** `d.side` stays: `Both` if both sides have time, otherwise the side that has time. If both are 0, the earlier side is kept (or the first side tapped, when logging).
- **Old entries** saved before this feature have only `d.side` and `d.min`. When one is edited, the minutes are split by a guess: all on its side, or half each for `Both`. A note says the split is a guess. If the parent does not change the minutes, nothing is added to the entry.
- The Today list shows "Left 8 · Right 12 min" when both sides have time, and the old "Left 14 min" otherwise.
- The big round buttons are removed.

## How it should work
1. Tap **Feed**. Tap **Start** on a side. The side's time runs and the row is highlighted.
2. Tap **Switch** on the other row to change side. Tap **Pause** to pause. The big total keeps counting only while a side runs.
3. Tap **Stop and save**. The feed is saved with the minutes of each side.
4. To fix it later, tap the feed on Today. The same rows show the saved minutes. Change either side with − / + or by typing. Tap **Save changes**.

## Data it captures
Two new **optional** numbers on a breast feed (`type: "feed"`, `d.kind: "Breast"`), next to the existing fields:
- `d.leftMin`: whole minutes on the left side (0 or more).
- `d.rightMin`: whole minutes on the right side (0 or more).
- `d.min`: total minutes. **Always `leftMin + rightMin`** when the two fields are present.
- `d.side`: `Left`, `Right` or `Both`, as before.

Nothing else changes. Old entries stay valid without the new fields. Merge rules do not change. The CSV export (not built yet) should add `feed_left_min` and `feed_right_min` when it is built.

## Not in this version
- Showing the minutes per side anywhere except the feed form and the Today row.
- Changing the Bottle form.

## Open questions
- Does the partner like the compact rows? The look is a proposal.

## Artifacts
None. No Claude Design screen yet.

## Build notes
**Built (2026-10-03).**
- The two big round buttons are gone. The breast form has **two compact rows**, Left and Right (about 64 px each). The whole form, with the total, the note and Save, fits on one screen.
- **Logging:** each row shows that side's time and one button: **Start**, **Pause** or **Switch**. The running row is highlighted. The big total timer is at the top.
- **Editing:** each row has **−**, a number that can be typed, **min** and **+**. The total shows at the top as "20 min". Nobody chooses Left, Right or Both: the side is worked out from the minutes.
- **Saved fields** (approved by the owner): `d.leftMin` and `d.rightMin`, whole minutes. `d.min` always equals their sum. `d.side` is `Both` when both have time, otherwise the side that has time. If both are 0, the earlier side stays.
- **Rounding.** Each side is rounded to the nearest minute, and the total is the sum of those, so the total never disagrees with the two sides (4 min 24 s on each side is 4 + 4 = 8).
- **Old entries.** An entry saved before this feature has only `d.side` and `d.min`. Editing it shows the minutes split by a guess, with a note. If the parent does not change a number, nothing is added to the entry. Its Today row looks as before.
- **Today row:** "Left 8 · Right 12 min" when both sides have time, otherwise "Left 14 min".

**Files changed.** `src/feed.js` (minutes per side, typed minutes, old entries), `src/feed-ui.js`, `src/records.js` (row label), `src/index.html`, `src/styles.css`, `tests/feed.test.mjs`, `tests/browser/feed.test.mjs`, `tests/browser/edit.test.mjs`, `.claude/skills/build-feature/references/app-rules.md` (feed fields), `docs/ux/feed-and-edit-experience.md`.

**Test link.** https://oudam-meas.github.io/baby-log/test/

**Tested.**
- `npm test`: 44 pass.
- `npm run test:browser`: 31 pass, 3 runs in a row. New or changed tests cover: the compact rows while logging (Start / Pause / Switch, highlight, a row under 80 px tall); a timer with both sides running for 8 and 12 minutes saving `Both, 20, 8, 12`; editing each side separately; the side following the minutes; both at 0; minutes kept in range; an old entry with only a total (a guess, nothing written unless a number changes); switching Breast <-> Bottle; and the rows fitting at 320, 360 and 390 px wide, also with two-digit minutes.
- `npm run build` passes. Screenshots at 320 and 390 px were checked.

**Choices the signoff did not cover.**
- Each side is capped at 300 minutes.
- Switching a bottle to Breast starts at 10 minutes on the left.
- The look follows the Feed screen. There is no Claude Design screen yet.

**Known gaps.**
- The CSV export is not built yet. When it is, it needs `feed_left_min` and `feed_right_min` columns.
- Like everything else, entries stay on this phone until sync is built.

## Feedback
(Filled in when someone tests it. Leave empty at sign-off.)
- 2026-10-03 (owner): released to LIVE on the owner's instruction ("Release them"). The owner had tried it on TEST; the partner's test was not waited for.
