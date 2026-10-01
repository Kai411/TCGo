# TCGo system design

Last updated: 2026-10-01. Covers how orders and money move. Catalogue,
scanner and auctions are unchanged and only summarised.

## 1. Shape of the system

```
Browser (Nuxt SPA, ssr:false, PWA)
  │  reads: Firestore listeners (cards, compiledOrders, users …)
  │  writes: Firestore for listings/profile/favourites;
  │          /api/* (with Firebase ID token) for orders, payments, membership
  ▼
Nitro server routes on Netlify (server/api/*)
  ├─ firebase-admin  → Firestore (orders, ledger, payouts, users)
  ├─ Billplz         → bills in, Payment Orders out (Buyer Protection)
  ├─ Stripe          → Premium membership subscription only
  └─ Gemini          → card identification
Supabase (Postgres) → card catalogue + price history (public read)
GitHub Actions      → nightly catalogue seed + price snapshots
```

## 2. What was wrong before this change

| Problem | Effect |
|---|---|
| `/api/stripe/checkout` took `uid`, `email` and line-item prices from the request body | Anyone could start a checkout for another user's account, and the unused `payment` mode would have charged whatever price the browser sent |
| `/api/stripe/portal` took `customerId` from the body | Anyone who learned a customer id could open that customer's billing portal |
| Every order write (create, confirm, ship, deliver, cancel, merge) ran in the browser | Prices and totals came from the client; nothing on the server stopped a buyer marking their own order delivered or a seller editing a total; safety rested entirely on Firestore rules that aren't in this repo |
| Confirming an order flipped `cards.sold` without checking it | Two sellers' confirmations (or a confirm and a merge) could sell one card twice |
| Payment design assumed Stripe Connect-style escrow | Stripe Connect isn't available; kai's chosen flow is a Billplz holding account with per-order payouts |
| No record of money in or out | Nothing to reconcile the holding account against |
| Stripe webhook not idempotent; `past_due` dropped users to Free | Replayed events re-applied; users lost Premium during card retries, contrary to the roadmap |

## 3. Order lifecycle

Source of truth: `utils/orders.ts` (`canTransition`), shared by browser and
server. Only the server writes `compiledOrders`.

```
pending ──seller──► confirmed ──(manual) seller──────────────► shipped
   │                   │  └──(billplz) Billplz callback ► paid ──seller──► shipped
   │                   │                                   │
   └──buyer/seller──► cancelled ◄──buyer/seller───────────┘ (manual only)

shipped ──buyer──► delivered ──after 3 days, payout──► completed
   │                  │
   └──buyer──► disputed ◄──buyer (within 3 days)
                  ├── admin ► completed   (seller wins, payout released)
                  └── admin ► refunded    (buyer wins)
paid ──admin──► refunded
```

- `manual` orders are today's WhatsApp flow. TCGo never touches the money,
  so there is no dispute, refund or payout state for them.
- `billplz` orders are Buyer Protection. Only the signed Billplz callback can
  mark them paid, and they must be paid before they ship.
- Confirming reserves every card in a transaction and fails with 409 if any
  card is already sold. Cancelling a confirmed or paid order relists them.

## 4. Buyer Protection money flow (Billplz)

Matches the flow kai chose and the legal notes in
`/mnt/project-files/legal/malaysia-licensing-and-escrow.md`: one holding
account, per-order payouts, fees swept only from completed orders, no stored
seller balances.

```
1. Buyer taps Pay on a confirmed order
   POST /api/orders/:id/pay
     · re-reads every card; refuses if a listing's price or seller changed
     · creates a Billplz bill for the total (in sen) → redirect to Billplz
2. Billplz → POST /api/payments/billplz/callback
     · verifies X-Signature, then re-fetches the bill from Billplz
     · ledger: buyer_payment +amount   (id <orderId>:buyer_payment, once)
     · order: confirmed → paid         (or needsRefund if it was cancelled)
3. Seller ships, buyer marks delivered → payoutEligibleAt = now + 3 days
4. POST /api/cron/release-payouts (scheduled) or
   POST /api/admin/orders/:id/release-payout
     · fee = amount × NUXT_PLATFORM_FEE_BPS
     · Billplz Payment Order: amount − fee → seller's payoutAccounts/{uid}
     · ledger: seller_payout −(amount − fee), platform_fee +fee (accrual)
     · order: completed, payoutStatus queued
5. POST /api/admin/fee-sweep
     · one Payment Order of all unswept platform_fee → TCGo's own account
     · ledger: fee_sweep −total; each fee entry stamped with sweepId
```

Refunds: an admin pays the buyer back (bank transfer or Payment Order), then
records it with `POST /api/admin/orders/:id/refund { externalRef }`, which
writes a `refund` ledger entry and moves the order to `refunded`.

