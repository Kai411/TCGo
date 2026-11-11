// The monthly scan allowance, decided on the server.
//
// Every scan is a paid Gemini call, so /api/identify-card counts each one
// before it calls out. The count lives in scanUsage/{uid}, which only the
// Admin SDK can write (no client rule matches it). The user's own profile
// keeps copies of the numbers for the "8/20 this month" display, but those are
// client-writable and never trusted here.
//
// Allowance: FREE_SCAN_LIMIT a month, plus BONUS_SCANS once for anyone who has
// claimed the bonus. Pro is unlimited. Bonus scans are spent first, as before.

export const FREE_SCAN_LIMIT = 20;
export const BONUS_SCANS = 5;

/** What scanUsage/{uid} holds. */
export interface ScanUsage {
  /** Monthly scans used since the last reset. */
  used: number;
  /** When `used` next goes back to 0 (ms). */
  resetAt: number;
  /** Bonus scans spent, out of BONUS_SCANS, ever. */
  bonusUsed: number;
}

/** The trusted and untrusted profile fields the decision reads. */
export interface ScanProfile {
  /** Written only by the Stripe webhook. */
  tier?: string;
  /** The one-time bonus has been claimed. */
  bonusScansClaimedAt?: number;
  // Legacy client-kept counters, used only to start a user's server record
  // so the switch-over doesn't hand everyone a fresh 20.
  scansUsed?: number;
  scansResetAt?: number;
  bonusScansRemaining?: number;
}

export type ScanSpend = "pro" | "bonus" | "monthly";

export interface ScanDecision {
  allowed: boolean;
  /** Which allowance paid for it, for a refund if the scan then fails. */
  spent: ScanSpend | null;
  usage: ScanUsage;
  /** Display copies written back to the profile. */
  mirror: { scansUsed: number; scansResetAt: number; bonusScansRemaining: number };
}

/** First of next month, Malaysia time (UTC+8), as ms. */
export const nextMonthStart = (now: number): number => {
  const MYT = 8 * 3_600_000;
  const local = new Date(now + MYT);
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 1) - MYT;
};

/** The stored record, or one started from the legacy profile counters. */
export const startingUsage = (
  stored: Partial<ScanUsage> | undefined,
  profile: ScanProfile,
  now: number,
): ScanUsage => {
  const usage: ScanUsage = stored && typeof stored.resetAt === "number"
    ? {
        used: Math.max(0, Number(stored.used ?? 0)),
        resetAt: stored.resetAt,
        bonusUsed: Math.max(0, Number(stored.bonusUsed ?? 0)),
      }
    : {
        used: Math.max(0, Math.min(FREE_SCAN_LIMIT, Number(profile.scansUsed ?? 0))),
        resetAt: Number(profile.scansResetAt) || nextMonthStart(now),
        bonusUsed: profile.bonusScansClaimedAt
          ? BONUS_SCANS - Math.max(0, Math.min(BONUS_SCANS, Number(profile.bonusScansRemaining ?? BONUS_SCANS)))
          : 0,
      };
  if (now >= usage.resetAt) {
    usage.used = 0;
    usage.resetAt = nextMonthStart(now);
  }
  return usage;
};

const mirrorOf = (u: ScanUsage, profile: ScanProfile): ScanDecision["mirror"] => ({
  scansUsed: u.used,
  scansResetAt: u.resetAt,
  bonusScansRemaining: profile.bonusScansClaimedAt ? Math.max(0, BONUS_SCANS - u.bonusUsed) : 0,
});

/** Spend one scan if the allowance has one. */
export const spendScan = (
  stored: Partial<ScanUsage> | undefined,
  profile: ScanProfile,
  now: number,
): ScanDecision => {
  const usage = startingUsage(stored, profile, now);
  let spent: ScanSpend | null = null;
  if (profile.tier === "premium") spent = "pro";
  else if (profile.bonusScansClaimedAt && usage.bonusUsed < BONUS_SCANS) {
    usage.bonusUsed++;
    spent = "bonus";
  } else if (usage.used < FREE_SCAN_LIMIT) {
    usage.used++;
    spent = "monthly";
  }
  return { allowed: spent !== null, spent, usage, mirror: mirrorOf(usage, profile) };
};

/** Give back a scan that failed before it read anything. */
export const refundScan = (
  usage: ScanUsage,
  spent: ScanSpend | null,
  profile: ScanProfile,
): Pick<ScanDecision, "usage" | "mirror"> => {
  const next = { ...usage };
  if (spent === "bonus") next.bonusUsed = Math.max(0, next.bonusUsed - 1);
  if (spent === "monthly") next.used = Math.max(0, next.used - 1);
  return { usage: next, mirror: mirrorOf(next, profile) };
};
