// The `payouts` collection — one document per payout batch.
//
// This is the audit record: which orders, how much, to which account, when,
// and what Billplz said about it. Order documents carry only a pointer
// (`payoutId`) and a mirrored status for fast per-order display.

export type PayoutBatchStatus =
  | "queued" // seller requested, awaiting admin execution
  | "processing" // instruction sent to Billplz, transfer in flight
  | "paid" // Billplz confirmed (or admin recorded a manual transfer)
  | "failed"; // Billplz rejected — orders released back for a retry

export interface PayoutBatch {
  id: string;
  sellerUid: string;
  sellerName: string;
  sellerEmail?: string;
  orderIds: string[];
  amount: number; // MYR, sum of the per-order payouts at request time
  status: PayoutBatchStatus;

  // The account the money was actually sent to, snapshotted at request time so
  // a later profile edit can't rewrite history. Deliberately excludes the IC —
  // that's read from the profile at execution time and never stored here.
  recipient: {
    bankCode: string;
    bankName: string;
    bankAccountNumber: string;
    name: string;
  };
  // False when the bank's Billplz code is unconfirmed — admin transfers by hand
  // and records it with /api/payouts/mark-manual.
  autoPayoutSupported: boolean;

  requestedAt: number;
  executedAt?: number;
  paidAt?: number;
  failedAt?: number;
  failureReason?: string;

  billplzCollectionId?: string;
  billplzInstructionId?: string;
  billplzStatus?: string; // raw status string, for debugging
  executedByUid?: string;
  manualReference?: string; // bank reference when transferred by hand
}

export const PAYOUT_STATUS_LABEL: Record<PayoutBatchStatus, string> = {
  queued: "Awaiting payout",
  processing: "Transfer in progress",
  paid: "Paid",
  failed: "Failed",
};

// ── Status history ────────────────────────────────────────────────────
//
// Derived from the timestamps already on the batch rather than stored as a
// separate event log: every stage has exactly one authoritative timestamp, so
// a second write path could only ever disagree with them.

export interface PayoutEvent {
  key: "requested" | "executed" | "paid" | "failed";
  label: string;
  detail?: string;
  at: number;
}

export const payoutHistory = (b: PayoutBatch): PayoutEvent[] => {
  const out: PayoutEvent[] = [];
  if (b.requestedAt) {
    out.push({
      key: "requested",
      label: "Payout requested",
      detail: `${b.orderIds?.length ?? 0} order(s)`,
      at: b.requestedAt,
    });
  }
  if (b.executedAt) {
    out.push({
      key: "executed",
      label: b.autoPayoutSupported ? "Sent to the bank" : "Queued for manual transfer",
      detail: b.billplzStatus ? `Bank status: ${b.billplzStatus}` : undefined,
      at: b.executedAt,
    });
  }
  if (b.paidAt) {
    out.push({
      key: "paid",
      label: "Paid",
      detail: b.manualReference ? `Reference ${b.manualReference}` : undefined,
      at: b.paidAt,
    });
  }
  if (b.failedAt) {
    out.push({
      key: "failed",
      label: "Transfer failed",
      detail: b.failureReason,
      at: b.failedAt,
    });
  }
  return out.sort((x, y) => x.at - y.at);
};

/** What the seller should expect next, when the batch is still in flight. */
export const payoutNextStep = (b: PayoutBatch): string | null => {
  if (b.status === "queued") return "Waiting for TCGo to submit this batch to the bank.";
  if (b.status === "processing") return "The bank is processing the transfer — usually the next working day.";
  return null;
};
