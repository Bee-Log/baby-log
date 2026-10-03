---
id: 003
name: Log sleep live
slug: log-sleep-live
status: Building
updated: 2026-10-03
---

# 003 Log sleep live

## In one line

Tap Start sleep and Wake up as it happens, and see the logged sleeps.

## What we decided

- The sleep button toggles between Start sleep and Wake up.
- Tapping the sleep panel (not the button) opens the Sleep page.
- The panel on the Sleep page uses the same small style as on Today.
- Only sleeps are stored. Awake time is the gap between sleeps.

## How it should work

- See `artifacts/Sleep.dc.html`, `artifacts/Main.dc.html`.
- Awake: the panel is white and shows "Awake since" with the time (Today) or "Woke up at …" with "Awake …" (Sleep page). The button says "Start sleep" with a moon icon.
- Asleep: the panel turns dark and shows when the baby fell asleep; on the Sleep page a live timer counts up (for example "Asleep 00:12:05"). The button says "Wake up" with a sun icon.
- Tapping "Wake up" adds the sleep to the "Logged sleeps" list.
- The list shows every sleep, newest first, with its time range and length.

## Data it captures

- Common record fields as in `app-rules.md`: `id`, `t`, `end`, `note`, `by`, `deviceId`, `updatedAt`, `deleted`. Times are milliseconds since 1970 (UTC).
- `type` — `'sleep'`
- `t` — fell asleep (ms)
- `end` — woke up (ms), or `null` while asleep
- `d.source` — `'live'` (new field; the prototype CSV has no column for it)

## Not in this version

- Edit or delete a sleep.

## Open questions

- What happens if the app is closed while the baby is asleep? The saved record with `end: null` should keep it, but this is not written down.

## Artifacts

- `artifacts/Sleep.dc.html` — Sleep screen (artboard "6 · Sleep"): live sleep panel, "Add a past sleep" card with step buttons, parts of day, clock ring and native time fields, "Logged sleeps" list. For this feature: the sleep panel at the top and the "Logged sleeps" list. Design prototype from the "Simple Baby Log" canvas; it needs the canvas runtime (`support.js`) to run, so open it in the canvas or read it as a reference.
- `artifacts/Main.dc.html` — Today screen (artboard "1 · Today (home)"): header with profile link, last feed card, sleep panel with Start / Wake toggle, Feed / Wee / Poo buttons, today's timeline, bottom navigation. For this feature: the sleep panel (Start / Wake button and the link to the Sleep page). Design prototype from the "Simple Baby Log" canvas; it needs the canvas runtime (`support.js`) to run, so open it in the canvas or read it as a reference.

## Build notes
(Filled in by the build step. Leave empty at sign-off.)

## Feedback
(Filled in when someone tests it. Leave empty at sign-off.)
