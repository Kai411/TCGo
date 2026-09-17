# Inventory cost price, per-card profit, and stock value — design

Date: 2026-09-17 · Branch: `feat/inventory-cost-and-portfolio` · Status: approved 2026-09-17, implemented on this branch

## Goal

Give a seller the "portfolio" loop a stock app has: every card in inventory
carries what it cost, every sale shows what it earned, and the seller home
leads with what the shelf is worth today at market price, with a trend.
The number should be worth opening the app for.

## What already exists (and is reused)

- `inventory` (Firestore) is the seller's private stock ledger. Rows carry
  `productId` (TCGPlayer id, the join key to prices), `listPrice`,
  `quantity`, `status`, `soldPrice` (counter sales), `soldAt`, `saleChannel`.
- `card_prices` (Supabase) holds a daily TCGPlayer market price per product
  plus a capped 365-day `history`. `useCardCatalog` already exposes
  `getCardsByIds` (current price in MYR, live FX) and
  `getCollectionPriceTrend(ids, days, quantities)` (basket valued across the
  window, weighted by copies). `PriceTrendChart` renders a trend.
- `/collection` already shows "Estimated value + 30-day trend" for a
  collector's personal collection with exactly that plumbing. The seller
  side gets the same pattern, plus cost and profit.
- `notes` on an inventory row is buyer-facing: `updateItem` mirrors it into
  the public listing's `description`. It is therefore not the place for a
  purchase remark.

## Non-goals (v1)

- Net profit after TCGo fees, shipping, SST. Profit is gross and labelled so.
- Purchase lots / FIFO cost accounting. One inventory row is one lot.
- A server-side daily snapshot of each seller's stock value (true wallet
  history that includes cards since sold). See "Later".
- Cost tracking on the collector's `/collection` page.
- Cost entry inside the scan flow. Scanned rows get cost inline afterwards.

## Data model

Two optional fields on an `inventory` document. Written only when provided;
absent means "unknown", never zero.

| Field | Type | Meaning |
|---|---|---|
| `costPrice` | number, MYR | What the seller paid **per unit** (per card). |
| `costNote` | string | Private remark: where, when, from whom. Never mirrored to `cards`. |

`InventoryItem`, `InventoryItemInput`, `buildItem`, and
`createListedFromCard` in `composables/useInventory.ts` gain the two fields.
`updateItem`'s listing mirror is an allow-list, so the new fields stay private
without further change. Firestore rules for `inventory` already permit owner
writes of any field; no rules or index changes.

One server change: the Billplz webhook's inventory mirror (which marks online
sales `status: "sold"`) also writes `soldPrice` from the order item's price,
so online sales carry a realised price like counter sales already do.
The order-cancel route, which un-sells the row, clears `soldPrice` too.

## Where cost and remark are captured

1. **Items page, manual add** (`/seller/items`): the "List price" card
   becomes a price card with `List price`, `Cost price (RM)`, and
   `Remark (private)`. Cost and remark are optional; adding is never blocked.
2. **Items page, table**: a `Cost` column with an inline input (same pattern
   as the inline price/qty inputs). Editable in every status, including
   `listed`, because it is private. Sold rows show `Profit` in that column:
   `(soldPrice ?? listPrice − costPrice) × quantity`, green or red, or "—"
   when cost is unknown.
3. **Items page, edit dialog**: `Cost price` and `Remark` fields; not subject
   to the listed-row lock.
4. **Items page, filter**: a small "N without cost price · show" toggle above
   the table, deep-linkable as `/seller/items?missing=cost` so the dashboard
   nudge lands on the right rows.
5. **CSV / Excel import** (`/seller/import`): two new mappable fields,
   `Cost` (header guesses: cost, cost price, bought, paid, buy price) and
   `Remark` (remark, remarks, note, notes). "cost" is removed from the
   `Price` guesses so a cost column is no longer mistaken for the asking
   price. The review table shows the cost column.
6. **Listing form, manual mode** (`/seller/listings/new`): an optional
   `Your cost (private)` input under the price, passed through the inventory
   mirror. Scan-mode drafts unchanged.

## Arithmetic — `shared/portfolio.ts` (pure, tested)

Inputs are a projection of inventory rows (`productId, quantity, listPrice,
costPrice?, soldPrice?, status, soldAt?`) and a `Map<productId, marketMyr>`.

**Holdings** = rows with status `in_stock`, `listed`, or `reserved`.

