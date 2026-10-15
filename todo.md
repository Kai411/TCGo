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
- [x] **Seller KYC** — `/inventory/verify`: contact + bank account (payouts) + pickup address (shipments); gates listing/auction creation and List actions (no document uploads — bank account is the identity anchor)
- [x] **Billplz integration (v1)** — `/api/billplz/create-bill` (server-computed amount, bill linked to order) + webhook (X-Signature verified → order `paid` + cards sold + inventory synced + `platformFee`/`sellerPayout`/`payoutStatus` written; fee 0% during beta). Buyer "Pay online (FPX)" + delivery-address capture on the order page. **Needs sandbox testing + env keys.**
- [x] **EasyParcel integration (v1, Developer Hub OAuth)** — migrated off the legacy connect API (account was Hub-only). One-time admin connect via `/api/easyparcel/connect` (auth-code + PKCE; tokens persist in Firestore `appSettings/easyparcel`, auto-refresh). `/api/easyparcel/rate` → `shipment/quotations`; `/api/easyparcel/shipment` → `shipment/submit_orders` (auto-pays wallet, returns AWB + label PDF). Seller "Create shipment" dialog unchanged. **Needs: app Platform URL = site callback, connect once, wallet credit, live test.**
- [x] **Seller funds + payout request (seller side)** — `/inventory/funds`: framed as the seller's money (not a debt). Available / Pending payout / Locked summary + locked detail + payout history; Funds tile on the sales dashboard + nav link. Funds = online (Billplz) orders only; lifecycle paid/shipped→locked, delivered+`PAYOUT_HOLD_DAYS`(3)→available, request→queued, executed→paid. "Request payout" flips available orders to `payoutStatus:queued` + `payoutRequestedAt`.
- [ ] Payout **execution** (admin side) — Billplz Payment Order API (or manual admin queue) consuming `payoutStatus:queued` → `paid` + `payoutPaidAt`; needs admin view + the actual transfer
- [ ] **Disable seller shipping-fee preference** (sellers no longer set `shippingWM` / `shippingEM`)
- [ ] **System-calculated shipping** — quote EasyParcel rates at checkout instead of seller-set fees

### Catalog / UX
- [ ] Detail-page market price (productId already stored — surface it + 30-day change)
- [ ] Price trend sparkline (history accruing daily)
- [ ] Legacy listings backfill into inventory (older `cards` don't show in Items yet)
- [ ] Bulk "set price / set condition" on a selection (post-import)
- [ ] Server-side batch matcher for large (1000+ row) imports

---

## 🗓️ Later / backlog
- [x] **Japanese cards — seeded from TCGCSV category 85 ("Pokemon Japan")** *(shipped 2026-06; superseded the old TCGdex plan)*:
  Same pipeline as EN — catalog + daily prices in one source. Seeded **62k total products** (EN + ~30k JP),
  coverage back to vintage (Expansion Pack '96, Jungle, vending series). English product names → scanner's
  Gemini-translated names match JP directly. Native BIGINT productIds, schema unchanged.
  - [x] Seed + snapshot scripts parametrized for categories [3, 85]; cat-85 rows tagged `language='JP'`
  - [x] Scanner + bulk-add photo scan: JP cards now attempt TCGo DB match (language-scoped), graceful fallback to scanned data on miss
  - [ ] Language toggle (EN / JP / All) in collection + bulk-add search UI (RPC already supports `lang`; search still defaults EN)
  - Caveat: JP prices are TCGPlayer **US-market USD** (international reference, not Japan-domestic yuyutei prices)
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
