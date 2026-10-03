---
id: 010
name: Track growth against WHO
slug: track-growth-against-who
status: Ready
updated: 2026-10-03
---

# 010 Track growth against WHO

## In one line

Record weight and length and compare them with the WHO percentiles.

## What we decided

- Growth is compared with the WHO Child Growth Standards percentiles.
- Both weight and length have a chart, with a Weight / Length switch.
- The WHO standard (girls or boys) comes from the baby profile.

## How it should work

- See `artifacts/Growth.dc.html`.
- Cards show the latest weight and length, the change in 7 days, and a percentile label (for example "About 75th percentile").
- The chart shows shaded bands for the 3rd–97th and 15th–85th percentiles, a dashed median, and the baby's line, with band labels on the right.
- A short line names the standard in use ("from the baby profile") with an Edit link to the profile.
- A note says it is a guide only and to ask the maternal and child health nurse if unsure.
- A history list shows each measurement.
- In the prototype the band values are the WHO weekly tables for weeks 0–3, and the percentile label is estimated between WHO percentile lines and rounded to 5.

## Data it captures

- Common record fields as in `app-rules.md`: `id`, `t`, `end`, `note`, `by`, `deviceId`, `updatedAt`, `deleted`. Times are milliseconds since 1970 (UTC).
- `type` — `'growth'`
- `t` — when measured (ms)
- `d.weight` — grams, number (the screen shows kg)
- `d.height` — length in cm, number

## Not in this version

- WHO monthly tables after 13 weeks.
- The exact percentile formula (LMS).
- Head size (`d.head` in the prototype) is not in this design.

## Open questions

- The "Add" measurement form is not designed; only its button exists.

## Artifacts

- `artifacts/Growth.dc.html` — Growth screen (artboard "4 · Growth"): weight and length cards with percentile labels, WHO band chart with Weight / Length switch, history list, bottom navigation. For this feature: the whole screen. The "babyGender" tweak previews the boys tables in the canvas. Design prototype from the "Simple Baby Log" canvas; it needs the canvas runtime (`support.js`) to run, so open it in the canvas or read it as a reference.

## Build notes
(Filled in by the build step. Leave empty at sign-off.)

## Feedback
(Filled in when someone tests it. Leave empty at sign-off.)
