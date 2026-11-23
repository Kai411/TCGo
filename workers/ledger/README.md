# tcgo-ledger (Cloudflare Worker + D1)

The order and payout ledger. Design: https://claude.ai/artifact/4Yk63zjf7reDKwEK2kMAdV (section 0).

**Stage 1 (this code): shadow only.** The Billplz callback on Netlify settles orders in Firestore as before,
then sends the same payment here (`/v1/shadow-payment`). Mint Condition staff can compare the two at
`/api/mc/ledger/reconcile?days=7`. Nothing buyers see depends on this Worker yet.

- Only Netlify can call it: requests are HMAC-signed with `LEDGER_WORKER_SECRET` and expire after 60 s.
- It checks Billplz's own callback signature (`BILLPLZ_X_SIGNATURE_KEY`) before recording a payment.
- It holds no Billplz API key, so it can record money but never send it.
- The ledger is append-only and every posting must balance (see `migrations/0001_init.sql`).

## Deploys

`.github/workflows/deploy-ledger-worker.yml` deploys one production Worker, `tcgo-ledger`, on pushes to
`staging` or `main` that touch this folder (pull requests only run the secrets check). It creates the D1 database on first run (`--location apac`),
applies migrations, deploys and sets the secrets. The run summary prints the Worker URL.

One-time setup: repository secrets `CLOUDFLARE_API_TOKEN` (Workers template + Account > D1 > Edit) and
`CLOUDFLARE_ACCOUNT_ID`; environment `ledger-production` with `LEDGER_WORKER_SECRET` (64+ random
characters) and `BILLPLZ_X_SIGNATURE_KEY` (the Billplz sandbox key for now; swap in the live key when
going live, then clear the sandbox rows). Then on the Netlify site: `NUXT_LEDGER_WORKER_URL` and
`NUXT_LEDGER_WORKER_SECRET`.

## Local check

    npx wrangler@4.157.0 d1 migrations apply DB --local --env production
    npx wrangler@4.157.0 dev --local --env production   # needs a .dev.vars with both secrets

Tests: `npm test` at the repo root runs `test/ledger-worker.test.ts` against the migration on node:sqlite.
