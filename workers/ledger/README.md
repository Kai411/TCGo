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

`.github/workflows/deploy-ledger-worker.yml` runs on pushes to `staging` (tcgo-ledger-staging) and `main`
(tcgo-ledger) that touch this folder. It creates the D1 database on first run (`--location apac`),
applies migrations, deploys and sets the secrets. The run summary prints the Worker URL.

One-time setup: repository secrets `CLOUDFLARE_API_TOKEN` (Workers template + Account > D1 > Edit) and
`CLOUDFLARE_ACCOUNT_ID`; environments `ledger-staging` / `ledger-production`, each with
`LEDGER_WORKER_SECRET` (64+ random characters) and `BILLPLZ_X_SIGNATURE_KEY` (that site's Billplz key).
Then on the matching Netlify site: `NUXT_LEDGER_WORKER_URL` and `NUXT_LEDGER_WORKER_SECRET`.

## Local check

    npx wrangler@4.157.0 d1 migrations apply DB --local --env staging
    npx wrangler@4.157.0 dev --local --env staging   # needs a .dev.vars with both secrets

Tests: `npm test` at the repo root runs `test/ledger-worker.test.ts` against the migration on node:sqlite.