### Ledger (`ledger` collection)

Append-only, amounts in integer sen, deterministic ids so retries can't
double-post. `cash` entries sum to the holding account's balance:

| kind | sign | cash |
|---|---|---|
| buyer_payment | + | yes |
| seller_payout | − | yes |
| refund | − | yes |
| fee_sweep | − | yes |
| platform_fee | + | no (earned, not yet moved) |

### Reconciliation

`GET /api/admin/reconciliation?bankBalanceSen=…` returns the ledger balance,
what's still owed out, unswept fees, the difference against the bank, and a
per-order issue list (paid without a ledger entry, amount mismatch, payout
stuck in `processing` or `failed`, payments needing refund, completed orders
whose payout + fee ≠ payment). Run it before every fee sweep.

### Failure handling for transfers

Every outgoing transfer is lock → call Billplz → record. A failure at the
Billplz call marks the order `payoutStatus: failed` (or the sweep `failed`
and releases its fees) so it can be retried. A crash after Billplz accepted
but before recording leaves `processing`; reconciliation lists those and an
admin checks the Payment Order in Billplz before retrying.

## 5. Data and access

| Collection | Written by | Readable by |
|---|---|---|
| compiledOrders | server only | the order's buyer and seller, admins |
| ledger, feeSweeps, stripeEvents | server only | nobody from the browser |
| payoutAccounts/{uid} | server only (`PUT /api/payouts/account`) | nobody from the browser; owner sees a masked copy via `GET /api/payouts/account` |
| users.{tier, stripe*, subscription*} | Stripe webhook | owner |

Firestore rules to deploy once the browser uses the new API (Firebase console
→ Firestore → Rules, merged into the existing rules):

```
match /compiledOrders/{id} {
  allow read: if request.auth != null &&
    (resource.data.buyerUid == request.auth.uid ||
     resource.data.sellerUid == request.auth.uid);
  allow write: if false;
}
match /ledger/{id}         { allow read, write: if false; }
match /feeSweeps/{id}      { allow read, write: if false; }
match /payoutAccounts/{id} { allow read, write: if false; }
match /stripeEvents/{id}   { allow read, write: if false; }
// cards: sellers may still edit their own listing, but never `sold`/`soldAt`,
// which only the order service sets.
```

Index needed by the payout cron (Firestore will print a create-index link on
first run): `compiledOrders` on `status ASC, payoutStatus ASC, payoutEligibleAt ASC`.

## 6. Configuration

| Env var | Purpose |
|---|---|
| `NUXT_FIREBASE_SERVICE_ACCOUNT` | base64 service account (now also used to verify ID tokens) |
| `NUXT_ADMIN_UIDS` | comma-separated admin uids for `/api/admin/*` |
| `NUXT_CRON_SECRET` | bearer secret for `/api/cron/*` |
| `NUXT_BILLPLZ_API_KEY`, `NUXT_BILLPLZ_X_SIGNATURE_KEY` | Billplz credentials |
| `NUXT_BILLPLZ_COLLECTION_ID` | collection for buyer bills |
| `NUXT_BILLPLZ_PAYMENT_ORDER_COLLECTION_ID` | collection for payouts and sweeps |
| `NUXT_BILLPLZ_SANDBOX` | `true` until go-live |
| `NUXT_PLATFORM_FEE_BPS` | platform fee, basis points (default 0) |
| `NUXT_TCGO_BANK_CODE`, `NUXT_TCGO_BANK_ACCOUNT`, `NUXT_TCGO_ACCOUNT_NAME`, `NUXT_TCGO_IDENTITY_NUMBER` | TCGo's own account for fee sweeps |

## 7. Before going live

1. Verify the Payment Order checksum field order and the `reference_id`
   parameter against Billplz's v5 docs in the sandbox (`server/utils/billplz.ts`).
2. Get Billplz's written OK for marketplace use (see legal notes).
3. Deploy the Firestore rules above.
4. Schedule `/api/cron/release-payouts` (hourly is plenty).
5. Build the UI pieces: Pay button on confirmed orders (`startPayment`),
   dispute button (`raiseDispute`), seller payout-account form, admin payout
   and reconciliation screens.
6. Have a lawyer review before scaling payouts.

## 8. Next steps (not in this change)

- Auto-cancel confirmed-but-unpaid Buyer Protection orders after 24h so cards
  don't stay reserved forever.
- Auto-deliver orders 14 days after shipping if the buyer never confirms.
- Poll Payment Order status (`getPaymentOrder`) to move `payoutStatus` from
  `queued` to `paid`/`failed`.
- Move listing and auction bid writes behind the server the same way.
- Remove the unused legacy `orders` collection code (`composables/useOrders.ts`,
  `components/OrderCard.vue`).
- Take the Firestore/user backup JSON files out of the repo root; they contain
  user data.
