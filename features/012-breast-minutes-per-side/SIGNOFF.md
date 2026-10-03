---
id: 012
name: Breast minutes per side
slug: breast-minutes-per-side
status: Building
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
(Filled in by the build step. Leave empty at sign-off.)

## Feedback
(Filled in when someone tests it. Leave empty at sign-off.)
