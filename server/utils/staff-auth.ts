// Mint Condition staff credentials and sessions.
//
// Entirely separate from Firebase Auth by design (see shared/staff.ts). That
// means we own the parts Firebase would otherwise handle, and each one is a
// place this could go wrong:
//
//   Hashing    scrypt, memory-hard, with per-account salt. Never a bare SHA.
//   Sessions   opaque random token, stored hashed, server-side revocable.
//   Lockout    bounded attempts, so an issued ID isn't a brute-force target.
//   Timing     unknown IDs cost the same as known ones, so login can't be
//              used to enumerate who works here.

import crypto from "node:crypto";
import { promisify } from "node:util";
import type { H3Event } from "h3";
import type { Firestore } from "firebase-admin/firestore";
import { getAdminAuth, getAdminFirestore } from "~/server/utils/firebase-admin";
import { isAdminUid } from "~/shared/admins";
import {
  ALL_PERMISSIONS,
  BUILTIN_ROLES,
  LOGIN_LOCKOUT_MS,
  LOGIN_MAX_ATTEMPTS,
  STAFF_SESSION_COOKIE,
  STAFF_SESSION_TTL_MS,
  effectivePermissions,
  hasPermission,
  normaliseStaffId,
} from "~/shared/staff";

const scrypt = promisify(crypto.scrypt) as (
  pw: crypto.BinaryLike,
  salt: crypto.BinaryLike,
  keylen: number,
) => Promise<Buffer>;

const SCRYPT_KEYLEN = 32;
const SALT_BYTES = 16;

// ── Password hashing ─────────────────────────────────────────────────────

