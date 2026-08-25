// Server-side identity for routes that move money or mutate other people's
// documents. The client sends its Firebase ID token as `Authorization: Bearer
// <token>`; we verify it with the Admin SDK.
//
// Use `useAuthedFetch()` on the client — it attaches the header for you.

import type { H3Event } from "h3";
import { getAdminAuth } from "~/server/utils/firebase-admin";
import { isAdminUid } from "~/shared/admins";

export interface AuthedUser {
  uid: string;
  email?: string;
  name?: string;
}

export const requireUser = async (event: H3Event): Promise<AuthedUser> => {
  const header = getHeader(event, "authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) {
    throw createError({ statusCode: 401, message: "Sign in required" });
  }
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email, name: decoded.name };
  } catch {
    throw createError({ statusCode: 401, message: "Invalid or expired session" });
  }
};

export const requireAdmin = async (event: H3Event): Promise<AuthedUser> => {
  const user = await requireUser(event);
  if (!isAdminUid(user.uid)) {
    throw createError({ statusCode: 403, message: "Admin only" });
  }
  return user;
};
