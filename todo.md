# TCGo Roadmap / TODO

Status legend: ✅ done · 🎯 next · 🔜 then · 🗓️ later · 🧹 cleanup

> All shipped work lives on `feature/inventory` — build-verified, **not yet pushed**.

---

## ✅ Shipped

**Marketplace / buyer**
- [x] Compiled-order checkout (group by seller, WhatsApp manual flow) + order lifecycle + merge orders
- [x] Collection showcase (Supabase catalog search, add/remove, profile tab)
- [x] Live USD→MYR FX for catalog prices

**Catalog infra**
- [x] Supabase `cards_catalog` + `card_prices` (~32k Pokémon)
- [x] Daily price-snapshot cron (GitHub Actions) + trigram search RPCs
- [x] Scanner wired to the Supabase catalog

**Seller / inventory**
- [x] Sales stats dashboard (tiles → drill-down, weekly trend)
- [x] Inventory system split into `/inventory` + own layout; Activity slimmed to buyer-only
- [x] Inventory data model + Bulk add (CSV / Excel / ODS / paste / **photo scan via AI + TCGo DB match**, smart mapping, reconciliation, review, template)
- [x] Inventory ↔ listing bridge (list / unlist / sold sync both ways)
- [x] Items table: filter, pagination, select-all, bulk actions, inline photo upload

**Ops / flags**
- [x] Premium temporarily hidden behind a feature flag

---

## 🎯 Next — POS (original goal)
- [x] QR printing **v1** — batch printable label sheet (`/inventory/labels`): QR (encodes `tcgo:inv:<id>`) + name + set·number + condition + price; print / Save-as-PDF; entry points from Items (selected or all)
- [x] POS scanner — `/inventory/pos`: continuous phone QR decode (jsQR) → stash (beep/haptic/dedup), resolves vs cached inventory; manual search fallback
- [x] Checkout — editable **sold price** per line → Mark paid → `markItemSold(soldPrice)` on inventory (+ syncs linked listing)
- [x] Surface POS sales in the sales dashboard — dashboard now folds in direct/POS inventory sales (sales value, items sold, completed, weekly trend, recent), tagged `saleChannel` to avoid double-counting online orders
- [ ] POS: qty-aware selling for lots (qty > 1 currently sells the whole item)
- [ ] **POS: generate a payment QR after scanning** (long shot) — research DuitNow QR / payment-gateway QR for the cart total so the buyer can scan to pay at the table
- [x] QR printing **v2** — thermal label export: `/inventory/labels` "Thermal" mode renders one PNG per label at mm sizes (40×30 / 50×30 / 50×40), downloads as a ZIP for Niimbot/Brother/Phomemo apps
- [ ] QR printing **v3** (Web Bluetooth direct print)

---

## 🔜 Then

### Payments & fulfillment
> **DECISION (locked 2026-06): Billplz-only stack.** FPX collections via Billplz bills
> (flat RM 0.70–1.10/txn, no monthly fee) → funds in platform Billplz balance →
> custom scripts compute `platformFee` / `sellerPayout` on the order → payouts via
> Billplz **Payment Order API** to seller banks (manual admin payouts as fallback
> until API tier approved). Stripe stays for Premium subs only. DuitNow QR (Billplz/
> toyyibPay channel) is the path for the POS payment-QR idea. If volume outgrows DIY
> payouts → graduate to **Curlec Route**. Prereq: SSM business registration for
> gateway onboarding (start first — long pole).
- [ ] **Billplz integration** — bill creation for compiled orders, webhook → `paid`, payout queue/script
- [ ] **Parcel waybill creation for paid orders** — auto-generate a shipping waybill once an order is paid
  - [ ] Integrate **EasyParcel API** (MY aggregator: rate calc + waybill + multi-courier)
  - [ ] **Disable seller shipping-fee preference** (sellers no longer set `shippingWM` / `shippingEM`)
  - [ ] **System-calculated shipping** — charge buyer based on our rates (via EasyParcel), not seller-set fees
  - [ ] Payouts: `platformFee` / `sellerPayout` / `payoutStatus` fields + hold window after delivery

### Catalog / UX
- [ ] Detail-page market price (productId already stored — surface it + 30-day change)
- [ ] Price trend sparkline (history accruing daily)
- [ ] Legacy listings backfill into inventory (older `cards` don't show in Items yet)
- [ ] Bulk "set price / set condition" on a selection (post-import)
- [ ] Server-side batch matcher for large (1000+ row) imports

---

## 🗓️ Later / backlog
- [ ] **Japanese cards — seed from TCGCSV category 85 ("Pokemon Japan")** *(researched 2026-06; supersedes the old TCGdex plan)*:
  TCGPlayer added a dedicated JP category → same pipeline as EN gives **catalog + daily prices in one source**.
  Verified: ~448 groups (~35k est. products), full extendedData (Rarity/Number/attacks), TCGPlayer CDN images,
  live price rows (e.g. JP 151: 520 products / 488 price rows), **English product names** (so the scanner's
  Gemini-translated names can match JP cards too). Native BIGINT productIds — no hash scheme needed.
  - [ ] Parametrize seed + snapshot scripts for categories [3, 85]; tag `language='JP'` for cat-85 rows (schema unchanged)
  - [ ] Language toggle (EN / JP / All) in collection + bulk-add search (RPC already supports `lang`)
  - [ ] Scanner: attempt TCGo DB match for JP cards (was skipped when catalog had no JP)
  - Caveats: prices are TCGPlayer **US-market USD** for JP cards (international reference, not Japan-domestic yuyutei prices); coverage strongest SV-era onward, vintage JP may be spotty — verify during seed
- [x] Seller payouts / escrow gateway — **decided: Billplz-only** (see Payments & fulfillment above); Curlec Route is the scale-up path
- [ ] Re-enable Premium (flip the flag) when ready
- [ ] Multi-sheet `.xlsx` picker on import

---

## 🧹 Cleanup
- [ ] **Remove Collectr link populating**

---

## 🚦 Pre-deploy / pre-launch checklist
- [ ] Push `feature/inventory` → merge to staging/main, deploy
- [ ] Re-run `supabase/schema.sql` (search RPCs) on the live DB
- [ ] Set `NUXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` in Netlify
- [ ] GitHub secrets for the price cron (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`)
- [ ] Firestore rules — scope blanket "any auth can write" down to owners (careful with auctions/bidding + dual-party orders)
- [ ] Smoke-test the inventory loop (`npm run dev`): bulk add → list → sell → sync; photo upload; select-all bulk actions
