---
id: 001
name: Install and open the app
slug: install-and-open-the-app
status: Building
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
(Filled in by the build step. Leave empty at sign-off.)

## Feedback
(Filled in when someone tests it. Leave empty at sign-off.)
