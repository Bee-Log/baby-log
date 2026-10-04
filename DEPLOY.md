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

## How an update reaches a phone
The app keeps a full copy of itself on the phone (the service worker cache, `src/sw.js`), so it opens offline.

1. The phone opens the app from its copy. Page and scripts always come from the same version.
2. In the background, it checks `sw.js` and `config.js` for a new version (skipping the browser's HTTP cache).
3. If there is one, it downloads every file fresh, then takes over. The page reloads once by itself.

So after a release, the new version shows on the next open, or the one after. Phones that had the version before
pull request 5 needed two opens once. If a phone ever shows a mixed version, closing and opening the app twice fixes it.

When you change any of this, test an update, not only a fresh install: open the old build, publish the new one,
then open the app again (twice). A fresh install hides update bugs.

## Checks
- **CI** (`.github/workflows/ci.yml`) runs `npm test` and `npm run build` on every pull request. Merge only when it passes.
- Local: `npm test`, then `npm run build` (writes `dist/test` and `dist/live`).
- **Browser** (CI job `browser`) runs `npm run test:browser`: it opens the app in Chromium and checks install, tabs, offline,
  live and test side by side, and an update from an older version. Locally it needs Playwright; in a Claude Code cloud
  session use `NODE_PATH=/opt/node-tools/node_modules npm run test:browser`.

## Turn on sync (owner, once)
Sync (ADR-001, feature 013) is switched on by the public client ID in `src/config.js` (`googleClientId`). If that value is empty or starts with `PLACEHOLDER`, sync stays off. The Google Cloud project is `project-45070-beelog`.

1. Create the shared Google account. Keep its password and 2-step code in 1Password.
2. In Google Cloud, create a project and an OAuth client of type **Web application**.
   - Authorised JavaScript origin: `https://oudam-meas.github.io`
   - Scope: `https://www.googleapis.com/auth/drive.appdata`
   - While the consent screen is in "Testing", add the shared account as a test user.
3. Put the **client ID** in `googleClientId` in `src/config.js` (done on 2026-10-04). The client ID is public. Never use or commit the client secret.
4. Merge the change. Open the TEST app, go to **Sync and data**, and tap **Sign in with Google** on two phones. Check that an entry on one phone shows on the other.
5. If the sign-in stops working after about 7 days, the project is still in "Testing" mode. Publish the OAuth app.
6. When TEST works, run **Release LIVE**.

TEST uses the Drive folder `baby-log-test` and LIVE uses `baby-log`. Both are inside the hidden app-data folder, so they never mix.

## One-time setup (owner)
- Repository **Settings → Pages → Build and deployment → Source: GitHub Actions**.
- Recommended: **Settings → Branches** → protect `main` (require a pull request and the **CI** check).
