---
id: 007
name: Log a bottle feed
slug: log-a-bottle-feed
status: Testing
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
**Built (2026-10-03), together with 006, on the same Feed screen.**
- Choose **Bottle** at the top of the Feed screen. The bottle drawing, the amount, −10 / +10, Formula / Expressed and the "Fed at" time are all as in `artifacts/Feed.dc.html`.
- The amount can be set three ways, and all stay in step: drag up or down on the bottle (10 ml steps), type a number, or tap −10 / +10. The most is 240 ml. A typed number above 240 becomes 240.
- "Fed at" opens the phone's own time picker (5-minute steps). It starts at the current time, rounded down to 5 minutes.
- The save button shows the amount ("Save · 90 ml"). Saving goes back to Today, shows the feed in the list ("Feed · Bottle 90 ml") and offers **Undo** for 6 seconds.
- Saving stores one `feed` entry: `t` is the "Fed at" time, `d.kind` is `Bottle`, `d.ml` is the amount, and `d.milk` is `Formula` or `Breast milk` (the **Expressed** button stores `Breast milk`, as the signoff says).

**Files changed.** Same as 006: `src/feed.js` (new: timer, bottle and "Fed at" logic), `src/feed-ui.js` (new: the Feed screen), `src/records.js` (feed labels, Today rows, last feed), `src/store.js` (a small store for the running timer), `src/nav.js` (`#feed` full screen), `src/app.js`, `src/index.html`, `src/styles.css`, `src/sw.js` (new files in the offline list), `tests/feed.test.mjs` and `tests/browser/feed.test.mjs` (new).

**Test link.** https://oudam-meas.github.io/baby-log/test/

**Tested.**
- `npm test`: 37 pass, also in four time zones (Melbourne, Phnom Penh, New York, UTC).
- `npm run test:browser`: 17 pass, 3 runs in a row. The feed tests run the real screens in Chromium at phone size, offline, and with TEST and LIVE side by side. They also check that an app update waits while a bottle form is open, and that an entry with missing details does not break the screens.
- `npm run build` passes. Screenshots at phone size match the design.
- Tests cover typing, stepping and dragging the amount, the 240 ml limit, the milk values, and "Fed at" around midnight.

**Choices the signoff did not cover.**
- The first amount is the **last bottle's amount and milk** (90 ml and Formula if there is no last bottle). The screen opens on Bottle if the last feed was a bottle.
- "Fed at" can be at most 5 minutes ahead of now. A later time means last night (at 00:10, "23:50" is yesterday), so a feed is never in the future.
- A typed amount is rounded to a whole number and kept between 0 and 240.
- The bottle screen has **no Note field**. The signoff asked about one, so I left it out. Adding it is a small change.
- 240 ml stays the maximum, as designed.

- While the bottle form is open, an app update waits and does not reload the page, so a half-filled amount is not lost. The update arrives when the parent leaves the screen.

**Known gaps.**
- Entries stay on the phone that logged them until sync is built.

## Feedback
- 2026-10-03 (owner): the word **Expressed** ran outside its button on a small phone. Fixed (the bottle is a little smaller on narrow phones; a test checks 320, 360 and 390 px).
- 2026-10-03 (owner): the **Undo** button covered other buttons, so Undo was removed for now.
- 2026-10-03 (owner): added a **Note** to the bottle form, next to Fed at, for logging and editing (answers the open question in this signoff). The "Last bottle" row is now a small line under the Breast / Bottle switch.
