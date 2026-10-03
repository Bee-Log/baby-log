---
id: 001
name: Install and open the app
slug: install-and-open-the-app
status: Testing
updated: 2026-10-03
---

# 001 Install and open the app

## In one line

Install the app on Android and move between its screens.

## What we decided

- Installable web app, hosted as static files on GitHub Pages and installed on Android from Chrome.
- Stack, build, storage, sync and data format follow the repository's `CLAUDE.md` and `.claude/skills/build-feature/references/app-rules.md`. The earlier React / Vite build guide is not used.

## How it should work

- See `artifacts/Main.dc.html`, `artifacts/Summary.dc.html`, `artifacts/Growth.dc.html`.
- TEST address: https://oudam-meas.github.io/baby-log/test/ . LIVE address: https://oudam-meas.github.io/baby-log/ (see `DEPLOY.md`).
- The app opens full-screen after "Install app" in Chrome on Android, and opens without internet.
- A bottom navigation bar has three tabs: Today, Summary and Growth. The current tab is shown in bold.

## Data it captures

none

## Not in this version

- Sync screens (sign-in, sync status) are not designed yet.

## Open questions

none

## Artifacts

- `artifacts/Main.dc.html` — Today screen (artboard "1 · Today (home)"): header with profile link, last feed card, sleep panel with Start / Wake toggle, Feed / Wee / Poo buttons, today's timeline, bottom navigation. For this feature: the bottom navigation only. Design prototype from the "Simple Baby Log" canvas; it needs the canvas runtime (`support.js`) to run, so open it in the canvas or read it as a reference.
- `artifacts/Summary.dc.html` — Daily summary screen (artboard "3 · Daily summary"): day arrows, four totals, 7-day feed bars, partner sharing row, bottom navigation. For this feature: the bottom navigation only. Design prototype from the "Simple Baby Log" canvas; it needs the canvas runtime (`support.js`) to run, so open it in the canvas or read it as a reference.
- `artifacts/Growth.dc.html` — Growth screen (artboard "4 · Growth"): weight and length cards with percentile labels, WHO band chart with Weight / Length switch, history list, bottom navigation. For this feature: the bottom navigation only. Design prototype from the "Simple Baby Log" canvas; it needs the canvas runtime (`support.js`) to run, so open it in the canvas or read it as a reference.

## Build notes
**Built (2026-10-03).**
- The app now has a bottom bar with three tabs: Today, Summary and Growth. The current tab is dark and bold; the others are grey. Icons, colours and sizes follow `artifacts/Main.dc.html`.
- Each tab shows its title and one line saying what will show there. The real screens come with features 002 to 010.
- The tab is kept in the address (`#today`, `#summary`, `#growth`). So the phone's back button moves between tabs, and one cached page serves every tab offline.
- The design fonts (Atkinson Hyperlegible, Bricolage Grotesque) are stored in the app, not loaded from Google. The app looks the same with no internet.

**Files changed.** `src/index.html`, `src/app.js`, `src/nav.js` (new), `src/styles.css`, `src/sw.js` (fonts and `nav.js` added to the offline list), `src/manifest.webmanifest` (background colour), `src/fonts/` (new, with an OFL licence notice), `tests/nav.test.mjs` (new), `tests/build.test.mjs` (skip font files in the secrets check).

**Test link.** https://oudam-meas.github.io/baby-log/test/ (see `DEPLOY.md`).

**Tested.**
- `npm test`: 10 checks pass. New checks: the tab order, picking a tab from the address, one link and one view per tab, and every file the page loads is in the offline list.
- `npm run build` passes.
- In Chromium at phone size (390 × 844): tapping each tab shows the right screen and marks the right tab; the back button returns to the previous tab; with the network off, a reload of `#growth` opens Growth with all fonts. No console errors.

**Known gaps.**
- "Install app" in Chrome on Android was not tested on a real phone. The install checks (manifest, icons, offline files) pass in the tests. Please try it on the phone.

**Choices the signoff did not cover.**
- The placeholder line on each tab (for example "Weight and length will show here.").
- The design is light only, so the old dark-mode colours were removed. A dark theme for night use could be a later feature.
- The small "Ready to work offline · version" line stays under the content, as in the setup build.

**Fix after merge (2026-10-03).** On TEST, the first update mixed the new page with the old scripts, so the tabs did not work. The cause was the offline cache storing files from the browser's 10-minute HTTP cache. Now the offline cache always downloads fresh files, update checks skip the HTTP cache, and pages come from the same cache version as their scripts. When a new version takes over, the page reloads once. A phone that already has the mixed version heals after two reloads.

## Feedback
(Filled in when someone tests it. Leave empty at sign-off.)
