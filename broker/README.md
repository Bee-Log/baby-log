# Sign-in relay (Cloudflare Worker)

A tiny program that holds Google's client secret so the phones can renew their Google sign-in without a tap. Read `docs/adr/ADR-002-sign-in-relay.md` first. It stores nothing and never sees an entry.

Files: `worker.mjs` (the code), `wrangler.toml` (settings, none secret), `../tests/broker.test.mjs` (tests, run by `npm test`).

## Deploy (owner, once)

You need a Cloudflare account (the free plan is enough) and Node on your computer.

1. **Get the client secret.** Google Cloud console, project `project-45070-beelog`, Google Auth platform, Clients, the Web client. Copy the client secret (add a new one if none is shown). Keep it out of chats, files and git.
2. **Deploy.** In a terminal:
   ```
   cd broker
   npx wrangler login
   npx wrangler deploy
   npx wrangler secret put GOOGLE_CLIENT_SECRET
   ```
   The last command asks for the secret. Paste it there. `wrangler deploy` prints the relay's address, like `https://baby-log-relay.<your-name>.workers.dev`.
3. **Check it.** Open that address in a browser. You should see `"ok": true` and `"secretSet": true`. If `secretSet` is false, run the last command again.
4. **Tell Claude the address.** It is public, so it can go in a chat and in `src/config.js`.

## Change a setting
Edit `wrangler.toml` (`ALLOWED_ORIGINS`, `REDIRECT_URIS`) and run `npx wrangler deploy` again. To change the secret, run the `secret put` command again.

## Take it away
Delete the Worker in the Cloudflare dashboard, and delete the client secret in Google Cloud. The app falls back to the hourly sign-in tap.

## Rules
- The client secret is never in this repository. `tests/broker.test.mjs` fails if one appears.
- The Worker must store nothing and log nothing it receives. The test checks this too.
