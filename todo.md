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
- [x] Inventory data model + Bulk add (CSV / Excel / ODS / paste, smart mapping, reconciliation, review, template)
- [x] Inventory ↔ listing bridge (list / unlist / sold sync both ways)
- [x] Items table: filter, pagination, select-all, bulk actions, inline photo upload

**Ops / flags**
- [x] Premium temporarily hidden behind a feature flag

---

## 🎯 Next — POS (original goal)
- [x] QR printing **v1** — batch printable label sheet (`/inventory/labels`): QR (encodes `tcgo:inv:<id>`) + name + set·number + condition + price; print / Save-as-PDF; entry points from Items (selected or all)
- [ ] POS scanner — continuous phone QR decode → stash (beep/haptic/dedup), resolve vs cached inventory
- [ ] Checkout — editable **sold price** (negotiation) → Mark paid → inventory `sold` + sales dashboard
- [ ] QR printing **v2** (thermal label export: Niimbot/Brother/Phomemo), **v3** (Web Bluetooth direct print)

---

## 🔜 Then

### Payments & fulfillment
- [ ] **Payment gateway** for orders (prerequisite for the items below — current flow is manual WhatsApp)
- [ ] **Parcel waybill creation for paid orders** — auto-generate a shipping waybill once an order is paid
  - [ ] Integrate **EasyParcel API** (MY aggregator: rate calc + waybill + multi-courier)
  - [ ] **Disable seller shipping-fee preference** (sellers no longer set `shippingWM` / `shippingEM`)
  - [ ] **System-calculated shipping** — charge buyer based on our rates (via EasyParcel), not seller-set fees
  - [ ] Tie into seller payout/escrow thread (see Later)

### Catalog / UX
- [ ] Detail-page market price (productId already stored — surface it + 30-day change)
- [ ] Price trend sparkline (history accruing daily)
- [ ] Legacy listings backfill into inventory (older `cards` don't show in Items yet)
- [ ] Bulk "set price / set condition" on a selection (post-import)
- [ ] Server-side batch matcher for large (1000+ row) imports

---

## 🗓️ Later / backlog
- [ ] Japanese cards seeding via TCGdex (catalog only; JP prices later)
- [ ] Seller payouts / escrow — MY blocks Stripe Connect (options: Billplz / Curlec / SG incorporation) — **decision deferred**
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
