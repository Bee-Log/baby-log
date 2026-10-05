---
id: 014
name: More than one baby
slug: more-than-one-baby
status: Done
updated: 2026-10-05
---

# 014 More than one baby

## In one line

Every entry belongs to one baby. Parents can add more than one baby and switch between them, and nothing can be logged until a baby is chosen.

## What we decided

- The owner asked for this on 2026-10-04: "We shouldn't be able to log anything without selecting or creating a profile. So every data tied to a profile", switching should be easy, and one baby should open by itself.
- Twins are kept apart: each baby has its own entries, its own sleep and its own breast timer.
- The baby id is a random id. The first profile (feature 002) keeps its id `profile`.
- On a phone without a baby, signing in loads the babies from Google: none found → add one; one → open it; two or more → ask which one.
- Entries are checked against the record format. Entries that do not fit, or come from a newer app version, are kept safe and not shown, and the Sync screen says how many there are.
- This feature has **no Claude Design signoff**. The screens are plain and may be restyled later (see `docs/ux/claude-design-update-2026-10-04.md`, section 10).
- **It changes the data format,** so the owner approves it before it is merged (CLAUDE.md, Git rules).

## How it works

- **The Babies screen** (`#babies`). Tap the baby at the top of Today to open it. It lists the babies, with a tick on the one on screen and an **Edit** button for each. Tap a baby to switch to it. **Add a baby** opens an empty profile.
- **The gate.** While no baby is chosen, every screen goes to the Babies screen. It then says "Welcome. Add your baby to start." and offers **Sign in with Google** (when sync is set up) and **Add a baby**. There is no back button, because there is nothing to go back to.
- **Opening without asking.** The app opens on the baby chosen last time on this phone, or on the only baby. The choice is kept on the phone only, so each parent can look at a different baby.
- **Signing in on the welcome screen** runs sync. When it finishes: one baby → Today opens with that baby; two or more → "Which baby?"; none → "No baby was found in the Google account. Add your baby to start."
- **Entries from before this feature** have no baby id. **Changed on 2026-10-05 (owner):** they belong to no baby and are never shown under a baby by guessing.
  - Today shows "N older entries have no baby. Review". The Babies screen says how many there are, with **Add them to [baby]** and **Delete them** (two taps).
  - Before this change they belonged to the baby with the id `profile`. The owner found that a new test profile showed leftover test entries from the day before: the welcome screen's "Entries from before" row opened a form titled "Add a baby", which attached the old entries. That row is gone, and **Add a baby** is always shown.
- **Each screen shows only the chosen baby:** Today, the Feed screen (last feed, timer), Sleep (the card, the logged sleeps, the overlap check), Edit screens and the Summary. An old link to another baby's entry says "That entry is not there any more."
- **Export:** the CSV has every baby, with two new columns at the end: `baby_id` and `baby` (the nickname). JSONL has every entry as stored.

## Data it captures

The record format becomes **version 2** (`app-rules.md`, "Data format"):

- `v: 2` on every new entry. An entry without `v` is version 1.
- `babyId` on every new entry: the id of its baby's profile. A profile's `babyId` is its own id.
- The merge rule and the sync files do not change.

## Not in this version

- **Moving entries to another baby.** If a phone adds a baby before signing in, and the other phone already had the same baby, there will be two babies with the same name. Sign in first on a new phone. A "move entries" tool can come later.
- Deleting a baby.

## Open questions

- None for the build. The design of the Babies screen is open for Claude Design.

## Build notes
**Built (2026-10-04).**
- `src/schema.js` (new): the format version, `babyOf()` (version 1 entries belong to `profile`), `problem()` (`newer` or `invalid`), `forBaby()`, `unreadable()`.
- `src/baby.js` (new): the chosen baby (meta `currentBaby`), `records()` (the chosen baby's readable entries), the per-baby breast timer key, and moving an old timer.
- `src/babies-ui.js` (new) and the `#babies` screen.
- `src/records.js`: `makeRecord()` writes `v: 2` and needs a `babyId`.
- `src/profile.js`: `babies()`, `pick()`; `current()` and `toRecord()` take the baby id. `src/profile-ui.js`: `#profile/new`, `#profile/<id>`.
- `src/app.js`: the gate, and edit links only for the chosen baby. Feed, sleep, past sleep, edit sleep and summary read through `baby.js` and save the baby id.
- `src/sync-ui.js`: the count of unreadable entries; sign-in and state for the welcome screen. `src/csv.js`: the baby columns.
- **Tests:** unit tests for the format check, the babies list and the choice. Browser tests for the gate, switching, two babies' entries and sleeps kept apart, old entries with and without a profile, unreadable entries, and loading one, two or no babies by signing in on a new phone. The other browser tests start with a made-up baby "Bean".

**Test link.** https://oudam-meas.github.io/baby-log/test/

## Feedback
- 2026-10-05: Released to LIVE on the owner's instruction ("Yes live"), at commit b9e42f0, the day after it reached TEST. Not tested on TEST by the partner yet.
- 2026-10-05: Released to LIVE at commit e0892cb (owner: "Release now"): entries without a baby are no longer shown under the baby `profile`; on LIVE a parent taps Review, then "Add them to [baby]" once to keep older entries visible.