- `marketValue` = Σ market × quantity over holdings that have a market price.
- `unpricedRows` / `unpricedAskingValue` = holdings with no `productId` or no
  market price, and their Σ listPrice × quantity. Reported beside the
  headline, never folded into it: the headline stays a market figure.
- `costBasis` = Σ costPrice × quantity over holdings that have **both** a
  cost and a market price. `unrealisedGain` = the matching market value −
  costBasis, with `unrealisedPct`. Restricting both sides to the same rows
  keeps the comparison honest. `costedRows` / `holdingsRows` are reported so
  the card can say "based on 38 of 51 items".

**Realised** = rows with status `sold`.

- Per row: `(soldPrice ?? listPrice − costPrice) × quantity`; null when no
  cost.
- Period totals (30 days by `soldAt`, all time): `profit`, `revenue`,
  `costedRevenue`, `cost`, `rows`, `missingCostRows`, and
  `marginPct = profit / costedRevenue`. Margin is measured against the revenue
  it can explain, not all revenue, so a sale with no recorded cost cannot
  dilute it.
- Rows without cost count in `revenue` and `missingCostRows`, never as zero
  cost. Rows with no `soldAt` (hand-marked before it existed) fall back to
  `updatedAt` for the window. All figures rounded to 2 dp once, at the end.

Quantity: the POS sells a whole row (it ignores `quantity`), and
`totalValue` on the items page already multiplies by quantity, so prices are
treated as per unit and a sold row sells all its units. Almost every row is
quantity 1.

## The stock value card — `components/InventoryWorthCard.vue`

Rendered on the seller home (`/seller`) directly after "Needs attention",
through a new `after-attention` slot on `SellerSalesDashboard`, so the
dashboard keeps leading with work to do and the number comes second.

Content, top to bottom:

- Eyebrow "Stock value", headline `RM <marketValue>`, and a change pill from
  the 30-day basket trend (`changePct`), green or red, "vs 30 days ago".
- Caption: "51 items · 63 units · 4 unpriced (RM 120 at asking)".
- Three figures: `Cost basis`, `Unrealised` (gain, pct, "on 38 of 51 with a
  cost"), `Realised profit` (30 days, all time beneath). Realised is labelled
  "before fees".
- `PriceTrendChart` of the basket over 30 days (same call as `/collection`).
- Nudge when `missingCost > 0`: "13 items have no cost price →" linking to
  `/seller/items?missing=cost`. Filling cost is what makes the card useful,
  so the card asks for it.

Data: a small composable `useInventoryWorth(items)` owns the market fetch
(`getCardsByIds` for the holdings' product ids, `getCollectionPriceTrend`
with quantities) and returns the `shared/portfolio.ts` results as computed
refs. It refetches only when the set of (productId, quantity) changes, not
on every inventory edit, so typing a cost does not refire a Supabase query.

Empty and degraded states:

- No holdings: the card is not rendered.
- Holdings but nothing priced: headline "—" with "No market prices yet for
  these cards" and the unpriced asking value shown instead.
- Trend unavailable (fewer than two snapshots): chart area shows the same
  short message `PriceTrendChart` already uses; the headline still renders.
- Supabase or FX failure: `getCardsByIds` returns [] and logs; the card
  degrades to the "nothing priced" state rather than showing RM 0.00 as if
  it were a market figure.

## Testing

- `test/portfolio.test.ts` (node --test, same harness as
  `sales-summary`): valuation with mixed priced/unpriced rows; cost basis and
  unrealised restricted to rows with both figures; realised per row and per
  period, with missing-cost rows counted in revenue but not in profit;
  quantity weighting; rounding; status filtering (reserved counts as held,
  sold does not).
- Manual check in the running app on a free port: add a card with cost and
  remark, confirm the row and the card update, confirm the remark does not
  appear on the public listing after "List for sale", import a CSV with a
  cost column, mark a row sold and see its profit.

## Rollout

- No migration. Existing rows have no `costPrice`; the nudge and the
  `missing=cost` filter are the backfill path.
- Existing online-sold rows have no `soldPrice`; profit falls back to
  `listPrice` for them, matching how the dashboard values them today.

## Later (not in this branch)

- Daily per-seller stock value snapshot (server cron) for a true wallet
  history that survives sales, plus 7-day and 1-year ranges.
- Net profit using the settlement lines already frozen on each order.
- Cost per copy on the collector's collection page, reusing
  `shared/portfolio.ts`.
- Cost entry in the scan review step.
- The manual listing form does not capture the catalog product id, so a
  listing created there is mirrored into inventory unpriced. Passing the
  `catalog-select` id through would let the card value those rows too.
