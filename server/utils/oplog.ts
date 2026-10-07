// Writing to the operations log.
//
// The hard rule here: logging must never break the thing it's logging. Every
// write is fire-and-forget with its own catch, because a Firestore hiccup
// while recording "the payout failed" must not also take down the handler
// that was trying to recover from it. A lost log line is a bad day; a payout
// route that 500s because logging threw is a much worse one.

import type { H3Event } from "h3";
import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { sanitiseContext } from "~/shared/oplog";
import type { LogArea, LogSeverity } from "~/shared/oplog";
import type { StaffPrincipal } from "~/server/utils/staff-auth";

/** Keep the collections bounded — nobody reads a two-year-old quote failure. */
export const ERROR_LOG_TTL_DAYS = 90;
export const ACTION_LOG_TTL_DAYS = 365;

export interface LogErrorInput {
  area: LogArea;
  code: string;
  message: string;
  severity?: LogSeverity;
  context?: Record<string, unknown>;
  hint?: string;
  orderId?: string | null;
  userUid?: string | null;
  payoutId?: string | null;
  error?: unknown;
}

/**
 * Record a platform failure.
 *
 * Deliberately not awaited by callers in most cases — see the file header.
 * Still returns the promise so a test (or a route that genuinely needs the
 * write to land before responding) can wait on it.
 */
export const logError = async (input: LogErrorInput): Promise<void> => {
  try {
    const err = input.error as any;
    const context = sanitiseContext({
      ...(input.context || {}),
      ...(err
        ? {
            errorName: err?.name,
            errorMessage: typeof err?.message === "string" ? err.message : undefined,
            statusCode: err?.statusCode ?? err?.status,
          }
        : {}),
    });

    const doc: Record<string, unknown> = {
      at: Date.now(),
      area: input.area,
      severity: input.severity || "error",
      code: input.code,
      message: input.message.slice(0, 1000),
      resolvedAt: null,
      resolvedBy: null,
      expiresAt: Date.now() + ERROR_LOG_TTL_DAYS * 86_400_000,
    };
    if (context) doc.context = context;
    if (input.hint) doc.hint = input.hint;
    if (input.orderId) doc.orderId = input.orderId;
    if (input.userUid) doc.userUid = input.userUid;
    if (input.payoutId) doc.payoutId = input.payoutId;

    await getAdminFirestore().collection("errorLogs").add(doc);
  } catch (e) {
    // Last resort: the platform log. Never rethrow.
    console.error("[oplog] failed to record error", input.code, e);
  }
};

export interface LogActionInput {
  area: LogArea;
  action: string;
  summary: string;
  actor: StaffPrincipal | { staffId: string; name?: string } | string;
  subject?: string | null;
  detail?: Record<string, unknown>;
  event?: H3Event;
}

const actorOf = (a: LogActionInput["actor"]) =>
  typeof a === "string"
    ? { actor: a, actorName: null as string | null }
    : { actor: a.staffId, actorName: (a as any).name ?? null };

/** Record a deliberate act by a person. */
export const logAction = async (input: LogActionInput): Promise<void> => {
  try {
    const { actor, actorName } = actorOf(input.actor);
    const detail = sanitiseContext(input.detail || {});
    const doc: Record<string, unknown> = {
      at: Date.now(),
      area: input.area,
      action: input.action,
      actor,
      actorName,
      summary: input.summary.slice(0, 500),
      subject: input.subject ?? null,
      ip: input.event
        ? (getRequestIP(input.event, { xForwardedFor: true }) ?? null)
        : null,
      expiresAt: Date.now() + ACTION_LOG_TTL_DAYS * 86_400_000,
    };
    if (detail) doc.detail = detail;
    await getAdminFirestore().collection("actionLogs").add(doc);
  } catch (e) {
    console.error("[oplog] failed to record action", input.action, e);
  }
};

/**
 * Fire-and-forget wrappers.
 *
 * Using these makes the non-blocking intent explicit at the call site, rather
 * than relying on everyone remembering not to await. The floating promise is
 * safe: both functions above swallow their own failures.
 */
export const noteError = (input: LogErrorInput): void => {
  void logError(input);
};

export const noteAction = (input: LogActionInput): void => {
  void logAction(input);
};
