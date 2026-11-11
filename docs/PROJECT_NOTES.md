# TCGo project notes

Key decisions and conventions for anyone joining the project. Read this before your first PR.
Last updated 2026-11-11. If something here disagrees with the code, the code wins; please fix this file in the same PR.

## What TCGo is

A Pokémon TCG marketplace for Malaysia: fixed-price listings (Shop), auctions, chat between buyers and sellers, a card price database (TCGo Dex), seller tools and an admin area (Mint Condition, at `/mintcondition`).

## Stack and services

| Area | What we use |
| --- | --- |
| App | Nuxt 4, Vue 3.5, TailwindCSS 3.4 (`CLAUDE.md` still says Nuxt 3; `package.json` is the truth) |
| Main backend | Firebase Auth and Firestore |
| Card prices | Supabase (`cards_catalog`, `card_prices`) |
| Marketplace payments | Billplz (FPX) |
| Pro membership | Stripe (subscriptions only, not marketplace payments) |
| Email | Mailtrap (sign-up codes, admin test email). Password reset uses Firebase's own reset link |
| Seller ID check | Didit |
| Hosting | Netlify and Vercel. Both build PR previews |
| Node | 22 (`.nvmrc`) |

Server environment variables come from `runtimeConfig` in `nuxt.config.ts` (camelCase key becomes `NUXT_` + SNAKE_CASE). Ask kai for values; never commit them or paste them in issues, PRs or chat. `NUXT_PUBLIC_SITE_URL` must be set on any new host because Billplz callbacks and Stripe return URLs are built from it.

## Branches and PRs

- **`staging` is the active branch.** Branch from `origin/staging` and open PRs against `staging`. `main` lags behind and is only re-synced from staging now and then.
- The nightly price workflow (`.github/workflows/snapshot-pokemon-prices.yml`) is a scheduled GitHub Action, so it runs from `main` (the default branch). A fix to it on staging does nothing until main is synced.
- **There is no CI.** Before asking for review, run both:
  ```bash
  npm test          # node --test over test/**/*.test.ts
  npx nuxt build
  ```
  and say in the PR that they passed.
- kai merges. When several PRs are ready they are merged into staging together with merge commits, then tested and built once.
- Share PR preview links (Netlify deploy preview or the Vercel URL in the PR checks) with screenshots, not staging links. Server features only work on a preview whose site has the server variables set.
- Keep PRs to one task. Mention unrelated bugs you find instead of fixing them in the same PR.

## Firestore rules and indexes

- `firestore.rules` and `firestore.indexes.json` in the repo are the source of truth, but they are **not deployed automatically**. kai pastes them into the Firebase console by hand.
- A paste **replaces everything**, so a rules change must always be the full file from latest staging, never a fragment. If you add an index, list its exact collection and fields in the PR.
- A feature that needs new rules will not work in production until the paste happens. Say so in the PR.

## Business and legal decisions

- **Malaysia only.** The business registers with SSM (enterprise first). Prices are in MYR.
- **Billplz marketplace model ("merchant of record").** Buyers pay TCGo's one Billplz account. TCGo keeps its own seller ledger and pays each seller per completed order with Billplz's **Payment Order** API. **Refunds also go through Payment Order.** We do not use Billplz Split Rule (it needs every seller to have their own registered Billplz account). Billplz has confirmed in writing that this model is fine for them.
- Platform fees are swept out only on completed orders. We don't hold stored seller balances.
- Say **"Buyer Protection"**, never "escrow", in the UI and docs. Billplz is not an escrow service and we are not licensed as one.
- Seller terms must state money retention, fulfilment timelines and payout conditions. A Malaysian lawyer still has to review the policies and operator details in `shared/legal.ts` (currently placeholders, English only).
- Personal data (IC, bank account, address, phone) lives in a private per-user record, not on the public profile (PDPA). PDPA consent is a required box at sign-up. Bumping `LEGAL_VERSION` asks every member to agree again, so only bump it when they must.
- Gateways compared: Billplz is the choice. HitPay is out for the marketplace (no Malaysian payout API). Curlec Route is the fallback if Billplz ever changes its mind.
- **Pro membership costs RM5.99 a month.** It is one shared constant (`MARKETPLACE_MONTHLY` in `shared/pricing.ts`); the Stripe price must match it. Pro is hidden for now: `PREMIUM_ENABLED = false` in `composables/useFeatureFlags.ts`.
- Launch promo: two months of Pro free for new users (never paid Pro) with code `TCGO2026`, until 31 Dec 2026. The coupon lives in Stripe.

