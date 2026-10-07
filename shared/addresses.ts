// A buyer's address book.
//
// Replaces the single set of `delivery*` fields on the profile with a list,
// one of which is the default.
//
// THE FLAT FIELDS STAY, AS A MIRROR
// ─────────────────────────────────
// deliveryName, deliveryAddress1 and the rest are read by the cart, the order
// page and the onboarding gate. Rather than rewrite all of them at once —
// each a chance to break checkout — the default address is copied back into
// those fields on every write. They become a cache of "the default", the list
// is the source of truth, and anything still reading the old shape keeps
// working unchanged.
//
// toFlatFields() is what keeps that promise, and it is the only thing that
// should ever write those fields.

export interface Address {
  /** Stable id. Orders reference the address they shipped to by value, not
   *  by id, so deleting an address never rewrites history. */
  id: string;
  /** "Home", "Office" — optional, purely for the person picking. */
  label?: string;
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  postcode: string;
  city: string;
  /** State CODE, e.g. "sgr" — see shared/my-states.ts. */
  state: string;
  isDefault?: boolean;
}

/**
 * Enough addresses for a home, an office and a parent's house, and few enough
 * that the list stays a list rather than something needing search. A cap also
 * bounds the profile document, which is read on every page load.
 */
export const MAX_ADDRESSES = 8;

export const newAddressId = (): string =>
  `addr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** Everything a courier needs. line2 is optional — plenty of homes have no unit. */
export const isCompleteAddress = (a: Partial<Address> | null | undefined): boolean =>
  !!(
    a?.name?.trim() &&
    a?.phone?.trim() &&
    a?.line1?.trim() &&
    a?.postcode?.trim() &&
    a?.city?.trim() &&
    a?.state?.trim()
  );

/**
 * The address to use when nobody has picked one.
 *
 * Falls back to the first entry rather than returning null when no flag is
 * set: a list with addresses in it always has a sensible default, and a
 * checkout that says "no address" while showing three of them is worse than
 * guessing the top one.
 */
export const defaultAddress = (list: Address[] | null | undefined): Address | null => {
  if (!list?.length) return null;
  return list.find((a) => a.isDefault) ?? list[0]!;
};

/** Exactly one default, always. */
export const withDefault = (list: Address[], id: string): Address[] =>
  list.map((a) => ({ ...a, isDefault: a.id === id }));

export const upsertAddress = (list: Address[], addr: Address): Address[] => {
  const exists = list.some((a) => a.id === addr.id);
  const next = exists
    ? list.map((a) => (a.id === addr.id ? addr : a))
    : [...list, addr];
  // First address in is the default by definition — there is nothing else it
  // could be, and making someone set it would be a pointless extra tap.
  if (next.length === 1) return [{ ...next[0]!, isDefault: true }];
  return addr.isDefault ? withDefault(next, addr.id) : next;
};

/**
 * Remove one, promoting a replacement if it was the default.
 *
 * A list whose only default was just deleted would otherwise fall back to
 * "first entry" silently. Promoting explicitly means the flag on the document
 * matches what the app actually uses.
 */
export const removeAddress = (list: Address[], id: string): Address[] => {
  const next = list.filter((a) => a.id !== id);
  if (!next.length) return next;
  return next.some((a) => a.isDefault) ? next : withDefault(next, next[0]!.id);
};

/** The flat `delivery*` shape the cart and order page still read. */
export interface FlatDelivery {
  deliveryName: string;
  deliveryPhone: string;
  deliveryAddress1: string;
  deliveryAddress2: string;
  deliveryPostcode: string;
  deliveryCity: string;
  deliveryState: string;
}

export const toFlatFields = (a: Address | null | undefined): FlatDelivery => ({
  deliveryName: a?.name?.trim() ?? "",
  deliveryPhone: a?.phone?.trim() ?? "",
  deliveryAddress1: a?.line1?.trim() ?? "",
  deliveryAddress2: a?.line2?.trim() ?? "",
  deliveryPostcode: a?.postcode?.trim() ?? "",
  deliveryCity: a?.city?.trim() ?? "",
  deliveryState: a?.state?.trim() ?? "",
});

/**
 * Turn the pre-address-book profile into the first entry in the list.
 *
 * Runs once per profile, when a complete flat address exists and the list is
 * empty. Returns null when there is nothing worth migrating, so callers can
 * skip the write rather than storing a blank card.
 */
export const fromFlatFields = (p: Record<string, unknown> | null | undefined): Address | null => {
  const get = (k: string) => (typeof p?.[k] === "string" ? (p[k] as string).trim() : "");
  const candidate: Address = {
    id: newAddressId(),
    label: "Home",
    name: get("deliveryName"),
    phone: get("deliveryPhone"),
    line1: get("deliveryAddress1"),
    line2: get("deliveryAddress2"),
    postcode: get("deliveryPostcode"),
    city: get("deliveryCity"),
    state: get("deliveryState"),
    isDefault: true,
  };
  return isCompleteAddress(candidate) ? candidate : null;
};

/** One line, for a card or a dropdown. */
export const formatAddress = (a: Address): string =>
  [a.line1, a.line2, a.postcode, a.city].filter((s) => s && s.trim()).join(", ");
