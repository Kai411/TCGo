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

**Stage 2: server-priced checkout, cards held before payment.**

- Orders are placed by `/api/orders/place` (the browser sends card ids only) and priced on the server
  (`server/utils/order-pricing.ts`): card prices from the listings, a winning bid from the auction, postage
  from a server quote to the order's delivery address. `firestore.rules` no longer let a browser create an
  order or write its money fields, so the RM 0.01 total is gone.
- `create-bill` then calls `holdOrder` (`checkout.ts`): one batch writes the order as `awaiting_payment` and
  claims every card in `listing_locks` as `held` for 30 minutes, asserting each claim. A card another live
  order holds, or one already sold, aborts the batch and no bill is made (409). A lapsed hold can be taken
  by the next buyer; its open bill is voided and deleted at Billplz.
- The bill is recorded as a `created` payment. The Billplz callback (`shadow.ts`) turns the order `paid`
  and the holds `sold`, at the fees Firestore settled with.
- With the ledger configured, a ledger outage stops checkout (503, `ledger.hold_failed`) rather than
  making a bill without a hold. Unconfigured, holds are skipped and checkout works as before.
- Holds are not released when an unpaid order is cancelled in the browser; they lapse after 30 minutes.

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
