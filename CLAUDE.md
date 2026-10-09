# baby-log: guide for every Claude session

Read this file first. Keep it short. Update it when a decision changes.

## What this project is
A newborn routine log used by two parents on their phones. They log feeds, sleep, pee, poop, crying and growth, often at night with one hand. Later, an AI will analyse the data, so the data must be clean and portable.

## Who works here
- **The owner** (GitHub: oudam-meas) is a software engineer. Claude Code does the heavy development. The owner joins in for architecture and storage decisions.
- **The partner** designs in Claude Design and tests the app. She is not technical. Talk to her in simple words, short sentences, and no jargon.

## Layout
```
src/                    the app (one app; features share it)
features/NNN-slug/      SIGNOFF.md + artifacts/ for each feature
BOARD.md                generated list of features by status (never edit by hand)
scripts/make_board.py   rebuilds BOARD.md from the SIGNOFF.md headers
prototype/baby-log.html first prototype, for reference only
docs/ux/                how the screens work now and what to design next (share with Claude Design)
docs/adr/               architecture decision records (ADR-001: data storage and sync, ADR-002: sign-in relay)
broker/                 the small Cloudflare Worker that keeps the Google sign-in alive (ADR-002; deploy steps in broker/README.md)
legal/                  public about, privacy and terms pages for Google's consent screen (published by the deploy workflow; see legal/README.md)
DEPLOY.md               how test and live are published, rollback, links
scripts/build.mjs       builds src/ into dist/test and dist/live (no dependencies)
tests/                  node:test checks, run with `npm test`
.github/workflows/      ci (pull requests), deploy (main -> TEST), release-live (manual -> LIVE, records a `live-release` deployment)
.claude/skills/         feature-signoff, build-feature, feature-ready
```

## Workflow (a very small kanban)
Status is stored only in the header of each `features/*/SIGNOFF.md`.

1. **Ready**: design signed off in Claude Design (skill: `feature-signoff`).
2. **Building**: a session is building it (skill: `build-feature`).
3. **Testing**: it is on the TEST address. The partner tries it.
4. **Done**: she confirms (skill: `feature-ready`). It is released to LIVE.

To build, the owner says "build feature 001" or names the signoff. Find it in `features/` and follow `build-feature`.

## Decisions already made
- Installable web app (PWA). Static hosting on GitHub Pages. No servers.
- The phone is the main store (IndexedDB). It must work fully offline.
- Storage and sync: see `docs/adr/ADR-001-data-storage-and-sync.md` (one shared Google account, one append-only file per phone in the hidden app data folder, merge by id with the newest `updatedAt`).
- Data is plain JSON with a CSV export, so it can move to another backend later.
- Sign-in renewal (ADR-002, trial from 2026-10-09): a stateless Cloudflare Worker on the free plan holds Google's client secret and swaps codes and refresh tokens for tokens. It stores nothing and never sees an entry. The app side is not built yet; until it is, the hourly sign-in tap stays.
- Every entry belongs to one baby (feature 014, record format version 2: `v` and `babyId`). An entry belongs to a baby only through its own `babyId`; entries without one (version 1) are not shown until a parent adds them to a baby or deletes them. Unreadable entries are kept and synced, never deleted.
- Data protection (owner decisions, 2026-10-03 and 2026-10-05): TEST and LIVE share one browser origin, so they share storage, and real data is protected in code (see "Shared origin" in app-rules). On 2026-10-05 the repository moved to the **Bee-Log** organisation, so the app runs on `bee-log.github.io` and no longer shares storage with the owner's other sites. Keep that organisation for this app only: any other Pages site there would share the origin again.
- Full rules and the record format: `.claude/skills/build-feature/references/app-rules.md`.
- One design language for every screen: `docs/ux/design-language.md`. Use the tokens at the top of `src/styles.css` (space, corners, text, colours); never add a one-off margin. `tests/browser/layout.test.mjs` checks the spacing on every page.

## Commands
- `npm test` runs the tests. `npm run build` builds both flavours. `npm run test:browser` checks the app in a real browser, including updates (see `DEPLOY.md`). CI runs all three on every pull request.
- Repository: `Bee-Log/baby-log` (moved from `oudam-meas/baby-log` on 2026-10-05; the old name redirects for git, not for Pages).
- TEST: https://bee-log.github.io/baby-log/test/ . LIVE: https://bee-log.github.io/baby-log/ . Details in `DEPLOY.md`.
- Text files in `src/` may use build tokens such as `__APP_ENV__`; `scripts/build.mjs` fills them in and fails on unknown ones.

## Git rules
- Never push directly to `main`. Use a branch and a pull request.
- Claude Code may merge its own pull request when the tests and the build pass.
- Ask the owner before merging any change to the data format or the sync merge rules. A mistake there can damage real data.
- `main` publishes the TEST address. LIVE changes only when a feature is Done.
- If a merge breaks TEST, revert it with a new pull request and tell the owner.

## Safety
- No secrets in the repository. A Google OAuth client ID is public and is fine. A client secret is not.
- No real baby data in the repository. Use fake sample values.
- Test builds use separate storage names and show a clear TEST label.

## Style
- Code, comments and messages to the owner can be technical.
- Messages to the partner: simple words, one idea per sentence.
- Australian English spelling.
