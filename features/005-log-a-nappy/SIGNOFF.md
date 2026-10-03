---
id: 005
name: Log a nappy
slug: log-a-nappy
status: Building
updated: 2026-10-03
---

# 005 Log a nappy

## In one line

Record a wee or a poo with one tap.

## What we decided

- Nappy logging is one tap: separate Wee and Poo buttons on Today, no form.

## How it should work

- See `artifacts/Main.dc.html`.
- Tap Wee or Poo on Today.
- Nappies appear in the Today timeline, for example "Nappy · Wee" or "Nappy · Wee + Poo".

## Data it captures

- Common record fields as in `app-rules.md`: `id`, `t`, `end`, `note`, `by`, `deviceId`, `updatedAt`, `deleted`. Times are milliseconds since 1970 (UTC).
- Wee button: one record, `type` — `'pee'`, `t` — when tapped.
- Poo button: one record, `type` — `'poop'`, `t` — when tapped.
- Wee and poo together = two records (one `pee`, one `poop`) with the same `t`.
- One tap saves no `d` fields. The prototype's optional `d.amount` (pee) and `d.colour`, `d.texture`, `d.size` (poop) are not in this design.

## Not in this version

- Edit the time of a nappy.

## Open questions

- How to log wee and poo together in the screen: one button, or both taps (two records either way)?
- How to undo a wrong tap? (`app-rules.md`: removal sets `deleted: true`.)

## Artifacts

- `artifacts/Main.dc.html` — Today screen (artboard "1 · Today (home)"): header with profile link, last feed card, sleep panel with Start / Wake toggle, Feed / Wee / Poo buttons, today's timeline, bottom navigation. For this feature: the Wee and Poo buttons and the nappy rows in the timeline. Design prototype from the "Simple Baby Log" canvas; it needs the canvas runtime (`support.js`) to run, so open it in the canvas or read it as a reference.

## Build notes
(Filled in by the build step. Leave empty at sign-off.)

## Feedback
(Filled in when someone tests it. Leave empty at sign-off.)
