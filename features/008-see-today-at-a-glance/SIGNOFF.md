---
id: 008
name: See today at a glance
slug: see-today-at-a-glance
status: Building
updated: 2026-10-03
---

# 008 See today at a glance

## In one line

See the time since the last feed and today's list of entries.

## What we decided

- Today shows a large "Last feed … ago" card, the sleep panel, quick log buttons and today's timeline.
- "Today" starts at 6 am, like the sleep day. It runs from 6 am to 6 am the next morning.

## How it should work

- See `artifacts/Main.dc.html`.
- The "Last feed" card shows the time since the last feed (for example "2h 15m ago") with its time, side and length.
- The "Today" list shows feeds, nappies and sleeps with time and icon, newest first.

## Data it captures

none

## Not in this version

- "Tap a row to edit" (editing entries is not designed).

## Open questions

none

## Artifacts

- `artifacts/Main.dc.html` — Today screen (artboard "1 · Today (home)"): header with profile link, last feed card, sleep panel with Start / Wake toggle, Feed / Wee / Poo buttons, today's timeline, bottom navigation. For this feature: the "Last feed" card and the "Today" timeline. Design prototype from the "Simple Baby Log" canvas; it needs the canvas runtime (`support.js`) to run, so open it in the canvas or read it as a reference.

## Build notes
(Filled in by the build step. Leave empty at sign-off.)

## Feedback
(Filled in when someone tests it. Leave empty at sign-off.)
