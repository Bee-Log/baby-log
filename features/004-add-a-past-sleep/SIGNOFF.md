---
id: 004
name: Add a past sleep
slug: add-a-past-sleep
status: Building
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
(Filled in by the build step. Leave empty at sign-off.)

## Feedback
(Filled in when someone tests it. Leave empty at sign-off.)
