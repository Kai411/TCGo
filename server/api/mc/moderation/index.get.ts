// What staff have taken down: hidden listings and suspended sellers, so
// either can be found again and undone. Single-field equality queries, which
// Firestore indexes on its own.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireStaff } from "~/server/utils/staff-auth";

export default defineEventHandler(async (event) => {
  await requireStaff(event, "listings.moderate");
  const db = getAdminFirestore();

  const [cards, auctions, users] = await Promise.all([
    db.collection("cards").where("hidden", "==", true).limit(300).get(),
    db.collection("auctions").where("hidden", "==", true).limit(300).get(),
    db.collection("users").where("sellingSuspended", "==", true).limit(300).get(),
  ]);

  const listing = (kind: "card" | "auction") => (d: FirebaseFirestore.QueryDocumentSnapshot) => {
    const l = d.data() as any;
    return {
      kind,
      id: d.id,
      title: l.cardName || l.title || "Untitled",
      imageUrl: l.imageUrls?.[0] || l.imageUrl || "",
      seller: l.seller || "",
      sellerUid: l.sellerUid || "",
      hiddenReason: l.hiddenReason || "",
      hiddenMessage: l.hiddenMessage || "",
      hiddenAt: l.hiddenAt || 0,
      hiddenBy: l.hiddenBy || "",
      hiddenVia: l.hiddenVia || "staff",
    };
  };

  return {
    listings: [...cards.docs.map(listing("card")), ...auctions.docs.map(listing("auction"))].sort(
      (a, b) => b.hiddenAt - a.hiddenAt,
    ),
    sellers: users.docs
      .map((d) => {
        const u = d.data() as any;
        return {
          uid: d.id,
          name: u.customName || u.displayName || d.id,
          photoURL: u.photoURL || "",
          reason: u.sellingSuspendedReason || "",
          at: u.sellingSuspendedAt || 0,
          by: u.sellingSuspendedBy || "",
        };
      })
      .sort((a, b) => b.at - a.at),
  };
});
