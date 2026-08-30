// Finding the parcel a new order should join.
//
// Server-side because it decides whether a buyer is charged shipping, and
// that is not a decision the browser gets to make.

import type { Firestore } from "firebase-admin/firestore";
import { isOpenParcel } from "~/shared/order-joining";

/** Same shape the cart sends, and the same fields addressKey compares. */
export interface Destination {
  postcode?: string;
  city?: string;
  state?: string;
  address1?: string;
}

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();

/**
 * Destination identity. Deliberately narrow: postcode plus the first address
 * line. Comparing whole formatted addresses means "No.555, Jln Cheras" and
 * "No. 555 Jalan Cheras" look like different places and the buyer gets billed
 * twice, which is the exact failure this feature exists to prevent.
 */
const destKey = (d: Destination): string =>
  `${norm(d.postcode)}|${norm(d.address1).replace(/[.,\s]+/g, " ")}`;

export const findOpenParcelFor = async (
  db: Firestore,
  input: { buyerUid: string; sellerUid: string; destination: Destination },
): Promise<{ id: string; [k: string]: any } | null> => {
  // Single-field query, then filter — no composite index needed, and a buyer
  // never has enough live orders for this to be worth one.
  const snap = await db
    .collection("compiledOrders")
    .where("buyerUid", "==", input.buyerUid)
    .get();

  const wanted = destKey(input.destination);
  const open = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) }))
    .filter((o) => o.sellerUid === input.sellerUid)
    .filter(isOpenParcel)
    .filter((o) => destKey(o.deliveryAddress ?? {}) === wanted)
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));

  return open[0] ?? null;
};
