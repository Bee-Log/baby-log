---
id: 004
name: Add a past sleep
slug: add-a-past-sleep
status: Testing
updated: 2026-10-03
---

# 004 Add a past sleep

## In one line

Log a sleep that was not recorded live.

## What we decided

- Duration and From–To are on the same card and work together in any order: set a duration first and place it later, or drag straight away.
- Step buttons +5m, +10m, +20m, +1h add their amount. The last one tapped stays selected and sets the minus button (after +5m the minus is always −5m). The reset arrow sets 30 minutes.
- Parts of day, 6 hours each: 6a–12p, 12p–6p, 6p–12a, 12a–6a, shown with icons. At most two neighbouring parts; 12a–6a and 6a–12p are neighbours.
- The time is picked on an analogue clock ring, not a bar.
- The face is tinted per selected part (morning, afternoon, night, dawn) with its icon.
- Dragging moves in 5-minute steps, can pass over a logged sleep (to reach another gap), and snaps to a logged sleep's edge when close.
- End controls are thin; a grip on the arc moves the whole sleep.
- Exact times use the phone's native time picker pop-up.

## How it should work

- See `artifacts/Sleep.dc.html`.
- The arc on the ring is the sleep; grey arcs are sleeps already logged; the centre shows the length and the time range.
- Drag an end dot or end marker to change "fell asleep" (dark) or "woke up" (gold). Drag on the arc to move the whole sleep. Tap an empty part of the ring to centre the sleep there.
- One part selected: half the ring is active and the other half is greyed out. Two parts: the full ring is active.
- Changing the duration keeps the start and moves the end. If it no longer fits, the start moves back. Over 6 hours, the next part is added. The longest is 12 hours.
- "Fell asleep" and "Woke up" fields open the native picker. Typed times also move the parts of day, including across 6 am (for example 4:00 to 7:00).
- While the sleep overlaps a logged one, the arc turns orange, a message explains it and "Add sleep" is disabled.
- After "Add sleep", the same duration is offered in the next free space.

## Data it captures

- Common record fields as in `app-rules.md`: `id`, `t`, `end`, `note`, `by`, `deviceId`, `updatedAt`, `deleted`. Times are milliseconds since 1970 (UTC).
- `type` — `'sleep'`
- `t` — fell asleep (ms)
- `end` — woke up (ms)
- `d.source` — `'manual'` (new field; the prototype CSV has no column for it)

## Not in this version

none

## Open questions

- Is 12 hours the right maximum?
- Which calendar day does a sleep across midnight belong to?

## Artifacts

- `artifacts/Sleep.dc.html` — Sleep screen (artboard "6 · Sleep"): live sleep panel, "Add a past sleep" card with step buttons, parts of day, clock ring and native time fields, "Logged sleeps" list. For this feature: the "Add a past sleep" card. Design prototype from the "Simple Baby Log" canvas; it needs the canvas runtime (`support.js`) to run, so open it in the canvas or read it as a reference.

## Build notes
**Built (2026-10-03).**
- **"Add a past sleep" card** on the Sleep page (`#sleep`), between the live card and "Logged sleeps", as in `artifacts/Sleep.dc.html`: step buttons (+5m, +10m, +20m, +1h), a minus button for the last step used, a reset arrow (back to 30 minutes), four parts of the day, the 12-hour clock ring, two time fields and the **Add sleep** button.
- **Clock ring.** Drag the start dot or the end dot to change that end. Drag the arc to move the whole sleep. Tap an empty part of the ring to put the sleep there. Everything snaps to 5 minutes. A sleep also snaps to the edge of a logged sleep when it is within 10 minutes.
- **Borders.** A sleep can sit across the 12 or 6 borders (for example 11:45 am to 12:15 pm). While you drag, the parts of the day follow the sleep. A sleep can touch at most two neighbouring parts (the ring shows 12 hours).
- **Which day (changed 2026-10-03, on the owner's feedback).** Each part button says **Today** or **Yesterday** under its hours. A part always means its latest occurrence, so it is always inside the last 24 hours.
- **Dragging is for the last 24 hours only.** A drag cannot go earlier than 24 hours ago or later than now (5 minutes of slack). A sleep typed in from an older date is not pulled back; it can only be nudged.
- **Date and time fields** (instead of time-only fields). Type or pick any date and time, so a sleep older than 24 hours is added by typing. If the end would be before the start, or the sleep over 12 hours, the other time is set to 1 hour from the one just typed.
- **It opens on the 30 minutes that ended now.** After Add, it offers the same length in the next free space.
- **Blocked, with a message and an orange arc:** a sleep that overlaps a logged one ("Overlaps a sleep already logged."), and a sleep that ends more than 5 minutes in the future ("That time has not happened yet."). A sleep that is still running counts as ending now.
- **Saved as the same record as a live sleep:** `type: 'sleep'`, `t` and `end` in ms, `d: { source: 'manual' }`. The owner approved this field with feature 003. No other data change.
- **The open questions.** *Maximum:* 12 hours (the ring shows 12 hours), and the minimum is 5 minutes. *Which day:* each part of the day means its latest occurrence that has already started. At 8 am, "6p-12a" is yesterday evening and "12a-6a" is this morning. So last night's sleep can be added in the morning. The day is fixed when the parts are chosen.
- **An update waits** while the Sleep page is open, so a reload cannot lose a draft.
- The Today list does not show sleeps yet. That is feature 008.

**Files changed.** `src/pastsleep.js` (new: the rules; later: 24-hour limit, date-and-time typing, `partDay`), `src/records.js` (`dateLabel`, `dayName`), `src/pastsleep-ui.js` (new: drawing and saving), `src/sleep-ui.js`, `src/index.html`, `src/styles.css`, `src/sw.js`, `tests/pastsleep.test.mjs` (new: rules, run in six time zones), `tests/browser/pastsleep.test.mjs` (new), `tests/sleep.test.mjs` (a daylight-saving case now ends at 3:30 am so it is valid in every zone).

**Test link.** https://oudam-meas.github.io/baby-log/test/

## Feedback
(Filled in when someone tests it. Leave empty at sign-off.)
