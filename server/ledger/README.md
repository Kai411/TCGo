# Order and payout ledger (Turso)

Design: https://claude.ai/artifact/4Yk63zjf7reDKwEK2kMAdV. The database is Turso Free (libSQL, which is
SQLite), reached straight from Netlify functions with `@libsql/client/web`.

**Stage 1 (this code): shadow only.** The Billplz callback (`server/api/billplz/webhook.post.ts`) checks
Billplz's signature, settles the order in Firestore as before, then records the same payment here
(`server/utils/ledger.ts` → `shadow.ts`). Mint Condition staff compare the two at
`/api/mc/ledger/reconcile?days=7`. Nothing buyers see depends on the ledger yet, and a ledger failure only
logs `ledger.shadow_failed`.

- Every payment is one batch (one transaction) that ends by checking the posting balances.
- The ledger is append-only, order amounts are frozen once paid, and status moves are checked by
  triggers (`migrations/0001_init.sql`).
- A second paid bill on one order is booked as a refund owed; a card sold to two orders is logged as
  `ledger.double_sell_detected`.

## Setup

1. Turso: create a database (closest location to Netlify's functions, which run in US East / Ohio by
   default). Copy its URL (`libsql://…turso.io`) and create a database token.
2. GitHub, environment `ledger-production`: `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`.
   `.github/workflows/ledger-database.yml` applies migrations on pushes to `staging` or `main`; on a pull
   request it only checks the connection.
3. Netlify: `NUXT_LEDGER_DATABASE_URL` and `NUXT_LEDGER_DATABASE_TOKEN` (same two values). Unset = off.

Billplz is in sandbox for now. When it goes live, clear the sandbox rows first.

## Local

    TURSO_DATABASE_URL=file:/tmp/ledger.db node scripts/ledger-migrate.mjs

`npm test` runs `test/ledger.test.ts` on libSQL and on node:sqlite.
