---
name: build-feature
description: Build a signed-off feature from the project repository and get it ready to test. Use whenever the person says "build feature 001", "build the feed logging signoff", "build the next feature", "pick up the signoff", "build what's Ready", or names a design or signoff to implement. Finds the matching features/NNN-slug/SIGNOFF.md, checks it is Ready, builds it into src/, opens a pull request, and moves the status to Testing with notes.
---

# Build feature

Turn a signed-off design into working code. The signoff file is the source of truth. Do not rely on any earlier conversation.

## Find the feature

1. Match what the person said (number, name, or slug) to a folder in `features/`.
2. If they said "next" or "what's Ready", read `BOARD.md` and take the lowest-numbered Ready feature. Say which one you chose.
3. If the signoff is still on an open `signoff/NNN-slug` pull request, merge that pull request into `main` first (squash), then continue from `main`.
4. Read the whole `SIGNOFF.md` and every file in its `artifacts/` folder.
5. Check the status.
   - `Ready`: continue.
   - `Building` or `Testing`: tell the person, and ask whether to continue that work or start over.
   - `Done`: ask what they want changed, then treat it as a new change.
6. If "Open questions" lists anything that blocks the build, ask at most one short question before starting. Otherwise make a sensible choice and record it in the build notes.

## Build

1. Set `status: Building` in the `SIGNOFF.md` header and run `python3 scripts/make_board.py`. Commit this first, so the board shows the work started.
2. Work on a branch named `feature/NNN-slug`. Never push directly to `main`. Changes reach `main` only through a pull request that you merge yourself.
3. Read `references/app-rules.md` before writing code. It holds the rules every feature must follow: installable web app, offline first, data format, Google Drive sync, and test data separation.
4. Put code in `src/`. Match the design artifacts for layout and wording. Use the field names from "Data it captures" exactly.
5. Add or update tests for the data handling (saving, merging, exporting). Run them. Run the build. Fix problems before continuing.
6. Do not add features that are not in the signoff. If something extra seems needed, add it to "Open questions" in the build notes.

## Finish

1. Fill in "Build notes" in `SIGNOFF.md`: what was built, which files changed, the test link (see `DEPLOY.md` if it exists), what was tested, known gaps, and any choice you made that the signoff did not cover.
2. Set `status: Testing` and update the `updated` date. Run `python3 scripts/make_board.py`.
3. Open a pull request to `main` and describe it in plain words. Wait for the checks to pass. Then merge it (squash). Merging to `main` publishes the TEST address only. It does not change the live app.
4. Reply in a few short sentences: what is ready, the test link if there is one, and that the feature moves to the live app only after the tester says it works. If no test link exists yet, say so plainly.

## Rules

- Merge only when the tests and the build pass. If they fail, do not merge. Fix the problem, or set the status back to `Ready` and explain.
- Ask the owner before merging any change that alters the data format or the sync merge rules. A mistake there can damage real data, and the owner must agree first.
- If a merged change breaks the test address, revert it with a new pull request right away and tell the owner.

- Never commit secrets: no client secrets, API keys, or passwords. A Google OAuth client ID is public and is fine.
- Never copy real baby data into the repository.
- Do not edit another feature's folder.
- If the build cannot be finished, set the status back to `Ready`, explain what blocked it in "Build notes", and tell the person.
