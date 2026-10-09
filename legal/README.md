# Public pages (about, privacy, terms)

Plain web pages for the Google sign-in consent screen. They are not part of the app. They have no scripts and load nothing from other websites.

The deploy workflow (`.github/workflows/deploy.yml`) copies the `.html` files here to the site on every merge to `main`. They do not wait for a LIVE release.

| Page | File | Address to paste |
|---|---|---|
| About (application home page) | `index.html` | https://bee-log.github.io/baby-log/legal/ |
| Privacy policy | `privacy.html` | https://bee-log.github.io/baby-log/legal/privacy.html |
| Terms of service | `terms.html` | https://bee-log.github.io/baby-log/legal/terms.html |

Where to paste them: Google Cloud console, project `project-45070-beelog`, Google Auth platform, **Branding**: application home page, privacy policy link, terms of service link.

## Keep these true
- The privacy policy describes what the app does today: the one Google permission (`drive.appdata`), the browser storage, and no server. `tests/legal.test.mjs` fails if the permission in `src/google-auth.js` changes and the policy does not.
- If the app starts to send data anywhere new, to collect anything new, or to ask Google for another permission, change `privacy.html` first and update the date on all three pages.
- No email address is published on these pages on purpose. People reach the project through the GitHub issues page. If the owner wants an email address, add it to `privacy.html` and `terms.html`.
