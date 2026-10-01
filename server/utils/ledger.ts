import type { Firestore, Transaction } from "firebase-admin/firestore";

// Append-only record of every ringgit that enters or leaves the Billplz
// holding account, plus the platform fee TCGo has earned on each order.
// Nothing ever updates an entry's amount; corrections are new entries.
//
// Doc ids are deterministic (`<orderId>:<kind>`, `<sweepId>:fee_sweep`) so a
// retried callback or payout can't double-post: Transaction.create() fails if
// the entry already exists.
//
// Holding balance = Σ amountSen over cash entries. It should always equal the
// bank balance of the holding account (see /api/admin/reconciliation).
export type LedgerKind =
  | "buyer_payment" // +  buyer paid a Billplz bill
  | "seller_payout" // −  Payment Order to the seller
  | "refund" //        −  money returned to the buyer
  | "fee_sweep" //     −  Payment Order moving earned fees to TCGo's own account
  | "platform_fee"; //  accrual (cash: false): fee TCGo earned on an order

export interface LedgerEntry {
  id: string;
  kind: LedgerKind;
  // Signed effect on the holding account, in sen. Positive for platform_fee
  // accruals, which don't touch the account until they're swept.
  amountSen: number;
  cash: boolean;
  orderId?: string;
  sellerUid?: string;
  // Billplz bill id or payment order id this entry corresponds to.
  externalRef?: string;
  // platform_fee only: the sweep that paid it out, once swept.
  sweepId?: string | null;
  createdAt: number;
  createdBy: string; // uid, or "billplz-callback"
}

export const ledgerCol = (db: Firestore) => db.collection("ledger");

export const ledgerId = (scope: string, kind: LedgerKind) => `${scope}:${kind}`;

export const postEntry = (
  db: Firestore,
  tx: Transaction,
  entry: Omit<LedgerEntry, "id" | "createdAt" | "cash"> & { scope: string },
) => {
  const { scope, ...rest } = entry;
  const id = ledgerId(scope, entry.kind);
  const doc: LedgerEntry = {
    ...rest,
    id,
    cash: entry.kind !== "platform_fee",
    createdAt: Date.now(),
  };
  // Firestore rejects undefined fields.
  for (const k of Object.keys(doc) as (keyof LedgerEntry)[]) {
    if (doc[k] === undefined) delete doc[k];
  }
  tx.create(ledgerCol(db).doc(id), doc);
};

// Platform fee in sen, rounded once. Rate comes from NUXT_PLATFORM_FEE_BPS
// (basis points, e.g. 300 = 3%); defaults to 0 until kai sets a rate.
export const platformFeeSen = (amountSen: number): number => {
  const bps = Number(useRuntimeConfig().platformFeeBps || 0);
  if (!Number.isFinite(bps) || bps <= 0) return 0;
  return Math.round((amountSen * bps) / 10_000);
};
