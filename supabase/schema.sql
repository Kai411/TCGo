-- TCGo catalog schema (Pokemon V1).
-- Run this once against a fresh Supabase project (SQL editor or psql).
-- Subsequent seed/cron runs upsert into these tables — no destructive
-- changes here so re-running is safe.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

------------------------------------------------------------------
-- cards_catalog : seeded once from TCGCSV, refreshed when new sets drop
------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cards_catalog (
  product_id    BIGINT PRIMARY KEY,            -- TCGPlayer's canonical ID
  name          TEXT NOT NULL,
  clean_name    TEXT,
  image_url     TEXT,
  category_id   INT  NOT NULL,                 -- 3 = Pokemon
  group_id      INT  NOT NULL,                 -- TCGPlayer set ID
  group_name    TEXT,                          -- "Obsidian Flames" etc.
  url           TEXT,                          -- TCGPlayer product URL
  rarity        TEXT,                          -- "Double Rare", "Common", ...
  number        TEXT,                          -- "125/197" (printed number)
  card_type     TEXT,                          -- "Pokemon", "Trainer", "Energy"
  stage         TEXT,                          -- "Basic", "Stage 1", ...
  hp            TEXT,
  language      TEXT DEFAULT 'EN',             -- 'EN' | 'JP'
  extended_data JSONB DEFAULT '[]'::jsonb,     -- everything else TCGCSV returns
  modified_on   TIMESTAMPTZ,                   -- TCGCSV's last-modified
  seeded_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Fuzzy name search (powers the add-to-collection autocomplete).
CREATE INDEX IF NOT EXISTS cards_catalog_name_trgm
  ON cards_catalog USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS cards_catalog_group_idx
  ON cards_catalog (group_id);

CREATE INDEX IF NOT EXISTS cards_catalog_rarity_idx
  ON cards_catalog (rarity);

------------------------------------------------------------------
-- card_prices : daily upsert by cron, history kept inline as JSONB
------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS card_prices (
  product_id BIGINT PRIMARY KEY REFERENCES cards_catalog(product_id) ON DELETE CASCADE,
  -- All sub-types in one doc:
  --   { "Normal": { market, low, mid, high, directLow },
  --     "Holofoil": { ... }, "Reverse Holofoil": { ... } }
  prices     JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Capped time series — append latest, trim to 365 entries.
  --   [{ "date": "2026-05-29", "market": 22.50 }, ...]
  history    JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to keep updated_at fresh on any change.
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS card_prices_touch ON card_prices;
CREATE TRIGGER card_prices_touch
  BEFORE UPDATE ON card_prices
  FOR EACH ROW
  EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS cards_catalog_touch ON cards_catalog;
CREATE TRIGGER cards_catalog_touch
  BEFORE UPDATE ON cards_catalog
  FOR EACH ROW
  EXECUTE FUNCTION touch_updated_at();

------------------------------------------------------------------
-- Row Level Security : catalog & prices are public, read-only from client
------------------------------------------------------------------
ALTER TABLE cards_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_prices   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog public read" ON cards_catalog;
CREATE POLICY "catalog public read"
  ON cards_catalog FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "prices public read" ON card_prices;
CREATE POLICY "prices public read"
  ON card_prices FOR SELECT
  USING (true);

-- All writes happen via the service role (seed script + cron),
-- which bypasses RLS, so no INSERT/UPDATE policies are needed.

------------------------------------------------------------------
-- snapshot_prices_today : called by the daily cron after upserting
-- the current prices. Reads each row's current market price (preferring
-- Holofoil → Normal → Reverse Holofoil), prepends today's snapshot to
-- the history array, drops any duplicate today entry, and trims to 365.
-- Skips rows whose current prices have no usable market value.
------------------------------------------------------------------
CREATE OR REPLACE FUNCTION snapshot_prices_today()
RETURNS INT AS $$
DECLARE
  today_date TEXT := to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD');
  rows_affected INT;
BEGIN
  UPDATE card_prices cp
  SET history = jsonb_build_array(
                  jsonb_build_object(
                    'date', today_date,
                    'market', COALESCE(
                      (cp.prices->'Holofoil'->>'market')::numeric,
                      (cp.prices->'Normal'->>'market')::numeric,
                      (cp.prices->'Reverse Holofoil'->>'market')::numeric
                    )
                  )
                ) || COALESCE(
                  (SELECT jsonb_agg(elem)
                   FROM (
                     SELECT elem
                     FROM jsonb_array_elements(cp.history) elem
                     WHERE elem->>'date' != today_date
                     ORDER BY (elem->>'date') DESC
                     LIMIT 364
                   ) sub),
                  '[]'::jsonb
                )
  WHERE COALESCE(
    (cp.prices->'Holofoil'->>'market')::numeric,
    (cp.prices->'Normal'->>'market')::numeric,
    (cp.prices->'Reverse Holofoil'->>'market')::numeric
  ) IS NOT NULL;

  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected;
END;
$$ LANGUAGE plpgsql;
