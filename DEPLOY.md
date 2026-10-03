# Deploy

The app is static files on GitHub Pages. One Pages site holds two addresses.

| Address | Link | Built from | Changes when |
|---|---|---|---|
| TEST | https://oudam-meas.github.io/baby-log/test/ | `main` branch | every merge to `main` (automatic) |
| LIVE | https://oudam-meas.github.io/baby-log/ | the commit recorded by **Release LIVE** | someone runs **Release LIVE** (manual) |

The TEST build shows an orange "TEST" banner and an orange TEST icon. It stores data under names that start with `test-`, so it never touches LIVE data.

## How TEST is published
1. A pull request is merged into `main`.
2. The **Deploy Pages** workflow (`.github/workflows/deploy.yml`) runs the tests.
3. It builds `main` into `/test/`. It rebuilds the recorded LIVE commit into `/`.
4. It publishes both to GitHub Pages. LIVE content does not change, because the LIVE commit did not change.

## How LIVE is published
Do this only when a feature is Done (the tester said it works).

1. Open GitHub → **Actions** → **Release LIVE** → **Run workflow**.
2. Leave `ref` as `main` and press **Run workflow**.

The workflow records that commit as a deployment in the `live-release` environment, then publishes Pages again.
The newest `live-release` deployment is always the LIVE commit. Nothing is pushed to git, so no branch protection or token scope gets in the way.
The history of LIVE releases is under **Settings → Environments → live-release** (or the **Deployments** list on the repository home page).

Command line equivalent: `gh workflow run release-live.yml -f ref=main`

## Rollback LIVE (one step)
Run **Release LIVE** with `ref` set to `previous`.

- `previous` means the release before the current one.
- To go back further, use a commit SHA from the `live-release` history instead.
- Command line: `gh workflow run release-live.yml -f ref=previous`

## Rollback TEST
TEST follows `main`. To undo a bad merge, revert it with a new pull request (GitHub has a **Revert** button on merged pull requests). Merging the revert republishes TEST.

## Checks
- **CI** (`.github/workflows/ci.yml`) runs `npm test` and `npm run build` on every pull request. Merge only when it passes.
- Local: `npm test`, then `npm run build` (writes `dist/test` and `dist/live`).

## One-time setup (owner)
- Repository **Settings → Pages → Build and deployment → Source: GitHub Actions**.
- Recommended: **Settings → Branches** → protect `main` (require a pull request and the **CI** check).
