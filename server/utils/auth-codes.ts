// One-time codes for verifying an email address and resetting a password.
//
// A six-digit code is a credential. It is short, it is guessable in a million
// tries, and it arrives over email — so the security here is not the code
// itself but the three limits around it:
//
//   1. It expires in 10 minutes.
//   2. It dies after 5 wrong guesses, so a million tries is never available.
//   3. It can only be re-sent 3 times in 15 minutes, so an attacker cannot
//      spin the wheel by requesting fresh codes, and nobody can be mail-bombed
//      by someone typing their address into the reset form.
//
// Stored as an HMAC, never in the clear. A six-digit space is small enough to
// reverse from a plain hash in seconds, so the digest is keyed with a server
// secret: a leaked Firestore export alone does not yield working codes.
//
// ENUMERATION: callers must respond identically whether or not the address
// belongs to an account. Nothing in this file reveals it, and the routes are
// written so the reply is the same either way — "if that address is
// registered, a code is on its way".

import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";

export type CodePurpose = "verify_email" | "reset_password";

export const CODE_TTL_MS = 10 * 60 * 1000;
export const MAX_ATTEMPTS = 5;
export const RESEND_WINDOW_MS = 15 * 60 * 1000;
export const MAX_SENDS_PER_WINDOW = 3;

/** Codes live in their own collection, never on the user document. */
const COLLECTION = "authCodes";

/** Same address, different case, is the same person. */
export const normaliseEmail = (email: string): string => email.trim().toLowerCase();

const docId = (purpose: CodePurpose, email: string): string =>
  `${purpose}__${Buffer.from(normaliseEmail(email)).toString("base64url")}`;

/**
 * The key the code digests are made with.
 *
 * Prefers an explicit secret so it can be rotated on its own. Falls back to
 * the Firebase service account, which is always present and never leaves the
 * server — that way codes are keyed out of the box rather than the fallback
 * being "no key at all", which is the version of this that quietly ships
 * unsalted hashes.
 */
const codeKey = (): string => {
  const config = useRuntimeConfig();
  const explicit = (config.authCodeSecret as string) || "";
  if (explicit) return explicit;
  const sa = (config.firebaseServiceAccount as string) || "";
  if (sa) return sa;
  throw new Error("No secret available to key auth codes");
};

const digest = (code: string, purpose: CodePurpose, email: string): string =>
  createHmac("sha256", codeKey())
    .update(`${purpose}:${normaliseEmail(email)}:${code}`)
    .digest("hex");

/** Six digits, uniformly distributed. Math.random() is not acceptable here. */
const newCode = (): string => String(randomInt(0, 1_000_000)).padStart(6, "0");

const equal = (a: string, b: string): boolean => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  // timingSafeEqual throws on length mismatch, which is itself a leak; compare
  // lengths first and always run the comparison on equal-length buffers.
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
};

export interface IssuedCode {
  code: string;
  expiresAt: number;
}

export class RateLimited extends Error {
  constructor(public retryAfterMs: number) {
    super("Too many codes requested. Try again shortly.");
  }
}

/**
 * Mint a code, replacing any outstanding one for the same purpose.
 *
 * Replacing rather than adding matters: two live codes double an attacker's
 * chances and let a stale email keep working after the user asked for a new
 * one.
 *
 * @throws RateLimited when the send window is exhausted
 */
export const issueCode = async (
  db: Firestore,
  purpose: CodePurpose,
  email: string,
): Promise<IssuedCode> => {
  const ref = db.collection(COLLECTION).doc(docId(purpose, email));
  const now = Date.now();

  const snap = await ref.get();
  const prev = snap.exists ? (snap.data() as any) : null;

  // Send throttle. The window slides only when it has fully elapsed, so three
  // sends in a minute still blocks the fourth for the rest of the window.
  let sentCount = 0;
  let windowStartedAt = now;
  if (prev && now - (prev.windowStartedAt ?? 0) < RESEND_WINDOW_MS) {
    sentCount = prev.sentCount ?? 0;
    windowStartedAt = prev.windowStartedAt ?? now;
    if (sentCount >= MAX_SENDS_PER_WINDOW) {
      throw new RateLimited(windowStartedAt + RESEND_WINDOW_MS - now);
    }
  }

  const code = newCode();
  const expiresAt = now + CODE_TTL_MS;

  await ref.set({
    purpose,
    email: normaliseEmail(email),
    hash: digest(code, purpose, email),
    expiresAt,
    // Attempts reset with each new code — the cap is per code, not per
    // address, or one wrong guess would lock someone out permanently.
    attempts: 0,
    sentCount: sentCount + 1,
    windowStartedAt,
    createdAt: now,
  });

  return { code, expiresAt };
};

export type ConsumeResult =
  | { ok: true }
  | { ok: false; reason: "expired" | "invalid" | "exhausted" | "none" };

/**
 * Check a code and burn it.
 *
 * Success deletes the document, so a code works exactly once. Failure
 * increments the attempt count and, at the cap, deletes it too — a code that
 * has been guessed at five times is not one to keep alive.
 */
export const consumeCode = async (
  db: Firestore,
  purpose: CodePurpose,
  email: string,
  code: string,
): Promise<ConsumeResult> => {
  const ref = db.collection(COLLECTION).doc(docId(purpose, email));

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { ok: false, reason: "none" } as const;
    const data = snap.data() as any;

    if (Date.now() > (data.expiresAt ?? 0)) {
      tx.delete(ref);
      return { ok: false, reason: "expired" } as const;
    }

    const attempts = (data.attempts ?? 0) + 1;
    if (attempts > MAX_ATTEMPTS) {
      tx.delete(ref);
      return { ok: false, reason: "exhausted" } as const;
    }

    if (!equal(data.hash ?? "", digest(code, purpose, email))) {
      // Count the miss before returning, or the cap never bites.
      if (attempts >= MAX_ATTEMPTS) tx.delete(ref);
      else tx.update(ref, { attempts });
      return { ok: false, reason: "invalid" } as const;
    }

    tx.delete(ref);
    return { ok: true } as const;
  });
};

/** How long a code is good for, in words a person can act on. */
export const ttlMinutes = (): number => Math.round(CODE_TTL_MS / 60000);
