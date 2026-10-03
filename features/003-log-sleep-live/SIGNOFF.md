---
id: 003
name: Log sleep live
slug: log-sleep-live
status: Done
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

- What happens if the app is closed while the baby is asleep? **Answered in the build:** the running sleep is a saved record with `end: null`, so it stays. A test closes and reopens the app and checks it is still asleep.

## Artifacts

- `artifacts/Sleep.dc.html` — Sleep screen (artboard "6 · Sleep"): live sleep panel, "Add a past sleep" card with step buttons, parts of day, clock ring and native time fields, "Logged sleeps" list. For this feature: the sleep panel at the top and the "Logged sleeps" list. Design prototype from the "Simple Baby Log" canvas; it needs the canvas runtime (`support.js`) to run, so open it in the canvas or read it as a reference.
- `artifacts/Main.dc.html` — Today screen (artboard "1 · Today (home)"): header with profile link, last feed card, sleep panel with Start / Wake toggle, Feed / Wee / Poo buttons, today's timeline, bottom navigation. For this feature: the sleep panel (Start / Wake button and the link to the Sleep page). Design prototype from the "Simple Baby Log" canvas; it needs the canvas runtime (`support.js`) to run, so open it in the canvas or read it as a reference.

## Build notes
**Built (2026-10-03).**
- **Sleep card on Today**, above the Feed / Wee / Poo buttons, as in `artifacts/Main.dc.html`. Awake: a white card, "Awake since 1:40 pm" and a purple **Start sleep** button. Asleep: the card turns dark, "Asleep since 2:15 pm" and a gold **Wake up** button. Before any sleep is logged it says "Sleep / Not logged yet". Tapping the card (not the button) opens the Sleep page.
- **Sleep page** (`#sleep`, a full screen with a back button), as in `artifacts/Sleep.dc.html`: the same small card with more words. Awake: "Woke up at 1:40 pm" and "Awake 3h 37m". Asleep: "Fell asleep at 2:15 pm" and a running "Asleep 00:12:05" that counts every second.
- **Logged sleeps** list on the Sleep page: finished sleeps, newest first, with the time range and the length ("12:00 pm – 1:40 pm", "1h 40m"). A sleep that began before today (6 am to 6 am) shows its date ("Fri 2 Oct, 11:50 pm – 2:10 am").
- **The sleep is one record.** Start sleep saves it with `end: null`. Wake up puts the end time on the **same record** and moves `updatedAt` forward (the existing merge rule). The sleep survives closing the app and restarting the phone.
- Only sleeps are stored. "Awake" is the gap since the last wake-up.

**Data: one new field, approved by the owner (2026-10-03).** The signoff asks for `d.source: 'live'` on a sleep record (feature 004 will use `'manual'`). It is the only data-format change. Everything else is the existing record format. The CSV export (not built yet) would need a `sleep_source` column.

**Files changed.** `src/sleep.js` (new: start, wake, lengths, rows), `src/sleep-ui.js` (new: the card and the page), `src/nav.js` (`#sleep`), `src/app.js`, `src/index.html`, `src/styles.css`, `src/sw.js` (new files in the offline list), `tests/sleep.test.mjs` and `tests/browser/sleep.test.mjs` (new).

**Test link.** https://oudam-meas.github.io/baby-log/test/

**Tested.**
- `npm test`: 53 pass. They cover starting and waking, a clock that moves backwards, the current sleep, the last wake-up, lengths and the date label.
- `npm run test:browser`: 37 pass. New: the card starts empty; Start sleep turns it dark and keeps the sleep after the app is closed; the page opens from the card, the time counts, Wake up logs the sleep; a list with several sleeps (one from before today and one removed) in the right order with the right lengths and "Awake 3h 37m"; Start sleep and Wake up work offline; TEST sleeps never reach LIVE; the card fits on 320 and 360 px phones.
- `npm run build` passes. Screenshots at 320 and 390 px were checked.

**Choices the signoff did not cover.**
- On phones narrower than 360 px the small arrow and the button icon are hidden, so the time has room.
- "Not logged yet" before the first sleep.
- If two sleeps are somehow running (for example from two phones later), the newest one is the current one.
- The Today list does **not** show sleeps yet. That is feature 008. Its empty message now says "No feeds or nappies yet today." so it is not wrong when a sleep exists.

**Known gaps.**
- A forgotten sleep keeps running until someone taps Wake up. There is no edit or delete for sleeps yet (not in this version). Feature 004 adds past sleeps.
- Like everything else, sleeps stay on this phone until sync is built.

## Feedback
- 2026-10-03: Tested OK on TEST by the owner ("looks good so far", then "Release all"). Released to LIVE on the owner's instruction, before the partner's own test.
