// Read a user's whole profile on the server: the public document plus the
// private one that holds their IC, bank, contact and address fields.
//
// Use this instead of reading users/{uid} directly whenever the code needs
// any field listed in shared/private-profile.ts. Reading only the public
// document returns those fields as missing once a profile has been migrated.

import type { Firestore } from "firebase-admin/firestore";
import { mergeProfile, PRIVATE_PROFILE_DOC } from "~/shared/private-profile";

export const privateProfileRef = (db: Firestore, uid: string) =>
  db.collection("users").doc(uid).collection("private").doc(PRIVATE_PROFILE_DOC);

export const getUserProfile = async (
  db: Firestore,
  uid: string,
): Promise<Record<string, any> | null> => {
  const [pub, priv] = await Promise.all([
    db.collection("users").doc(uid).get(),
    privateProfileRef(db, uid).get(),
  ]);
  return mergeProfile(
    pub.exists ? (pub.data() as Record<string, any>) : null,
    priv.exists ? (priv.data() as Record<string, any>) : null,
  );
};
