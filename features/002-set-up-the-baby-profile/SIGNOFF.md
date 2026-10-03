---
id: 002
name: Set up the baby profile
slug: set-up-the-baby-profile
status: Ready
updated: 2026-10-03
---

# 002 Set up the baby profile

## In one line

Save who the baby is, so other screens use the right name, age and WHO tables.

## What we decided

- The profile is a simple object: nickname, date of birth, gender and a photo.
- The photo has a fun place to add it: a round dashed frame with small stars, a moon and a cloud around it.
- Gender is set once here; the Growth screen uses it and has no Girl / Boy switch of its own.
- The Today header shows the photo spot and the nickname, and opens the profile.

## How it should work

- See `artifacts/Profile.dc.html`, `artifacts/Main.dc.html`.
- Tap the round photo spot to choose a photo; it then fills the circle.
- Type a nickname (up to 20 characters); the name under the photo updates as you type. With no nickname it shows "[Nickname]".
- Pick a date of birth; the age line under the photo updates (for example "3 weeks old"). In the prototype the age is counted from 1 October 2026 so it matches the sample screens.
- Pick Girl or Boy; a note says it picks the WHO growth chart.
- "Save profile" goes back to Today.

## Data it captures

- Not an entry: `app-rules.md` has no record type for the profile. Fields as designed:
- `nickname` — string, required
- `dateOfBirth` — date `YYYY-MM-DD`, required
- `sex` — `'girl'` or `'boy'`, required (picks the WHO tables)
- `photo` — image, optional
- How the profile is stored and synced is an open question for the owner.

## Not in this version

- Several babies.
- Backup / export.

## Open questions

- One baby only in version 1?
- Is there a size limit for the photo?
- How is the profile stored and synced? It is not one of the record types in `app-rules.md`.

## Artifacts

- `artifacts/Profile.dc.html` — Baby profile screen (artboard "5 · Baby profile"): photo spot, nickname, date of birth with age text, Girl / Boy switch, Save. For this feature: the whole screen. Design prototype from the "Simple Baby Log" canvas; it needs the canvas runtime (`support.js`) to run, so open it in the canvas or read it as a reference.
- `artifacts/Main.dc.html` — Today screen (artboard "1 · Today (home)"): header with profile link, last feed card, sleep panel with Start / Wake toggle, Feed / Wee / Poo buttons, today's timeline, bottom navigation. For this feature: the header (photo spot, nickname, age line) that links to the profile. Design prototype from the "Simple Baby Log" canvas; it needs the canvas runtime (`support.js`) to run, so open it in the canvas or read it as a reference.

## Build notes
(Filled in by the build step. Leave empty at sign-off.)

## Feedback
(Filled in when someone tests it. Leave empty at sign-off.)
