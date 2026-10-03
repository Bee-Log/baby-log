---
id: 008
name: See today at a glance
slug: see-today-at-a-glance
status: Done
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
**Built (2026-10-03).** Most of Today already existed from features 003, 005, 006, 007 and 011. This feature added the two missing parts.
- **"Last feed" card** at the top of Today, as in `artifacts/Main.dc.html`: "2h 15m ago" in large type, then the time and details ("3:02 pm · Left 14 min"). It uses the newest feed of any kind. The "ago" text counts on every 30 seconds while the app is open. With no feed it says "No feed yet". Deleted feeds are ignored.
- **Sleeps in the Today list**, with feeds and nappies, newest first. A finished sleep shows when the baby woke up: "Woke up · slept 1h 50m". A sleep still running shows "Fell asleep · asleep now". A sleep belongs to the 6 am to 6 am day of its wake-up time. Tapping a sleep row opens the Sleep page (editing sleeps is not designed yet).
- The empty message now says "Nothing logged yet today."
- **No data change.**

**Cleanup done on the way.** The list icons are now in one file (`src/icons.js`), used by Today and the Sleep page. Each list row now carries its own `title` ("Feed", "Nappy", "Woke up"), so `app.js` has no per-kind lookup table. The Today code in `app.js` is split into small functions: `renderLastFeed`, `rowElement`, `renderToday`.

**Also fixed.** On the past-sleep card, a typed start time could make a sleep longer than 12 hours. It is now kept to 12 hours at most (it becomes 1 hour from the typed time).

**Files changed.** `src/icons.js` (new), `src/records.js` (row titles, `latestFeed`, `agoText`), `src/sleep.js` (`timelineRows`), `src/app.js`, `src/sleep-ui.js`, `src/pastsleep.js`, `src/index.html`, `src/styles.css`, `src/sw.js`, `tests/feed.test.mjs`, `tests/sleep.test.mjs`, `tests/pastsleep.test.mjs`, `tests/browser/today.test.mjs` (new).

**Not in this version.** The baby profile header and the share button in the design belong to feature 002.

**Test link.** https://oudam-meas.github.io/baby-log/test/

## Feedback
- 2026-10-03: Tested OK on TEST by the owner ("looks good so far", then "Release all"). Released to LIVE on the owner's instruction, before the partner's own test.