export const hashPassword = async (password: string): Promise<string> => {
  const salt = crypto.randomBytes(SALT_BYTES);
  const key = await scrypt(password, salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
};

export const verifyPassword = async (
  password: string,
  stored: string | undefined | null,
): Promise<boolean> => {
  if (!stored) return false;
  const [scheme, saltB64, keyB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !keyB64) return false;
  let expected: Buffer;
  try {
    expected = Buffer.from(keyB64, "base64");
  } catch {
    return false;
  }
  const actual = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
};

/**
 * Burn roughly one scrypt's worth of time against a throwaway hash.
 *
 * Called when the staff ID doesn't exist. Without it, a wrong ID returns in
 * microseconds and a wrong password takes ~100ms, which tells an attacker
 * exactly which IDs are real — and IDs here are guessable by construction
 * (A0001, A0002, …).
 */
export const burnPasswordTime = async (password: string): Promise<void> => {
  await scrypt(password || "x", crypto.randomBytes(SALT_BYTES), SCRYPT_KEYLEN).catch(
    () => undefined,
  );
};

// ── Roles ────────────────────────────────────────────────────────────────

export interface StoredRole {
  id: string;
  name: string;
  prefix: string;
  description?: string;
  permissions: string[];
  builtin?: boolean;
}

/**
 * Roles as stored, with the built-ins filled in.
 *
 * Built-ins aren't seeded into Firestore on install: an empty database would
 * then have no roles at all and the first admin couldn't be created. They're
 * merged in at read time, and a stored document of the same id overrides —
 * which is what makes "change what Accounting can do" work without special
 * cases.
 */
export const loadRoles = async (db: Firestore): Promise<StoredRole[]> => {
  const snap = await db.collection("staffRoles").get();
  const stored = new Map<string, StoredRole>();
  for (const d of snap.docs) stored.set(d.id, { ...(d.data() as StoredRole), id: d.id });

  const merged: StoredRole[] = BUILTIN_ROLES.map((b) => {
    const override = stored.get(b.id);
    stored.delete(b.id);
    return {
      id: b.id,
      name: b.name,
      prefix: b.prefix,
      description: b.description,
      // A built-in keeps its identity but not necessarily its permissions.
      permissions: override?.permissions ?? b.permissions,
      builtin: true,
    };
  });
  return [...merged, ...stored.values()];
};

export const loadRole = async (
  db: Firestore,
  roleId: string,
): Promise<StoredRole | null> =>
  (await loadRoles(db)).find((r) => r.id === roleId) ?? null;

// ── Principal ────────────────────────────────────────────────────────────

export interface StaffPrincipal {
  staffId: string;
  name: string;
  roleId: string;
  roleName: string;
  permissions: string[];
  /** True for the legacy Firebase admin bridge rather than a staff account. */
  legacy: boolean;
}

// ── Sessions ─────────────────────────────────────────────────────────────

const hashToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

/**
 * Issue a session and set the cookie.
 *
 * The token is opaque and stored hashed rather than signed as a JWT, because
 * these sessions must be revocable the instant someone is deactivated or has a
 * permission removed. A self-contained token stays valid until it expires, and
 * "you can still send payouts for the next twelve hours" is not an acceptable
 * property of an offboarding process.
 */
export const createSession = async (
  event: H3Event,
  db: Firestore,
  staffId: string,
): Promise<void> => {
  const token = crypto.randomBytes(32).toString("base64url");
  const now = Date.now();
  await db.collection("staffSessions").doc(hashToken(token)).set({
    staffId,
    createdAt: now,
    expiresAt: now + STAFF_SESSION_TTL_MS,
    ip: getRequestIP(event, { xForwardedFor: true }) ?? null,
    userAgent: (getHeader(event, "user-agent") || "").slice(0, 300),
  });

  setCookie(event, STAFF_SESSION_COOKIE, token, {
    httpOnly: true,
    // Lax rather than Strict: Strict would drop the cookie when an operator
    // follows a link into the console from email or chat, and they'd land on
    // the login page holding a valid session.
    sameSite: "lax",
    secure: !import.meta.dev,
    path: "/",
    maxAge: Math.floor(STAFF_SESSION_TTL_MS / 1000),
  });
};

export const destroySession = async (event: H3Event, db: Firestore): Promise<void> => {
  const token = getCookie(event, STAFF_SESSION_COOKIE);
  if (token) {
    await db
      .collection("staffSessions")
      .doc(hashToken(token))
      .delete()
      .catch(() => undefined);
  }
  deleteCookie(event, STAFF_SESSION_COOKIE, { path: "/" });
};

/** Drop every session belonging to one person — deactivation, password reset. */
export const revokeAllSessions = async (
  db: Firestore,
  staffId: string,
): Promise<number> => {
  const snap = await db.collection("staffSessions").where("staffId", "==", staffId).get();
  if (snap.empty) return 0;
  const writes = db.batch();
  for (const d of snap.docs) writes.delete(d.ref);
  await writes.commit();
  return snap.size;
};

// ── Lockout ──────────────────────────────────────────────────────────────

export const lockoutRemainingMs = (staff: { lockedUntil?: number }): number =>
  Math.max(0, (staff.lockedUntil ?? 0) - Date.now());

export const recordFailedLogin = async (
  db: Firestore,
  staffId: string,
  current: number,
): Promise<void> => {
  const attempts = current + 1;
  await db
    .collection("staff")
    .doc(staffId)
    .update({
      failedAttempts: attempts,
      ...(attempts >= LOGIN_MAX_ATTEMPTS
        ? { lockedUntil: Date.now() + LOGIN_LOCKOUT_MS }
        : {}),
    });
};

// ── The guard ────────────────────────────────────────────────────────────

/**
 * Resolve the caller, or throw.
 *
 * Two ways in, and the second one matters:
 *
 *   1. A staff session cookie.
 *   2. The legacy Firebase admin UID, with a Bearer token.
 *
 * (2) exists because otherwise this is a chicken-and-egg: with no staff
 * accounts yet, nobody could create the first one. It's also the way back in
 * if staff auth locks everyone out. It is NOT a permanent second door left
 * open by accident — every use is logged as `legacy: true`, and it can be shut
 * by emptying ADMIN_UIDS once real staff accounts exist.
 */
export const requireStaff = async (
  event: H3Event,
  ...needed: string[]
): Promise<StaffPrincipal> => {
  const db = getAdminFirestore();
  const token = getCookie(event, STAFF_SESSION_COOKIE);

  if (token) {
    // CSRF. SameSite=Lax already stops a cross-site form POST from carrying
    // the cookie, but that's one browser setting away from being the only
    // thing between another site and a payout. A custom header cannot be set
    // by a simple cross-origin request, so requiring it on state-changing
    // methods is an independent second barrier. GETs are exempt: they change
    // nothing, and the console's own links have no way to add headers.
    const method = (event.method || "GET").toUpperCase();
    if (method !== "GET" && method !== "HEAD") {
      if (getHeader(event, "x-mc-auth") !== "1") {
        throw createError({
          statusCode: 403,
          message: "Missing console request header",
        });
      }
    }

    const ref = db.collection("staffSessions").doc(hashToken(token));
    const snap = await ref.get();
    const session = snap.data() as { staffId: string; expiresAt: number } | undefined;

    if (session && session.expiresAt > Date.now()) {
      const staffSnap = await db.collection("staff").doc(session.staffId).get();
      const staff = staffSnap.data() as any;

      if (staff && staff.active !== false) {
        const role = await loadRole(db, staff.roleId);
        const permissions = effectivePermissions(role, staff);
        const principal: StaffPrincipal = {
          staffId: session.staffId,
          name: staff.name || session.staffId,
          roleId: staff.roleId,
          roleName: role?.name || staff.roleId,
          permissions,
          legacy: false,
        };
        for (const key of needed) {
          if (!hasPermission(permissions, key)) {
            throw createError({
              statusCode: 403,
              message: `Your role doesn't include "${key}".`,
            });
          }
        }
        return principal;
      }
      // Deactivated mid-session: clean the session up rather than leaving a
      // dead token that keeps costing a read on every request.
      await ref.delete().catch(() => undefined);
    } else if (snap.exists) {
      await ref.delete().catch(() => undefined);
    }
    deleteCookie(event, STAFF_SESSION_COOKIE, { path: "/" });
  }

  // Legacy bridge.
  const header = getHeader(event, "authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (bearer) {
    try {
      const decoded = await getAdminAuth().verifyIdToken(bearer);
      if (isAdminUid(decoded.uid)) {
        return {
          staffId: decoded.uid,
          name: decoded.name || decoded.email || "Platform admin",
          roleId: "admin",
          roleName: "Admin (marketplace)",
          permissions: [ALL_PERMISSIONS],
          legacy: true,
        };
      }
    } catch {
      // Fall through to 401 — an invalid token is not a different failure
      // from no token as far as the caller needs to know.
    }
  }

  throw createError({ statusCode: 401, message: "Sign in to Mint Condition" });
};

/** Non-throwing variant, for /me and for UI that renders differently when out. */
export const optionalStaff = async (
  event: H3Event,
): Promise<StaffPrincipal | null> => {
  try {
    return await requireStaff(event);
  } catch {
    return null;
  }
};

export { effectivePermissions, normaliseStaffId, hashToken };
