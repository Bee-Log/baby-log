---
id: 009
name: See the daily summary
slug: see-the-daily-summary
status: Ready
updated: 2026-10-03
---

# 009 See the daily summary

## In one line

See daily totals and the last 7 days.

## What we decided

- The summary shows four totals, a 7-day feed chart and day arrows.

## How it should work

- See `artifacts/Summary.dc.html`.
- Day arrows move between days; the title shows the day (for example "Today · Thu 1 Oct · so far").
- Four totals: Feeds (breast and bottle, with ml), Nappies (wee and poo), Sleep (with the longest stretch), and average gap between feeds.
- "Feeds · last 7 days" shows one bar per day, today highlighted.

## Data it captures

none

## Not in this version

- The "Shared with [Partner]" row (needs partner sync).

## Open questions

- How is "average gap" calculated?
- How is sleep that crosses midnight counted?

## Artifacts

- `artifacts/Summary.dc.html` — Daily summary screen (artboard "3 · Daily summary"): day arrows, four totals, 7-day feed bars, partner sharing row, bottom navigation. For this feature: the whole screen except the sharing row. Design prototype from the "Simple Baby Log" canvas; it needs the canvas runtime (`support.js`) to run, so open it in the canvas or read it as a reference.

## Build notes
(Filled in by the build step. Leave empty at sign-off.)

## Feedback
(Filled in when someone tests it. Leave empty at sign-off.)
