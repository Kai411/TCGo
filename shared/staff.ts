// Mint Condition staff accounts — the permission model.
//
// WHY THIS IS SEPARATE FROM MARKETPLACE AUTH
// A marketplace account is a person who buys and sells cards. A staff account
// is a job: someone who can see other people's bank details, approve reports,
// and move real money out of the platform. Those are different things with
// different lifecycles — staff leave, roles change, and access must be
// revocable in a way a self-service signup never is. Sharing one identity
// system would mean a staff member's access rides on a consumer account they
// own, can change the email of, and can reset the password of by themselves.
//
// So: staff sign in with an issued ID (A0001) and a password set by an admin,
// against a credential store the marketplace never touches.

/** Every capability the operations console gates on. */
export interface PermissionDef {
  key: string;
  group: string;
  label: string;
  description: string;
  /** Irreversible, or exposes other people's personal data. Flagged in the UI. */
  dangerous?: boolean;
}

export const PERMISSIONS: PermissionDef[] = [
  {
    key: "overview.view",
    group: "Dashboard",
    label: "View dashboard",
    description: "Order counts, activity and the operations overview.",
  },
  {
    key: "finance.view",
    group: "Dashboard",
    label: "View finances",
    description: "Revenue, costs, profit, float projections and the tax position.",
  },
  {
    key: "payouts.view",
    group: "Payouts",
    label: "View payouts",
    description:
      "The payout queue, including sellers' bank account numbers and account holder names.",
    dangerous: true,
  },
  {
    key: "payouts.execute",
    group: "Payouts",
    label: "Send payouts",
    description:
      "Transfer money to a seller's bank account through Billplz. Cannot be undone once the bank accepts it.",
    dangerous: true,
  },
  {
    key: "payouts.manual",
    group: "Payouts",
    label: "Record manual transfers",
    description:
      "Mark a payout as paid by hand, for banks Billplz can't reach. Marks money as sent without sending it.",
    dangerous: true,
  },
  {
    key: "payouts.automate",
    group: "Payouts",
    label: "Configure auto-payout",
    description:
      "Turn automatic payouts on or off and change their limits. Not the same as sending one.",
    dangerous: true,
  },
  {
    key: "reports.view",
    group: "Moderation",
    label: "View reports",
    description: "Buyer and seller reports awaiting review.",
  },
  {
    key: "reports.resolve",
    group: "Moderation",
    label: "Resolve reports",
    description: "Uphold a report and apply a trust penalty, or dismiss it.",
  },
  {
    key: "identity.view",
    group: "Moderation",
    label: "View verified identities",
    description:
      "The real name on a seller's ID document and their verification history. Personal data — grant only where the job needs it.",
    dangerous: true,
  },
  {
    key: "logs.view",
    group: "Operations",
    label: "View logs",
    description: "Payment, payout and shipping failures, plus the staff action trail.",
  },
  {
    key: "staff.view",
    group: "Staff",
    label: "View staff",
    description: "The list of staff accounts and their roles.",
  },
  {
    key: "staff.manage",
    group: "Staff",
    label: "Manage staff",
    description:
      "Create accounts, reset passwords, change someone's role, and deactivate accounts.",
    dangerous: true,
  },
  {
    key: "roles.manage",
    group: "Staff",
    label: "Manage roles",
    description:
      "Create roles and change which permissions each one carries. Effectively grants every permission, since a role can be given any of them.",
    dangerous: true,
  },
];

export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

export const PERMISSION_GROUPS = PERMISSIONS.reduce<Record<string, PermissionDef[]>>(
  (acc, p) => {
    (acc[p.group] ||= []).push(p);
    return acc;
  },
  {},
);

/**
 * Wildcard for the built-in admin role.
 *
 * Stored rather than expanded so a permission added in a later release is
 * covered automatically — an admin who silently stops being able to use a new
 * feature is a worse failure than one who can use all of them.
 */
export const ALL_PERMISSIONS = "*";

export const hasPermission = (
  granted: readonly string[] | undefined | null,
  needed: string,
): boolean =>
  !!granted && (granted.includes(ALL_PERMISSIONS) || granted.includes(needed));

// ── Staff IDs ────────────────────────────────────────────────────────────
//
// A0001, AC001, ST001 — the prefix names the role and the whole ID is always
// five characters, so the digits shrink as the prefix grows. Fixed width keeps
// them readable in a log line and sortable as plain strings.

export const STAFF_ID_LENGTH = 5;

