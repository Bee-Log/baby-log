---
id: 010
name: Track growth against WHO
slug: track-growth-against-who
status: Testing
updated: 2026-10-05
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
**Built (2026-10-05).** The owner agreed on 2026-10-05 to include the WHO numbers with a credit, and to leave head size out.
- **WHO data:** `src/who-data.js` holds L, M and S for each day from birth to day 730, for weight-for-age and length-for-age, girls and boys (55 KB). It is made by `scripts/make-who-data.mjs` from WHO's own repository (`WorldHealthOrganization/anthro`, pinned to commit b776d8a). Research and sources: `docs/research/who-growth-standards.md`.
- `src/growth.js` (new): age in days, the WHO formula (value at a z-score, z-score of a value), the percentile and its label, the cards, the history, and the chart numbers.
- `src/growth-ui.js` (new): the Growth tab, the chart (SVG), and the measurement form `#measure` (also opened by `#edit/<id>` for a saved measurement).
- `src/app.js`, `src/nav.js`, `src/index.html`, `src/styles.css`, `src/sw.js`: the tab, the new screen, and the new files.
- **Choices the signoff did not cover:**
  - The percentile label uses WHO's exact formula (LMS), then rounds to 5 like the prototype. The signoff listed the exact formula as "not in this version" only because the prototype had the weekly tables alone.
  - The chart runs from birth to a little after the baby's age today: at least 4 weeks, at most 2 years. Week labels up to 13 weeks, then months.
  - "+250 g in 7 days" compares the newest measurement with the one before it and says how many days apart they are.
  - The Add form (not designed): date, weight in kg, length in cm; one of the two is enough. Today's date saves the time now; another date saves midday. Weight 0.3–40 kg, length 25–130 cm, not before the date of birth, not in the future. History rows open the same form, with Delete (two taps).
  - WHO's "restricted" rule beyond ±3 SD is not used: it only changes values that already show as "Below 3rd" or "Above 97th percentile".
  - A credit line: "Growth data: WHO Child Growth Standards, © World Health Organization."
  - Built on the session branch `claude/great-shannon-pw5dll` (this session must use it) instead of `feature/010-track-growth-against-who`.
- **Data:** no new fields. `type: 'growth'`, `d.weight` (grams) and `d.height` (cm) were already in the record format and in the CSV (`weight_g`, `height_cm`).
- **Tests:** unit tests for the WHO numbers at birth, all 112 numbers in the design prototype, percentiles and labels, age, cards, history and the chart axis. Browser tests: add, cards, chart, history, edit, delete, wrong values, the boys standard, and narrow phones.

**Test link.** https://oudam-meas.github.io/baby-log/test/ (open the Growth tab).

## Feedback
(Filled in when someone tests it. Leave empty at sign-off.)
