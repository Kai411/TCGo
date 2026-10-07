// Platform admin UIDs. Shared by the client admin gate (useAdmin) and the
// server-side gate (requireAdmin) so the two can't drift.
//
// The client copy only hides UI; the server copy is the one that actually
// protects money-moving routes.
export const ADMIN_UIDS: string[] = ["sFXZjtYD13dT2DYE7XDaTwtx4Dn1"];

export const isAdminUid = (uid: string | undefined | null): boolean =>
  !!uid && ADMIN_UIDS.includes(uid);
