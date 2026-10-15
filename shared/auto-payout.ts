// Automatic payouts — the decision, separated from the sending.
//
// This file answers one question: given the queued batches and the current
// settings, which ones should go out right now? It touches no network and no
// database, so it can be tested exhaustively — which matters more here than
// anywhere else in the codebase, because a wrong answer moves real money out
// of the platform and there is no undo once a bank accepts a transfer.
//
// DESIGN STANCE
// Automation here is a convenience for the boring majority of payouts, not a
// replacement for judgement on the unusual ones. Everything below is built to
// fail toward "leave it for a human": every limit skips rather than truncates,
// anything unrecognised is skipped, and the whole thing is off until somebody
// deliberately turns it on.

export interface AutoPayoutConfig {
  enabled: boolean;
  /** Largest single batch the runner will send. Above this, a human does it. */
  maxPerPayout: number;
  /** Total the runner may send in one run. */
  maxPerRun: number;
  /** Total the runner may send in a rolling 24 hours, across all runs. */
  dailyCap: number;
  /** Below this, wait — a 40 sen transfer costs more in fees than it moves. */
  minAmount: number;
  /** Hold anything from a seller with an unresolved report against them. */
  skipReportedSellers: boolean;
  /** Batches must have been queued this long, giving a human time to object. */
  minQueuedAgeMinutes: number;
}

export const DEFAULT_AUTO_PAYOUT: AutoPayoutConfig = {
  // Off. Turning this on is a decision someone has to make on purpose.
  enabled: false,
  maxPerPayout: 500,
  maxPerRun: 2000,
  dailyCap: 5000,
  minAmount: 10,
  skipReportedSellers: true,
  minQueuedAgeMinutes: 60,
};

export interface CandidateBatch {
  id: string;
  sellerUid: string;
  amount: number;
  status: string;
  autoPayoutSupported?: boolean;
  requestedAt?: number;
  /** Set by a previous failed run. */
  autoAttempts?: number;
}

export type SkipReason =
  | "not_queued"
  | "manual_bank"
  | "below_minimum"
  | "over_per_payout_cap"
  | "over_run_cap"
  | "over_daily_cap"
  | "too_fresh"
  | "seller_reported"
  | "repeated_failure";

export const SKIP_LABELS: Record<SkipReason, string> = {
  not_queued: "Not waiting in the queue",
  manual_bank: "Bank needs a manual transfer",
  below_minimum: "Below the minimum amount",
  over_per_payout_cap: "Larger than the per-payout limit",
  over_run_cap: "Would exceed this run's limit",
  over_daily_cap: "Would exceed the daily limit",
  too_fresh: "Queued too recently",
  seller_reported: "Seller has an unresolved report",
  repeated_failure: "Failed automatically too many times",
};

/** After this many automatic failures a batch is left to a person. */
export const MAX_AUTO_ATTEMPTS = 2;

export interface AutoPayoutDecision {
  approved: CandidateBatch[];
  skipped: { batch: CandidateBatch; reason: SkipReason }[];
  totalApproved: number;
}

/**
 * Decide what to send.
 *
 * Batches are considered oldest-first so a queue under a cap drains fairly
 * rather than always paying whichever seller happens to sort first.
 *
 * A batch over a cap is SKIPPED, never part-paid: payouts are settlements of
 * specific orders, and sending half would leave the orders in a state no part
 * of the system models.
 */
export const decideAutoPayouts = (
  candidates: CandidateBatch[],
  config: AutoPayoutConfig,
  context: {
    spentLast24h: number;
    reportedSellerUids?: Set<string>;
    now?: number;
  },
): AutoPayoutDecision => {
  const now = context.now ?? Date.now();
  const reported = context.reportedSellerUids ?? new Set<string>();

  const approved: CandidateBatch[] = [];
  const skipped: { batch: CandidateBatch; reason: SkipReason }[] = [];
  let runTotal = 0;

  const ordered = [...candidates].sort(
    (a, b) => (a.requestedAt ?? 0) - (b.requestedAt ?? 0),
  );

  for (const b of ordered) {
    const skip = (reason: SkipReason) => skipped.push({ batch: b, reason });

    if (b.status !== "queued") {
      skip("not_queued");
      continue;
    }
    if (!b.autoPayoutSupported) {
      skip("manual_bank");
      continue;
    }
    if ((b.autoAttempts ?? 0) >= MAX_AUTO_ATTEMPTS) {
      skip("repeated_failure");
      continue;
    }
    if (b.amount < config.minAmount) {
      skip("below_minimum");
      continue;
    }
    if (b.amount > config.maxPerPayout) {
      skip("over_per_payout_cap");
      continue;
    }
    if (
      config.minQueuedAgeMinutes > 0 &&
      now - (b.requestedAt ?? 0) < config.minQueuedAgeMinutes * 60_000
    ) {
      skip("too_fresh");
      continue;
    }
    if (config.skipReportedSellers && reported.has(b.sellerUid)) {
      skip("seller_reported");
      continue;
    }
    // Caps are checked last so a batch blocked by a cap reports the cap, not
    // some earlier rule it also happened to fail.
    if (runTotal + b.amount > config.maxPerRun) {
      skip("over_run_cap");
      continue;
    }
    if (context.spentLast24h + runTotal + b.amount > config.dailyCap) {
      skip("over_daily_cap");
      continue;
    }

    approved.push(b);
    runTotal += b.amount;
  }

  return { approved, skipped, totalApproved: Math.round(runTotal * 100) / 100 };
};

/** Reject a settings object that would let the runner do something silly. */
export const configProblem = (c: AutoPayoutConfig): string | null => {
  if (c.maxPerPayout <= 0 || c.maxPerRun <= 0 || c.dailyCap <= 0) {
    return "Limits must be greater than zero.";
  }
  if (c.minAmount < 0) return "The minimum amount can't be negative.";
  if (c.maxPerPayout > c.maxPerRun) {
    return "The per-payout limit can't be higher than the per-run limit.";
  }
  if (c.maxPerRun > c.dailyCap) {
    return "The per-run limit can't be higher than the daily limit.";
  }
  if (c.minAmount > c.maxPerPayout) {
    return "The minimum amount is above the per-payout limit, so nothing would ever send.";
  }
  if (c.minQueuedAgeMinutes < 0) return "The queue delay can't be negative.";
  return null;
};
