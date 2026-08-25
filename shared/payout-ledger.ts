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
