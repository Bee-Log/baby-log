---
id: 007
name: Log a bottle feed
slug: log-a-bottle-feed
status: Building
updated: 2026-10-03
---

# 007 Log a bottle feed

## In one line

Record how much milk the baby had from a bottle.

## What we decided

- The amount can be entered manually or by an easy drag on a bottle picture.
- "Fed at" uses the phone's native time picker pop-up.

## How it should work

- See `artifacts/Feed.dc.html`.
- Drag up or down anywhere on the bottle; the milk level follows in 10 ml steps, from 0 to 240 ml. The scale shows a mark every 30 ml and numbers at 60, 120, 180 and 240.
- Type the amount (on a phone this opens the number keypad), or use −10 / +10.
- Pick Formula or Expressed; this changes the milk colour.
- A "Last bottle" row shows the previous bottle.
- The save button shows the amount, for example "Save · 90 ml".

## Data it captures

- Common record fields as in `app-rules.md`: `id`, `t`, `end`, `note`, `by`, `deviceId`, `updatedAt`, `deleted`. Times are milliseconds since 1970 (UTC).
- `type` — `'feed'`
- `t` — "Fed at" time (ms)
- `d.kind` — `'Bottle'`
- `d.ml` — amount in ml, number
- `d.milk` — `'Formula'` or `'Breast milk'` (the design's button says "Expressed"; it stores `'Breast milk'`)

## Not in this version

- A custom bottle size.

## Open questions

- Is 240 ml the right maximum?
- The record has a `note` field. Should the bottle screen show a Note field too?

## Artifacts

- `artifacts/Feed.dc.html` — "Log a feed" screen (artboard "2 · Log a feed"): Breast / Bottle switch, breast timer layout, bottle view with drag, typed ml, −10 / +10, milk type and "Fed at" time. For this feature: the Bottle view. Design prototype from the "Simple Baby Log" canvas; it needs the canvas runtime (`support.js`) to run, so open it in the canvas or read it as a reference.

## Build notes
(Filled in by the build step. Leave empty at sign-off.)

## Feedback
(Filled in when someone tests it. Leave empty at sign-off.)
