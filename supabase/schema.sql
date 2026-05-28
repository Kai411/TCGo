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

------------------------------------------------------------------
-- search_catalog : trigram-ranked, paginated fuzzy search with
-- optional set / rarity filters and configurable sort.
--
-- Powers the collection's add-card UI and the scanner's manual retry.
--
-- Args:
--   q             : the user's name query (≥ 2 chars), or '' to browse
--                   pure by filters (set/rarity required in that case)
--   page          : 0-indexed page
--   page_size     : rows per page
--   lang          : 'EN' / 'JP' / 'ALL'
--   set_match     : optional substring to match against group_name
--   rarity_match  : optional substring to match against rarity
--   sort_by       : 'best' (default ranking), 'name', 'price_asc',
--                   'price_desc'
--
-- Ranking when sort_by = 'best':
--   1. Prefer prefix matches ("Charizard%" beats "Stage 1 Charizard")
--   2. Then by trigram similarity
--   3. Then by market price DESC — TCGCSV has no popularity field, but
--      in the TCG market expensive cards ARE the popular ones (SIR, ex,
--      VMAX, vintage chase). Cards with no price float to the bottom.
--   4. Tiebreak alphabetically
------------------------------------------------------------------
CREATE OR REPLACE FUNCTION search_catalog(
  q             TEXT,
  page          INT  DEFAULT 0,
  page_size     INT  DEFAULT 28,
  lang          TEXT DEFAULT 'EN',
  set_match     TEXT DEFAULT NULL,
  rarity_match  TEXT DEFAULT NULL,
  sort_by       TEXT DEFAULT 'best'
)
RETURNS TABLE (
  product_id  BIGINT,
  name        TEXT,
  group_name  TEXT,
  number      TEXT,
  rarity      TEXT,
  image_url   TEXT,
  language    TEXT,
  prices      JSONB,
  total_count BIGINT
) AS $$
DECLARE
  q_trimmed   TEXT := trim(q);
  has_query   BOOLEAN := char_length(q_trimmed) >= 2;
  has_filter  BOOLEAN := set_match IS NOT NULL OR rarity_match IS NOT NULL;
BEGIN
  -- Require either a usable name query or at least one filter.
  IF NOT has_query AND NOT has_filter THEN
    RETURN;
  END IF;
  -- Reject a 1-character name query (too noisy) unless filters narrow it.
  IF char_length(q_trimmed) BETWEEN 1 AND 1 AND NOT has_filter THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH filtered AS (
    SELECT
      c.product_id,
      c.name,
      c.group_name,
      c.number,
      c.rarity,
      c.image_url,
      c.language,
      p.prices,
      CASE
        WHEN NOT has_query THEN 0
        WHEN c.name ILIKE q_trimmed || '%' THEN 0
        ELSE 1
      END AS prefix_rank,
      CASE WHEN has_query THEN similarity(c.name, q_trimmed) ELSE 0::real END AS sim,
      -- Best market price (Holofoil → Normal → Reverse Holofoil) — used
      -- when the caller wants price-based sorting.
      COALESCE(
        (p.prices->'Holofoil'->>'market')::numeric,
        (p.prices->'Normal'->>'market')::numeric,
        (p.prices->'Reverse Holofoil'->>'market')::numeric
      ) AS market_price
    FROM cards_catalog c
    LEFT JOIN card_prices p ON p.product_id = c.product_id
    WHERE (NOT has_query OR c.name ILIKE '%' || q_trimmed || '%')
      AND (lang = 'ALL' OR c.language = lang)
      AND (set_match    IS NULL OR c.group_name ILIKE '%' || set_match    || '%')
      AND (rarity_match IS NULL OR c.rarity     ILIKE '%' || rarity_match || '%')
  ),
  with_count AS (
    SELECT *, COUNT(*) OVER () AS total_count FROM filtered
  )
  SELECT
    wc.product_id,
    wc.name,
    wc.group_name,
    wc.number,
    wc.rarity,
    wc.image_url,
    wc.language,
    wc.prices,
    wc.total_count
  FROM with_count wc
  ORDER BY
    -- Each ORDER BY arm only takes effect when sort_by matches; the
    -- others reduce to NULL and don't influence ordering.
    --
    -- "Best": prefix → similarity → popularity (price desc) → name.
    -- Popularity proxy means a search for "pikachu" surfaces high-value
    -- chase prints (VMAX, SIR, Illustrator promo) before cheap commons.
    CASE WHEN sort_by = 'best'       THEN wc.prefix_rank   END ASC NULLS LAST,
    CASE WHEN sort_by = 'best'       THEN wc.sim           END DESC NULLS LAST,
    CASE WHEN sort_by = 'best'       THEN wc.market_price  END DESC NULLS LAST,
    CASE WHEN sort_by = 'price_asc'  THEN wc.market_price  END ASC  NULLS LAST,
    CASE WHEN sort_by = 'price_desc' THEN wc.market_price  END DESC NULLS LAST,
    wc.name ASC
  LIMIT page_size OFFSET page * page_size;
END;
$$ LANGUAGE plpgsql STABLE;

------------------------------------------------------------------
-- list_sets / list_rarities : populate dropdowns in the search UI.
------------------------------------------------------------------
CREATE OR REPLACE FUNCTION list_sets(lang TEXT DEFAULT 'EN')
RETURNS TABLE (group_name TEXT, card_count BIGINT) AS $$
  SELECT c.group_name, COUNT(*)::BIGINT AS card_count
  FROM cards_catalog c
  WHERE c.group_name IS NOT NULL
    AND c.group_name <> ''
    AND (lang = 'ALL' OR c.language = lang)
  GROUP BY c.group_name
  ORDER BY c.group_name ASC;
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION list_rarities(lang TEXT DEFAULT 'EN')
RETURNS TABLE (rarity TEXT, card_count BIGINT) AS $$
  SELECT c.rarity, COUNT(*)::BIGINT AS card_count
  FROM cards_catalog c
  WHERE c.rarity IS NOT NULL
    AND c.rarity <> ''
    AND (lang = 'ALL' OR c.language = lang)
  GROUP BY c.rarity
  ORDER BY c.rarity ASC;
$$ LANGUAGE SQL STABLE;
