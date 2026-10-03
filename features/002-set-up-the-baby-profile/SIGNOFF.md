---
id: 002
name: Set up the baby profile
slug: set-up-the-baby-profile
status: Testing
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
**Built (2026-10-03).**
- **Profile screen** (`#profile`, a full screen with a back button), as in `artifacts/Profile.dc.html`: the round photo spot with the stars, moon and cloud, the name and age under it, then Nickname (up to 20 characters), Date of birth and a Girl / Boy switch. **Save profile** stays off until the nickname, date of birth and gender are all set. The photo is optional. The name and age update as you type.
- **Today header** (top of Today), as in `artifacts/Main.dc.html`: the photo spot, a line like "Sat 3 Oct · 3 weeks old", and the nickname. It opens the profile. Before a profile is saved it shows "[Nickname]".
- **Age text:** "Born today", "5 days old", "3 weeks old" (up to 7 weeks), then months, then years.
- Leaving with the back button saves nothing. An app update waits while the profile is open.

**How it is stored (the open question).** The profile is one record of a new type, `profile`, with the fixed id `profile`. It uses the same merge rule as every other entry (newest `updatedAt` wins), so it will sync with the rest (ADR-001) with no special case. The photo is cut to a centred square, shrunk to 256 pixels and kept as a small JPEG inside the record (about 20 KB). The owner approved this on 2026-10-03 ("build these first"). `app-rules.md` has the field list.

**Open questions answered.** One baby only in this version. The photo is shrunk, so there is no size limit for the file you pick.

**Not built.** The "Share with partner" button in the Today design (it needs sync). Several babies. Backup and export.

**Files changed.** `src/profile.js` (new: the record, the age text), `src/profile-ui.js` (new: the screen and the header), `src/records.js` (the `profile` type), `src/nav.js`, `src/app.js`, `src/index.html`, `src/styles.css`, `src/sw.js`, `tests/profile.test.mjs` and `tests/browser/profile.test.mjs` (new).

**Test link.** https://oudam-meas.github.io/baby-log/test/

## Feedback
(Filled in when someone tests it. Leave empty at sign-off.)
