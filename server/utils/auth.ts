import type { H3Event } from "h3";
import type { DecodedIdToken } from "firebase-admin/auth";
import { getAdminAuth } from "~/server/utils/firebase-admin";

// Every server route that acts for a user takes the user from a verified
// Firebase ID token (Authorization: Bearer <token>), never from the request
// body. The browser attaches the token through composables/useApi.ts.
export const requireUser = async (event: H3Event): Promise<DecodedIdToken> => {
  const header = getHeader(event, "authorization") || "";
  const match = header.match(/^Bearer (.+)$/i);
  if (!match) {
    throw createError({ statusCode: 401, message: "Sign in required" });
  }
  try {
    return await getAdminAuth().verifyIdToken(match[1]);
  } catch {
    throw createError({ statusCode: 401, message: "Session expired, sign in again" });
  }
};

// Admins are named by uid in NUXT_ADMIN_UIDS (comma-separated) or carry an
// `admin: true` custom claim.
export const isAdminToken = (token: DecodedIdToken): boolean => {
  if (token.admin === true) return true;
  const list = String(useRuntimeConfig().adminUids || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list.includes(token.uid);
};

export const requireAdmin = async (event: H3Event): Promise<DecodedIdToken> => {
  const token = await requireUser(event);
  if (!isAdminToken(token)) {
    throw createError({ statusCode: 403, message: "Admins only" });
  }
  return token;
};

// The caller shape the order service expects.
export const requireCaller = async (event: H3Event) => {
  const token = await requireUser(event);
  return { token, uid: token.uid, isAdmin: isAdminToken(token) };
};
