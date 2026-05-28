# TCGo Supabase (catalog)

Supabase stores the Pokémon card catalog and prices. Firebase still owns
user identity, marketplace listings, and orders.

## One-time setup

1. **Create a Supabase project** at https://supabase.com (free tier is fine
   to start). Note the project URL and the **service role** key
   (Settings → API).

2. **Add to `.env`:**

   ```
   SUPABASE_URL=https://xxxx.supabase.co
   SUPABASE_SERVICE_KEY=eyJ...            # service role key, NEVER expose to browser
   NUXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NUXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...   # anon key, safe to expose to browser
   ```

   The service key bypasses RLS — only used by `scripts/` and the cron job.
   The anon key is used by the browser, restricted by RLS policies in
   `schema.sql`.

3. **Run the schema:** Supabase dashboard → SQL editor → paste
   `supabase/schema.sql` → Run.

4. **Install seed-script deps:**

   ```sh
   npm install --save-dev @supabase/supabase-js dotenv
   ```

5. **Seed the catalog (once):**

   ```sh
   node scripts/seed-pokemon-catalog.mjs
   ```

   Takes ~3–5 minutes to fetch ~80 groups (sets) from TCGCSV and upsert
   ~30k+ rows. Re-running is safe — it's an upsert on `product_id`.

## Refreshing

- **New sets release:** re-run `node scripts/seed-pokemon-catalog.mjs`.
- **Prices:** handled by `scripts/snapshot-pokemon-prices.mjs` — see below.

## Daily price snapshot

After the schema and seed are in place, run:

```sh
node scripts/snapshot-pokemon-prices.mjs
```

What happens:

1. Loads every known `product_id` from `cards_catalog`.
2. Fetches `/prices` for every Pokémon group from TCGCSV.
3. Aggregates per product (TCGCSV returns one row per sub-type: Normal /
   Holofoil / Reverse Holofoil / 1st Edition / etc.) into a single JSONB.
4. Bulk-upserts into `card_prices` — `prices` is replaced, `history` is
   left alone (the upsert only sends the columns we provide).
5. Calls the `snapshot_prices_today()` Postgres function, which prepends
   today's market price to each row's `history` array and trims to 365.

Idempotent — safe to run multiple times per day. The history function
dedupes by date so a re-run just replaces today's snapshot with the
latest prices.

### Automated nightly cron

[`.github/workflows/snapshot-pokemon-prices.yml`](../.github/workflows/snapshot-pokemon-prices.yml)
runs the snapshot every day at **02:00 MYT (18:00 UTC)** on GitHub
Actions. To enable it:

1. In your GitHub repo, go to **Settings → Secrets and variables →
   Actions → New repository secret**.
2. Add `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` with the same values as
   your local `.env`.
3. Commit + push the workflow file. First scheduled run fires at the
   next 18:00 UTC; trigger manually from the Actions tab to test.

Logs live in the Actions tab — failures show which groups errored and
how many rows were snapshotted into history.
