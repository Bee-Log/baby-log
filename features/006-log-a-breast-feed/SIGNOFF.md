---
id: 006
name: Log a breast feed
slug: log-a-breast-feed
status: Testing
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
**Built (2026-10-03), together with 007, because both use the same Feed screen.**
- The **Feed** button on Today (blue, next to Wee and Poo) opens the Feed screen. The close button (×) goes back to Today.
- Breast view: a big timer, "Started 9:22 am", the time per side ("Left 08:32 · Right 00:00"), and two round buttons, **Left** and **Right**. The note field and "Last time" row are there too. The save button says "Stop and save".
- **Timer rules** (the signoff left these open):
  - The timer starts at the first tap on Left or Right.
  - Tap the running side to pause it. Tap it again to carry on.
  - Tap the other side to switch. Only one side runs at a time.
  - "Stop and save" is off until a side has been tapped.
- **The timer keeps running when the app is closed.** It is stored on the phone as a draft (not as an entry) and counted from clock times, not from a ticking counter. Reopening the app shows the right time. Saving removes the draft.
- Saving stores one `feed` entry: `t` is the first tap, `d.kind` is `Breast`, `d.side` is `Left`, `Right` or `Both`, and `d.min` is the total minutes (rounded to the nearest minute). The note goes in `note`.
- The entry and the removal of the draft timer are saved in one step, so a failed save can never leave a duplicate.
- After saving, the app goes back to Today, the feed shows in the list ("Feed · Left 14 min"), and **Undo** is offered for 6 seconds. There is no "discard timer" button in the design, so a mistaken timer is saved and then undone.

**Files changed.** `src/feed.js` (new: timer, bottle and "Fed at" logic), `src/feed-ui.js` (new: the Feed screen), `src/records.js` (feed labels, Today rows, last feed), `src/store.js` (a small store for the running timer), `src/nav.js` (`#feed` full screen), `src/app.js`, `src/index.html`, `src/styles.css`, `src/sw.js` (new files in the offline list), `tests/feed.test.mjs` and `tests/browser/feed.test.mjs` (new).

**Test link.** https://oudam-meas.github.io/baby-log/test/

**Tested.**
- `npm test`: 37 pass, also in four time zones (Melbourne, Phnom Penh, New York, UTC).
- `npm run test:browser`: 17 pass, 3 runs in a row. The feed tests run the real screens in Chromium at phone size, offline, and with TEST and LIVE side by side. They also check that an app update waits while a bottle form is open, and that an entry with missing details does not break the screens.
- `npm run build` passes. Screenshots at phone size match the design.
- Timer tests cover start, pause, resume, switch, a paused timer standing still, a clock that goes backwards, and a timer that was running while the app was closed for 14 minutes.

**Choices the signoff did not cover.**
- The timer rules above, and keeping the running timer when the screen is closed.
- Time per side is **not** stored, only the total minutes and the side (or `Both`). This follows the signoff. If you want the time per side for analysis later, it needs two new optional fields and the owner's approval of the data format.
- Today's list now shows feeds (a small part of 008). The big "Last feed … ago" card and editing a row are still for 008.

**Known gaps.**
- A timer left running keeps counting until someone stops it. It does not stop by itself.
- Entries stay on the phone that logged them until sync is built.

## Feedback
- 2026-10-03 (owner): the **Undo** button covered other buttons, so Undo was removed for now.
- 2026-10-03 (owner): the two big round Left / Right buttons use too much space, and the owner wants to edit Left and Right minutes separately. Done in feature 012 (minutes per side, two compact rows). The two new optional fields were approved by the owner. See `docs/ux/feed-and-edit-experience.md`.
