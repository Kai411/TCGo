# TCGo Roadmap

Last updated: 2026-05-22. Living doc — tick items as they ship, move blocks between versions as priorities shift.

## At a glance

- **Released**: V 0.3.0 (May 21)
- **In progress**: V 0.4.0 — code complete; only `seed 100 listings` (content work) remains
- **Next**: V 0.5.0 — Stripe payments + premium membership
- **After**: V 0.6.0 — wishlist, collection tracker, market prices
- **Future**: live breaks, in-app chat, trades, reviews

---

## V 0.4.0 — Bug fixes + polish + groundwork (current sprint)

- [x] **Fix PWA install popup** — `useInstallPrompt` listens for `beforeinstallprompt` and surfaces a bottom card with Install/Later; 14-day quiet period after dismiss.
- [x] **iOS "Add to Home Screen" prompt** — same `<InstallPrompt>` component detects iOS Safari (where the API doesn't exist) and opens a sheet walking through Share → Add to Home Screen.
- [x] **Filters in shop index page** — rarity, variant, language, product type, condition, set, price range. Sheet UI with removable inline chips, plus sort.
- [x] **Filters in auction index page** — shop filters + status (live/ended) + time-left buckets + ending-soon / most-bids sort.
- [x] **My Listings / My Activity page refactor** — `/activity` with Selling / Bidding / History tabs (query-param routing). Old `/dashboard/buyer` + `/dashboard/seller` URLs redirect.
- [x] **Profile page: cards / auctions / favourite toggle spacing** — tightened text size, padding, and gap on the underline tab strip.
- [x] **Improve search** — `<SearchModal>` full-screen overlay across cards + auctions, with recent searches (localStorage), popular sets, and active sellers derived from live listings.
- [x] **Market price indicator in scan flow** — pokemontcg.io price block flows into the scan queue; "Market RM X–Y" badge under each draft and a pre-filled price placeholder.
- [ ] **Seed shop with ~100 real listings** — content work, not code. Catalog of actual cards across TCGs to populate the index for launch credibility.
- [x] **AppNavbar logo → `/` instead of `/landing`** — in-app nav now stays in-app.
- [~] **Landing page "TCGo marketplace →" link** — tried `target="_blank"`; user preferred same-tab. Now plain `<NuxtLink to="/">` everywhere. (Open in new tab forces a cold dev-bundle load.)

---

## V 0.5.0 — Membership + Payments

Branch: `feature/membership-stripe`. Full spec in **[Membership + Stripe — full build plan](#membership--stripe--full-build-plan)** below.

- [ ] **Step 1 — Bonus scans** (no Stripe yet) — +5 one-time card-free preview for free users
- [ ] **Step 2 — Stripe SDK + checkout endpoint** — `/api/stripe/checkout.post.ts`
- [ ] **Step 3 — Webhook endpoint** — `/api/stripe/webhook.post.ts` (sig verify + Firestore writes)
- [ ] **Step 4 — `/pricing` page** — Free vs Premium comparison + Upgrade button
- [ ] **Step 5 — Settings: Manage Subscription** — `/api/stripe/portal.post.ts` + button for active premium users
- [ ] **Step 6 — Production flip** — Stripe live keys, live webhook endpoint, end-to-end test

---

## V 0.6.0 — Tier 1 differentiators

Detail in **[Competitive features](#tier-1--competitive-differentiators)** below.

- [ ] **Wishlist / want-list with push alerts** — biggest engagement multiplier
- [ ] **Collection tracker (scan-to-own)** — separate from selling; "My Collection" surface
- [ ] **Market price reference per card** — full integration with TCGdex/JustTCG (broader than V0.4 scan-only indicator)
- [ ] **Set completion tracking** — "42/189 Scarlet & Violet" progress bars

---

## Later — ergonomic wins (V 0.7.0+)

- [ ] **In-app messaging** — replace WhatsApp-only seller contact
- [ ] **Seller ratings & reviews** — needs lifecycle status transitions
- [ ] **Native push notifications** — outbid, wishlist match, message
- [ ] **Trade offers (peer-to-peer)** — culturally important in MY/SG
- [ ] **Bundle / multi-card lots** — one listing, multiple cards, single shipping

---

## Future bets — Tier 3

- [ ] **Live breaks / live auctions** — the Hoopi/Collektr moat. Hard build (WebRTC, moderation, payments-during-live), only when seller pipeline justifies it.
- [ ] **Stories** — 24h reel of new arrivals per seller
- [ ] **Loyalty coins** — Hoopi-style earn/redeem
- [ ] **PSA / CGC submission service** — Collektr-style. Operational lift; revenue lever for high-end.
- [ ] **AR card preview** — tilt-to-see-holo
- [ ] **Pre-orders / group buys** — formalize the Facebook-group pattern
- [ ] **Grading recommendation** — "this card might be worth grading"

---

## Engineering hygiene (background, not version-gated)

- [ ] Remove the `silence-manifest-warning` plugins once Nuxt fixes the duplicate `manifest-route-rule` middleware registration upstream (currently floods the dev log and slows responses 100x).
- [ ] Move `nuxt: "3.13.2"` pin → unblock 3.21+ once the vite-node IPC bug is fixed upstream
- [ ] Replace `bidCount` per-tick recompute with a Firestore-side aggregate
- [ ] Admin tool to flip user tier (free ↔ premium) without Firebase Console
- [ ] Consider partial SSR via `routeRules` (`prerender`/`swr`) for `/`, `/cards/[id]`, `/auctions/[id]` so social link previews show per-listing data without going full SSR
- [ ] Replace constant USD/EUR → MYR rates in `useMarketPrice` with a live FX feed once the static rate drifts >5%

### Schema fields shipped without UI (wire when feature lands)

- `era` — auto-derive from set, surface as filter
- `tags[]` — free-form, wishlist (V0.6) consumer
- `defects[]` — condition transparency
- `certNumber` — graded slabs (grading service)
- `viewCount` — engagement metric for sellers
- `status` lifecycle (`active` → `reserved` → `sold` → ...) — needed for reviews + reserved-listings flow

---

## Released

### V 0.3.0 — May 21, 2026
- [x] Beta verification gate
- [x] Card tile redesign (grade overlay, seller in body, 3.55:5 aspect ratio)
- [x] Auction tile redesign (LIVE / ENDED merged badge, urgency colors)
- [x] Price comma formatting (10,000.00) + RM prefix
- [x] Scanner simplified (removed rarity/variant/edition auto-detect — was wrong too often)
- [x] Image handling — scan-to-list no longer saves pokemontcg.io image
- [x] Detail page cleanup
- [x] PWA service worker — narrowed precache to fix post-deploy chunk mismatch crash

### V 0.2.0 — May 21, 2026
- [x] Membership tier system (Free 20 scans/month, Premium unlimited)
- [x] Multi-TCG support (Pokémon, One Piece, Digimon, MTG, Yu-Gi-Oh!, DBS, Lorcana, Other) + shop filter pills
- [x] Japanese / non-English scanner (language detection, JP set number preserved)
- [x] Installable app (PWA)
- [x] Dark mode polish across every page + theme persists on refresh
- [x] Smarter scanner — 4K capture, upload quality bump, scan/manual toggle, Gemini 3.1 Flash-Lite
- [x] Activity tab on mobile
- [x] Grade badge on detail page
- [x] Photo counter on multi-photo listings
- [x] Auction tile bid count fix

### V 0.1.0 — May 21, 2026
- [x] Queued scanner for create listing
- [x] Improved marketplace UI

### V 0.0.x — May 14–19, 2026
- [x] First prototype (V 0.0.1)
- [x] Sales listings + live bidding (V 0.0.2)
- [x] Google login + profile management (V 0.0.3)
- [x] Landing page + privacy policy (V 0.0.4)
- [x] Closed beta launch (V 0.0.5)

---

## Competitive landscape (reference)

| Platform | Positioning | Killer feature |
|----------|-------------|----------------|
| [Collektr](https://collektr.co/) | "Asia's premier live bidding platform" | Livestream auctions, PSA grading submission, multi-category |
| [Hoopi](https://www.hoopi.xyz/) | TCG-only, gamification-heavy | Live Breaking, Hoopi Coins currency, Leaderboards |
| [Acorn TCG](https://www.acorntcg.com/) / [Dex](https://apps.apple.com/us/app/dex-for-tcg-collectors/id1555489854) / [Omi](https://tcgscanneromi.com/) | Collection trackers | Scan-to-own, set completion tracking |
| [TCGplayer](https://play.google.com/store/apps/details?id=com.tcgplayer.tcgplayer) | Market data + marketplace (US) | Market price reference, watchlists, historical pricing |

## TCGo moats (don't lose these)

- **AI-powered scanner with multi-field auto-fill** — name, number, language, artist
- **Japanese card support** — language detection, JP number preserved, English name translation
- **Multi-TCG support** — Pokémon, One Piece, Digimon, MTG, Yu-Gi-Oh!, DBS, Lorcana, Other
- **WhatsApp-native seller contact** — lower friction in MY/SG market
- **Membership tier system** — schema + UI shipped, awaiting payment gateway
- **PWA-installable** — no app store needed

---

## Tier 1 — Competitive differentiators (deeper detail)

### Wishlist / want-list with alerts
- Buyer: "Looking for Charizard ex 215/197 under RM 200"
- Push notification when a matching listing goes live
- Filterable by name, set, condition floor, max price, language

### Collection tracker (scan-to-own)
- "My Collection" — cards you own, not listed
- Scan pipeline routes to inventory instead of draft listing
- Total collection value (from market reference)
- Set completion bars
- Sell-from-collection in one tap

### Market price reference per card
- "Market value: RM 80–110" next to listing's asking price
- Source: [TCGdex](https://tcgdex.dev/) (free, multilingual, JP) or [JustTCG](https://justtcg.com/) (paid, fuller JP)
- Anchors buyers + sellers; powers collection valuation

### Live breaks / live auctions
- WebRTC stream + real-time chat + bidding overlay
- Cloudflare Stream or Mux for video infra
- Deferred: ~4 week build. Success hinges on streamer pipeline, not tech.

---

## Membership + Stripe — full build plan

> Branch: `feature/membership-stripe`. Spec only — implementation tracked in **[V 0.5.0](#v-050--membership--payments)** above.

### Decisions locked in
- **Price**: RM **5.99 / month**. Monthly only for v1.
- **Trial**: Card-free preview — first time a free user taps "Upgrade", grant **+5 bonus scans** (one-time, lifetime). Consumed before the monthly 20.
- **Payment methods**: **Cards only** for the subscription. FPX/GrabPay/DuitNow are single-charge methods — can't auto-renew via Stripe.
- **Cancel**: Keep Premium until current period ends, then auto-flip to Free. Stripe `cancel_at_period_end: true`.

### User flow

```
Free user (in scanner, hit quota OR clicked Upgrade)
   │
   ├── First time: "Try Premium — +5 bonus scans" → claim → back to scanner
   │
   └── After trial used / direct upgrade
         │
         ▼
   POST /api/stripe/checkout
         │ creates Stripe Checkout Session
         ▼
   Stripe Hosted Checkout (card form)
         │
         ├── success → /membership/success → settings shows Premium
         └── cancel  → /membership/cancel  → back to /pricing

(Async)
Stripe ──webhook──► /api/stripe/webhook
                      writes Premium + Stripe IDs + period dates to Firestore
```

### Pages
| Path | Purpose |
|------|---------|
| `/pricing` *(new)* | Public. Free vs Premium comparison + Upgrade CTA |
| `/membership/success` *(new, small)* | Post-checkout landing → /profile |
| `/membership/cancel` *(new, small)* | Post-cancel landing → /pricing |
| `/profile` Membership tile | Extend: Manage subscription button → Stripe Customer Portal |

### Server endpoints
| Path | Method | Purpose |
|------|--------|---------|
| `/api/stripe/checkout` | POST | Authed. Creates a Checkout Session; returns the hosted URL |
| `/api/stripe/portal` | POST | Authed. Creates a Customer Portal Session; returns the URL |
| `/api/stripe/webhook` | POST | Stripe → us. Sig verify, Firestore writes |

**Webhook listens for:**
- `checkout.session.completed` → save IDs, set `tier: "premium"`, `currentPeriodEnd`
- `customer.subscription.updated` → sync status + period dates + `cancelAtPeriodEnd`
- `customer.subscription.deleted` → set `tier: "free"`, clear sub fields
- `invoice.payment_failed` → set `subscriptionStatus: "past_due"`, stay premium during retry window

### Schema additions on `UserProfile`

```ts
// Subscription state — only the webhook writes these.
stripeCustomerId?: string;
stripeSubscriptionId?: string;
subscriptionStatus?: "active" | "past_due" | "canceled" | "trialing" | "incomplete";
currentPeriodEnd?: number;
cancelAtPeriodEnd?: boolean;

// Card-free preview — set when user claims the +5 bonus.
bonusScansRemaining?: number;
bonusScansClaimedAt?: number;
```

`tier` is derived server-side from `subscriptionStatus` so it can't go out of sync.

### Quota check order (`useScanQuota.tryConsumeScan`)
1. Premium → allow, no decrement
2. Else `bonusScansRemaining > 0` → decrement bonus
3. Else `scansUsed < FREE_SCAN_LIMIT` → increment used
4. Else → block, show upgrade CTA

### Env vars (Netlify)
```
STRIPE_SECRET_KEY                  = sk_test_… (then sk_live_…)
STRIPE_WEBHOOK_SECRET              = whsec_…
STRIPE_PRICE_ID_PREMIUM_MONTHLY    = price_…
NUXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = pk_test_… (then pk_live_…)
NUXT_PUBLIC_SITE_URL               = https://tcgo.shop
```

### Stripe dashboard setup (one-off, manual)
1. Confirm Stripe account region = Malaysia
2. Product: "TCGo Premium", recurring price RM 5.99 / month
3. Enable Customer Portal: allow cancel + change card; no plan switching (only one plan)
4. Webhook endpoint → `https://tcgo.shop/api/stripe/webhook` with the 4 events above. Copy signing secret.
5. Test mode keys during build; flip to Live keys for production.

### Open / deferred
- Yearly plan toggle on /pricing (when monthly is converting)
- Lifetime one-time tier
- DuitNow Direct Debit for non-card recurring (custom integration)
- Admin sub-status dashboard
