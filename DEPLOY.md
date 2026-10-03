# Deploy

The app is static files on GitHub Pages. One Pages site holds two addresses.

| Address | Link | Built from | Changes when |
|---|---|---|---|
| TEST | https://oudam-meas.github.io/baby-log/test/ | `main` branch | every merge to `main` (automatic) |
| LIVE | https://oudam-meas.github.io/baby-log/ | `live` branch | someone runs **Release LIVE** (manual) |

The TEST build shows an orange "TEST" banner and an orange TEST icon. It stores data under names that start with `test-`, so it never touches LIVE data.

## How TEST is published
1. A pull request is merged into `main`.
2. The **Deploy Pages** workflow (`.github/workflows/deploy.yml`) runs the tests.
3. It builds `main` into `/test/` and rebuilds the `live` branch into `/`.
4. It publishes both to GitHub Pages. LIVE content does not change, because it comes from the `live` branch.

## How LIVE is published
Do this only when a feature is Done (the tester said it works).

1. Open GitHub → **Actions** → **Release LIVE** → **Run workflow**.
2. Leave `ref` as `main` and press **Run workflow**.

The workflow points the `live` branch at that commit, adds a tag named `live-YYYYMMDD-HHMMSS`, and publishes Pages again.

Command line equivalent: `gh workflow run release-live.yml -f ref=main`

## Rollback LIVE (one step)
Run **Release LIVE** with `ref` set to the previous `live-…` tag.

- Find the tag under **Code → Tags**. The newest tag is the current LIVE. Pick the one before it.
- Command line: `gh workflow run release-live.yml -f ref=live-20261003-101500`

## Rollback TEST
TEST follows `main`. To undo a bad merge, revert it with a new pull request (GitHub has a **Revert** button on merged pull requests). Merging the revert republishes TEST.

## Checks
- **CI** (`.github/workflows/ci.yml`) runs `npm test` and `npm run build` on every pull request. Merge only when it passes.
- Local: `npm test`, then `npm run build` (writes `dist/test` and `dist/live`).

## One-time setup (owner)
- Repository **Settings → Pages → Build and deployment → Source: GitHub Actions**.
- Recommended: **Settings → Branches** → protect `main` (require a pull request and the **CI** check).
