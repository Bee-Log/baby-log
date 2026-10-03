---
id: 006
name: Log a breast feed
slug: log-a-breast-feed
status: Ready
updated: 2026-10-03
---

# 006 Log a breast feed

## In one line

Time a breast feed, left and right.

## What we decided

- The Feed screen has a Breast / Bottle switch.
- The breast view keeps the timer layout from the first concept.

## How it should work

- See `artifacts/Feed.dc.html`, `artifacts/Main.dc.html`.
- The breast view shows when the feed started, a large timer and the time per side (for example "Left 08:32 · Right 00:00").
- Two large round buttons, Left and Right: the running side shows "Tap to pause", the other "Tap to switch".
- A "Last time" row shows the last side and time; an optional Note field.
- "Stop and save" ends the feed.
- The Feed button on Today opens this screen. In the prototype the timer is a static picture.

## Data it captures

- Common record fields as in `app-rules.md`: `id`, `t`, `end`, `note`, `by`, `deviceId`, `updatedAt`, `deleted`. Times are milliseconds since 1970 (UTC).
- `type` — `'feed'`
- `t` — feed started (ms)
- `d.kind` — `'Breast'`
- `d.side` — `'Left'`, `'Right'` or `'Both'`
- `d.min` — minutes, number
- `note` — the Note field

## Not in this version

none

## Open questions

- The timer is still a static picture: pause and switch rules, using both sides (`side` = `'both'`), and the timer running while the app is closed are not designed.

## Artifacts

- `artifacts/Feed.dc.html` — "Log a feed" screen (artboard "2 · Log a feed"): Breast / Bottle switch, breast timer layout, bottle view with drag, typed ml, −10 / +10, milk type and "Fed at" time. For this feature: the Breast view. Design prototype from the "Simple Baby Log" canvas; it needs the canvas runtime (`support.js`) to run, so open it in the canvas or read it as a reference.
- `artifacts/Main.dc.html` — Today screen (artboard "1 · Today (home)"): header with profile link, last feed card, sleep panel with Start / Wake toggle, Feed / Wee / Poo buttons, today's timeline, bottom navigation. For this feature: the Feed button that opens the Feed screen. Design prototype from the "Simple Baby Log" canvas; it needs the canvas runtime (`support.js`) to run, so open it in the canvas or read it as a reference.

## Build notes
(Filled in by the build step. Leave empty at sign-off.)

## Feedback
(Filled in when someone tests it. Leave empty at sign-off.)
