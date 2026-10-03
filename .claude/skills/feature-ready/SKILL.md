---
name: feature-ready
description: Tell a non-technical tester which features are ready to try, give the test link and a short checklist, and record the result. Use when the person says "ready now", "is it ready", "give me the link", "what can I test", "it works", "it doesn't work", "mark it done", or asks about the status of a feature. Moves a feature from Testing to Done when it works, or back to Ready with a comment when it does not.
---

# Feature ready

This skill is the last step. A builder has finished a feature and put it on a test address. The person testing may not be technical, so write in simple words and short sentences. Avoid terms like branch, merge, deploy, or pull request. If one is needed, explain it in brackets once.

## Asking what is ready

1. Read `features/*/SIGNOFF.md` headers. List features whose status is `Testing`.
2. If none are in Testing, say so, and say which are Ready or Building.
3. For each feature in Testing, give:
   - The feature name.
   - The test link. Take it from "Build notes" in its `SIGNOFF.md`, or from `DEPLOY.md`. If you cannot find a link, say so and ask the repository owner.
   - A checklist of three to six things to try. Write the checklist from the feature's "How it should work" section, in everyday words.
4. Remind the tester that the test address uses test data, separate from the real baby log. They can type anything freely.

## Recording the result

- **It works.** Set `status: Done` and update the `updated` date. Add one dated line under "Feedback": "Tested OK". Then release it to the live app by following `DEPLOY.md` (the live release step). If `DEPLOY.md` has no live release step, tell the owner and ask. After the release, tell the tester in one sentence that it is now in the real app.
- **It does not work, or something is wrong.** Set `status: Ready`, update the date, and add a dated line under "Feedback" with what the tester said, in their words. Then say that the builder will see it next time.
- **Unsure.** Leave the status as Testing. Ask one short question.

After any change, run `python3 scripts/make_board.py` from the repository root. If the script is missing, copy it from this skill's `scripts/` folder. Commit on a branch, open a pull request, wait for checks, and merge it. Never push directly to `main`.

## Rules

- Change only the feature the tester is talking about.
- Never write secrets or real baby data into any file.
- Keep replies short. Finish with one clear next step.
