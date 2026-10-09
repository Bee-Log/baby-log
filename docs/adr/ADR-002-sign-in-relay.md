# ADR-002: A small relay to keep the Google sign-in alive

- **Status:** Accepted for a trial (2026-10-09). The owner said: "Option C sounds good", then "I do have a Cloudflare account. Maybe we can give it a try." The relay in this change is safe to merge and changes nothing in the app. One question about the app side is still open (see "Open question").
- **Date:** 2026-10-09
- **Decider:** owner (oudam-meas)
- **Builds on:** ADR-001 (data storage and sync). ADR-001 stays in force: entries still live on the phone and in the parents' own Google Drive.
- **Where it goes:** `docs/adr/ADR-002-sign-in-relay.md`, `broker/`

## Context

Sync with Google Drive needs a Google access token. The app gets one with Google's "token model". That token lasts about one hour and comes with no refresh token. After an hour the app must ask again, and a phone only lets Google's window open from a tap. The parents see "Sign in to sync" about once an hour. The owner reported this as "too often" (2026-10-09). The 2026-10-05 change that keeps the token until it ends did not remove the hourly tap.

Google gives a refresh token (a long-lived key that gets new one-hour tokens) only in its "authorization code" way. Google's guide says the one-time code must be exchanged for tokens on a backend, with the **client secret**. A web page cannot keep a secret, and this project does not allow one in the repository (CLAUDE.md, Safety).

Rules from the owner that this must respect:

- No server to pay for at this stage.
- Baby Log persists no data. The entries stay on the phone and in the parent's own Google Drive (privacy policy, `legal/privacy.html`).

Other ways that were looked at, and why not:

- **Firebase as the database:** the entries would be stored in the owner's Firebase project. That breaks the rule above.
- **Firebase sign-in only:** it keeps an account record (email and name) for each person who signs in. It also does not renew the Google token for Drive.
- **Firebase Cloud Functions as the relay:** needs a billing account.
- **Google Apps Script as the relay:** browsers have trouble reading its replies (CORS). Not tested.
- **A mobile client type, or a real mobile app:** a web page cannot use a mobile client. A real app is a very large change.
- **Device sign-in ("TVs and limited-input devices"):** not checked. It may need a secret in the public code, and a browser may not be allowed to call it.

## Decision

Add one tiny relay, a Cloudflare Worker on the free plan (`broker/`). It holds only Google's client secret, as a Worker secret.

- `POST /exchange`: swaps a one-time sign-in code for an access token and a refresh token.
- `POST /refresh`: swaps a refresh token for a new one-hour access token.
- It stores nothing. It has no database or key-value store. It logs nothing it receives (`observability` is off). It never sees an entry: the phone talks to Drive by itself.
- It answers only the app's web address (`https://bee-log.github.io`), and it accepts only the app's own return addresses (`REDIRECT_URIS`).
- The **phone** keeps its own refresh token, in the same browser storage as today's token. It asks the relay for a new access token before the old one ends. No tap is needed.
- If the relay is down, or Google refuses the refresh token, the app falls back to what it does today: it says "Sign in to sync" and waits for a tap. Entries are never at risk.
- TEST and LIVE share the one relay.

### Facts this rests on (checked on 2026-10-09)

- Workers free plan: 100,000 requests a day and 10 ms of CPU time per request (Cloudflare's pricing page). The app needs about 50 requests a day. Waiting for Google is not CPU time; this is believed, not tested.
- Google issues a refresh token only the first time a person consents to the app. Later sign-ins return no refresh token unless consent is asked for again (`prompt=consent`).
- The code client of Google's script has a `select_account` option, and no documented `prompt` option for forcing consent. The token client has `prompt`.
- Not re-checked today, from earlier knowledge of Google's documentation: a refresh token can stop working if the person removes the app's access, changes the password in some cases, does not use it for 6 months, or has more than 100 for one client. The OAuth app was published on 2026-10-09, so the 7-day limit of "Testing" mode no longer applies.

## Open question: how each phone gets its own refresh token

Both phones use one shared Google account. Google gives a refresh token only on consent. So a phone that signs in after the first one may get an access token and **no** refresh token, if the sign-in does not force consent.

| Way to sign in | Forces consent? | Risk |
|---|---|---|
| Google's script, code model, popup | Not documented | The second phone may get no refresh token |
| The app builds Google's sign-in address itself (`access_type=offline`, `prompt=consent select_account`) and Google sends the person back to the app | Yes | A full-page trip to Google and back. On an iPhone home-screen app the return may land in a different storage than the app. Needs the two return addresses added on the Google client. |

The choice depends on which phones are used and how the app is opened. It is decided when the app side is built, not in this change.

## Consequences

- A new account to look after: Cloudflare. A new place where the client secret lives (Cloudflare's secret store).
- The privacy policy must say what changes **when the app side goes live**: a small relay passes the sign-in code and tokens through and stores nothing. "No server" is no longer the right sentence; "no database, nothing stored" is. That change goes in the same pull request as the app side, not before.
- Cloudflare, like any host, may see standard request details such as an IP address.
- A refresh token on the phone lasts much longer than today's token. It is useful only through the relay, and only for the app's own hidden Drive folder. Sign out removes it from the phone. It can be cancelled for every phone at https://myaccount.google.com/permissions.
- If Cloudflare changes the free plan, the worst case is today's hourly tap.
- The data format and the sync merge rules do not change.

## What changes in the repo

1. This change: `broker/` (the Worker, its settings, deploy steps), `tests/broker.test.mjs`, this record. The app is not touched.
2. Later, in a separate pull request: the app asks the relay for new tokens (`src/google-auth.js`, `src/sync-ui.js`, `src/config.js` gets `relayUrl`), with tests, the privacy page update, and a way back to today's behaviour while `relayUrl` is a placeholder.

## Owner tasks (outside the repo)

1. Deploy the relay (steps in `broker/README.md`) and send Claude its public address.
2. Say which phones are used and how the app is opened (home-screen icon or browser), so the sign-in method above can be chosen.
3. Never paste the client secret in a chat or commit it.