## Feature state

- **TCGo Dex** (formerly "Collection"): the name in all copy is "TCGo Dex"; URLs stay `/collection`. Prices are TCGPlayer USD market prices (via TCGCSV), imported nightly into Supabase with a 365-day history and converted to MYR in the browser (`/api/fx/usd-myr`). Cardmarket EUR is a manual fallback. Default sort is newest release. The Dex tab on profiles is hidden by one setting in `shared/dex.ts`.
- **Card price page** (`pages/collection/[productId].vue`): on phones the price must show without scrolling.
- **Card scanning** (`/api/identify-card`): sign-in required, 20 scans a month plus a one-time 5 bonus, counted on the server; Pro is unlimited; seller photo import counts toward the same limit.
- **Auctions**: winning creates an order the winner pays through Billplz.
- **Chat** needs the `conversations` and `userStats` rules and a `conversations` composite index.
- **Seller onboarding** is one four-step flow at `/seller/onboarding`.
- **Help Center** (`shared/help.ts`): members send enquiries; staff answer in Mint Condition > Enquiries with an in-app bell notification (no email).
- **Banners and microsites**: Mint Condition > Content holds up to 8 banners per page on Shop and Auctions (3:1 images, in-app links only) and articles at `/p/{slug}`.
- **Account security** (`shared/security-lock.ts`): for 24 hours after a password change, payout requests and changing the payout bank account are refused on the server. Bank details save through `/api/account/payout-details`, not direct Firestore writes.
- **eBay**: active listings show on card price pages. Sold prices need eBay Marketplace Insights approval, so that code is switched off. **No scraping** of eBay or any other site.
- **Push notifications** are built but off until VAPID keys are set. Once generated, VAPID keys must never change.
- **PWA**: installed-app launch screens come from `scripts/generate-splash.py`.
- Not built yet: delete account, change email, a sold-price adjustment from eBay data.
- Untested end to end with real services: Didit, Google sign-in, live Billplz, push.

## Mobile UI decisions and conventions

Most users are on phones, and many use dark mode. Check every UI change at phone width (390px and 360px), in light and dark, signed in and signed out.

These are kai's decisions. Don't "fix" them without asking:

- **Bottom nav**: Marketplace, Auctions, Sell, Dex, Account. Sell is a raised red circle; the shared page layout adds bottom space to clear it.
- **Phone header**: pages with search show one row (search, chat, bell, cart) and no logo; Account, Dex and Messages hide search and show the logo.
- **Listing grids** (`components/CardTile.vue`) are 3 columns on phones, with kai's exact type sizes (name 12px, set/seller line 8px, price 10px bold), 6px tile corners and `-mx-1.5 lg:mx-0` on the grid. Phones show "RM" prices; desktop shows "MYR".
- **Filters toolbar** on phones: two 34px buttons (Filters with a count badge, Sort).
- **Page zoom is off on touch screens** on purpose. Photos zoom in the shared lightbox: use `useLightbox().openLightbox(images, index)` (`components/ImageLightbox.vue`), not a new overlay.
- **Flat vs cards**: listing-style pages use the `panel` class (flat sections under 1024px). Settings and form pages keep cards (`surface rounded-2xl`).

Conventions:

- `viewport-fit=cover` is set app-wide, so pad fixed bottom UI with `env(safe-area-inset-bottom)`.
- Back buttons use `composables/useGoBack.ts`.
- Tap targets should be at least 44px for new controls.
- Design references kai uses: Emil Kowalski's design-engineering and mobile-native guidelines.

## Naming kai uses

- "Profile page" is `/profile/{uid}`. "Account settings" is `/profile`. "Account management" is `/account`.
- "Mint Condition" is the admin area at `/mintcondition`.
- "Razorpay" means Curlec.

## Decided, please don't re-raise

- Billplz (with Payment Order for payouts and refunds), not Stripe Connect, for the marketplace.
- "Buyer Protection", not "escrow".
- Disabled page zoom on touch screens, the 3-column phone grid and its exact sizes, the 34px Filters button, back arrow with title, and the hidden search row on Account, Dex and Messages.
- Pro at RM5.99 a month.
- No scraping for price data.
- Price-history gap from 2026-09-28 to 2026-10-06 can't be backfilled.
