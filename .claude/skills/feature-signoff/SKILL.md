---
name: feature-signoff
description: Save a finished design as a signed-off feature in the project's GitHub repository, so a build session can pick it up later. Use whenever the person says "sign off", "feature signoff", "this design is done", "save this to GitHub", "hand this over to build", or finishes a design discussion and wants it kept. Captures the last discussion and the key artifacts in one consistent SIGNOFF.md, sets the status to Ready, and updates the board. Use it even if the person does not say the word "signoff" but clearly means "this design is final, keep it".
---

# Feature signoff

Turn a finished design into a record that a builder can use later without the original conversation. The builder (Claude Code) will only see what is saved in the repository, so the record must be complete and consistent. The person signing off may not be technical: speak plainly and keep questions to a minimum.

## Repository layout

```
features/
  NNN-slug/
    SIGNOFF.md      status, summary, decisions, data fields, open questions
    artifacts/      the key screens or files for this feature
BOARD.md            generated list of all features by status
scripts/make_board.py
```

Source code lives in `src/` at the repository root, not inside the feature folder. Do not touch `src/` in this skill.

## Steps

1. **Name the feature.** Use the name from the conversation. If it is unclear, propose one short name and continue. Do not stop to ask unless two features are mixed together.
2. **Find the number.** Look at existing `features/` folders and use the next number, with three digits (001, 002). If this feature already has a folder, update it instead of creating a new one, and keep its number.
3. **Write `SIGNOFF.md`** using `assets/SIGNOFF.template.md` exactly. Keep every heading, in the same order. Set `status: Ready` and `updated` to today's date.
   - Base it on the last discussion, not on guesses. Put what was decided under "What we decided", including reasons when they were given.
   - List data fields with the exact names the design uses, so the builder stores the same names.
   - Put anything that was discussed but dropped under "Not in this version". Put anything unresolved under "Open questions".
   - Write short, direct sentences. One idea per sentence.
4. **Save the key artifacts** into `features/NNN-slug/artifacts/`: the final HTML or screens for this feature, and screenshots if available. Keep only the key ones. List each under "Artifacts" with one line on what it shows.
5. **Rebuild the board.** Run `python3 scripts/make_board.py` from the repository root. If `scripts/make_board.py` is missing, copy it from this skill's `scripts/` folder first.
6. **Save to GitHub.** Commit on a new branch named `signoff/NNN-slug` and open a pull request. Never push directly to `main`. Claude Code merges the signoff pull request when it starts the build. If you cannot reach GitHub, output the folder as downloadable files and say clearly where each file belongs in the repository.
7. **Tell the person what happened** in three or four plain sentences: the feature name and number, that it is marked Ready, and the pull request or file location. Ask at most one question, and only if something blocks the builder.

## Rules

- Never put secrets in any file: no API keys, client secrets, or passwords.
- Do not copy real baby data (entries, measurements) into artifacts. Use clearly fake sample values.
- Do not change status of any other feature.
- If the person re-signs-off a feature that is already Building or Testing, keep that history: add a dated line under "Feedback" describing what changed, and set the status back to Ready.