export interface RoleDef {
  id: string;
  name: string;
  /** Letters that begin every ID issued under this role. */
  prefix: string;
  description: string;
  permissions: string[];
  /** Built-in roles can be re-permissioned but never deleted. */
  builtin: true;
}

export const BUILTIN_ROLES: RoleDef[] = [
  {
    id: "admin",
    name: "Admin",
    prefix: "A",
    description: "Full access, including sending money and managing staff.",
    permissions: [ALL_PERMISSIONS],
    builtin: true,
  },
  {
    id: "accounting",
    name: "Accounting",
    prefix: "AC",
    description:
      "Sees the money and reconciles it. Can record transfers made by hand, but sending an automated payout is deliberately left to an admin.",
    permissions: [
      "overview.view",
      "finance.view",
      "payouts.view",
      "payouts.manual",
      "logs.view",
    ],
    builtin: true,
  },
  {
    id: "staff",
    name: "Staff",
    prefix: "ST",
    description:
      "Day-to-day support and moderation. No access to bank details or identity documents until an admin grants it.",
    permissions: ["overview.view", "reports.view", "reports.resolve", "logs.view"],
    builtin: true,
  },
];

export const BUILTIN_ROLE_IDS = BUILTIN_ROLES.map((r) => r.id);

/** Prefixes reserved by built-in roles, so a custom role can't collide. */
export const RESERVED_PREFIXES = BUILTIN_ROLES.map((r) => r.prefix);

export const isValidPrefix = (prefix: string): boolean =>
  /^[A-Z]{1,3}$/.test(prefix);

/**
 * Build the nth ID for a prefix: ("A", 1) → "A0001", ("AC", 1) → "AC001".
 *
 * Past the width the sequence keeps growing rather than wrapping — an ugly
 * six-character ID is a far smaller problem than two people sharing one.
 */
export const formatStaffId = (prefix: string, seq: number): string =>
  `${prefix}${String(seq).padStart(Math.max(1, STAFF_ID_LENGTH - prefix.length), "0")}`;

/** Normalise what someone typed into the login box. */
export const normaliseStaffId = (raw: string): string =>
  raw.trim().toUpperCase().replace(/\s+/g, "");

export const isValidStaffId = (id: string): boolean =>
  /^[A-Z]{1,3}[0-9]{2,6}$/.test(id);

export const prefixOf = (staffId: string): string =>
  (staffId.match(/^[A-Z]{1,3}/) || [""])[0];

// ── Passwords ────────────────────────────────────────────────────────────
//
// Length over composition rules: "at least one symbol" pushes people toward
// Password1! and a longer passphrase beats it comfortably. These accounts can
// move money, so the floor is higher than a consumer signup's would be.

export const MIN_PASSWORD_LENGTH = 12;

export const passwordProblem = (
  password: string,
  staffId?: string,
): string | null => {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password.length > 200) return "That's too long.";
  if (staffId && password.toUpperCase().includes(staffId.toUpperCase())) {
    return "Don't put the staff ID in the password.";
  }
  if (/^(.)\1+$/.test(password)) return "Use something less repetitive.";
  return null;
};

// ── Session policy ───────────────────────────────────────────────────────

export const STAFF_SESSION_COOKIE = "mc_session";
export const STAFF_SESSION_TTL_MS = 12 * 60 * 60 * 1000; // one working day
/** Failed sign-ins before the account stops accepting attempts. */
export const LOGIN_MAX_ATTEMPTS = 5;
export const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;

// ── Effective permissions ────────────────────────────────────────────────

/**
 * Permissions actually in force for a staff member.
 *
 * Role first, then per-person adjustments. Denies are applied last and beat
 * everything including the admin wildcard, so "this one person must not touch
 * payouts" is expressible without inventing a whole role for them.
 */
export const effectivePermissions = (
  role: { permissions?: string[] } | null,
  staff: { extraPermissions?: string[]; deniedPermissions?: string[] },
): string[] => {
  const denied = new Set(staff.deniedPermissions ?? []);
  const base = new Set(role?.permissions ?? []);
  for (const p of staff.extraPermissions ?? []) base.add(p);

  if (!denied.size) return [...base];

  // A denial has to survive the wildcard, or it silently does nothing on an
  // admin — the exact account where it matters most. Expanding the wildcard
  // costs us the "new permissions are granted automatically" property, but
  // only for the people who have an explicit denial, which is the right
  // trade: an exception should fail closed.
  if (base.has(ALL_PERMISSIONS)) {
    base.delete(ALL_PERMISSIONS);
    for (const k of PERMISSION_KEYS) base.add(k);
  }
  for (const p of denied) base.delete(p);
  return [...base];
};
