// Pure rules for scripts/clear-firebase-test-data.mjs, kept apart so what may
// and may not be deleted can be tested without Firebase.
//
// kai, 2026-11-25: "a workflow to clear firebase entries? dont clear user data".
// So the script deletes test and transactional data and never touches
// accounts. Every collection is named here on purpose: a name that is in
// neither list is refused, so a collection added later is never swept by a
// script written before it existed.

/**
 * Firestore collections that may be cleared, with what each holds. Deleting a
 * collection also deletes every subcollection under its documents (for
 * example conversations/{id}/messages).
 */
export const CLEARABLE = {
  cards: "seller listings (NOT the card catalogue, which is in Supabase)",
  inventory: "seller stock items behind listings",
  auctions: "auctions; also clears the Realtime Database auction nodes",
  auctionOutbid: "outbid-email dedupe records",
  compiledOrders: "orders (server-written copies; the Turso ledger is not touched)",
  orders: "legacy orders",
  payouts: "seller payouts",
  refunds: "refunds",
  orderProblems: "reported order problems",
  autoPayoutRuns: "auto-payout run history",
  posSales: "counter (POS) sales",
  conversations: "chats, with their messages",
  userStats: "chat reply-time stats (rebuilt as people chat)",
  notifications: "in-app notifications",
  reports: "listing and member reports",
  enquiries: "contact-form enquiries",
  webhookEvents: "Billplz webhook replay guard",
  stripeEvents: "Stripe webhook replay guard",
  authCodes: "one-time sign-in codes",
  scanUsage: "card-scan quota counters (clearing resets everyone's scans)",
  actionLogs: "admin action log",
  errorLogs: "server error log",
  staffSessions: "admin sign-in sessions (clearing signs staff out, accounts stay)",
};

/**
 * Never deleted, whatever the input says. People's accounts and what they
 * keep for themselves, plus the admin area and site content.
 */
export const PROTECTED = {
  users: "profiles, with private details, addresses, bank details and consents",
  accountSecurity: "account lock and sign-in security state",
  userCollection: "each member's own card collection",
  favourites: "each member's saved listings",
  staff: "admin accounts (deleting them locks Mint Condition for good)",
  staffRoles: "admin roles",
  staffCounters: "admin id counters",
  settings: "site settings",
  banners: "shop banners",
  microsites: "microsite articles",
};

/** Realtime Database nodes cleared together with Firestore `auctions`. */
export const RTDB_AUCTION_PATHS = [
  "auction_summaries",
  "auction_bids",
  "auction_private",
  "user_bid_index",
];

/** Suggested list for the workflow: everything clearable except the logs and staff sessions. */
export const DEFAULT_SELECTION = Object.keys(CLEARABLE).filter(
  (n) => !["actionLogs", "errorLogs", "staffSessions", "scanUsage"].includes(n),
);

/** Typed by hand in the workflow before anything is deleted. */
export const CONFIRM_PHRASE = "DELETE TEST DATA";

/**
 * Turn the workflow's comma or space separated input into a checked list.
 * Returns { collections, refused, unknown }; the run must stop if either of
 * the last two is non-empty.
 */
export const parseSelection = (input) => {
  const names = [...new Set(String(input ?? "").split(/[\s,]+/).filter(Boolean))];
  const collections = [];
  const refused = [];
  const unknown = [];
  for (const name of names) {
    if (Object.hasOwn(PROTECTED, name)) refused.push(name);
    else if (Object.hasOwn(CLEARABLE, name)) collections.push(name);
    else unknown.push(name);
  }
  return { collections, refused, unknown };
};

/**
 * Whether a delete run may go ahead. Dry runs always may. A delete needs the
 * exact phrase and the project id typed by hand, matching the key's project,
 * so a key for the wrong project can't be used by mistake.
 * Returns a list of reasons it may not (empty means go).
 */
export const deleteBlockers = ({ mode, confirm, typedProject, keyProject, ref }) => {
  if (mode !== "delete") return [];
  const out = [];
  if (String(confirm ?? "").trim() !== CONFIRM_PHRASE) {
    out.push(`Type "${CONFIRM_PHRASE}" in the confirm box to delete.`);
  }
  if (!keyProject) out.push("The service account key has no project_id.");
  else if (String(typedProject ?? "").trim() !== keyProject) {
    out.push(`The project typed ("${typedProject ?? ""}") is not the key's project. Type it exactly.`);
  }
  // A delete runs only the reviewed script on staging, never a branch's copy.
  if (ref !== undefined && ref !== "refs/heads/staging") {
    out.push(`Deleting runs only from staging (this run is on ${ref}). Dry runs work on any branch.`);
  }
  return out;
};

/** Pairs that leave dangling data when only one side is cleared. */
const RELATED = [
  ["compiledOrders", ["payouts", "refunds", "orderProblems"]],
  ["cards", ["inventory"]],
  ["inventory", ["cards"]],
  ["conversations", ["userStats"]],
  ["auctions", ["auctionOutbid"]],
];

/** Warnings for a selection that clears one side of a related pair. */
export const relatedWarnings = (collections) => {
  const picked = new Set(collections);
  const out = [];
  for (const [name, others] of RELATED) {
    if (!picked.has(name)) continue;
    const missing = others.filter((o) => !picked.has(o));
    if (missing.length) out.push(`${name} is cleared but ${missing.join(", ")} is kept and may point at it.`);
  }
  return out;
};

/** Plain-English hint for a Firebase permission error. */
export const permissionHint = (err, where) => {
  const text = `${err?.code ?? ""} ${err?.message ?? ""}`;
  if (!/PERMISSION_DENIED|permission|403|7 PERMISSION|Unauthorized|401/i.test(text)) return null;
  return where === "rtdb"
    ? "The service account can't read or write the Realtime Database. Give it the role Firebase Realtime Database Admin (roles/firebasedatabase.admin)."
    : "The service account can't read or delete Firestore documents. Give it the role Cloud Datastore User (roles/datastore.user); Datastore Index Admin only covers indexes.";
};
