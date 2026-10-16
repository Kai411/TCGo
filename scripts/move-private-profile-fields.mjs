// Move personal data off the public users/{uid} documents and into
// users/{uid}/private/profile, where only the owner and admins can read it.
//
// Why this exists: users/{uid} is readable by every signed-in member, so IC
// numbers, bank accounts, addresses and phone numbers stored there were
// visible to anyone with an account. The app now writes those fields to the
// private document and migrates each profile on its owner's next visit; this
// script moves everyone else, including the server-written identity fields
// that the owner's browser is not allowed to touch.
//
//   node --experimental-strip-types scripts/move-private-profile-fields.mjs        # dry run
//   node --experimental-strip-types scripts/move-private-profile-fields.mjs --yes  # apply
//
// Deploy the new firestore.rules and the app BEFORE running with --yes, or
// the old app will keep writing these fields to the public document.
//
// Copy-then-delete, per user, in one batch: a failure leaves the profile as
// it was, never with data in neither place. Values already in the private
// document win over the legacy public copy.

import { readFileSync } from "node:fs";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { PRIVATE_FIELDS, PRIVATE_PROFILE_DOC } from "../shared/private-profile.ts";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);
if (!getApps().length) {
  initializeApp({
    credential: cert(
      JSON.parse(Buffer.from(env.NUXT_FIREBASE_SERVICE_ACCOUNT, "base64").toString("utf8")),
    ),
  });
}
const db = getFirestore();
const confirmed = process.argv.includes("--yes");

const users = await db.collection("users").get();
let toMove = 0;

for (const u of users.docs) {
  const data = u.data();
  const legacy = Object.fromEntries(
    PRIVATE_FIELDS.filter((k) => data[k] !== undefined).map((k) => [k, data[k]]),
  );
  const keys = Object.keys(legacy);
  if (!keys.length) continue;
  toMove++;
  console.log(`${u.id}: ${keys.join(", ")}`);
  if (!confirmed) continue;

  const privRef = u.ref.collection("private").doc(PRIVATE_PROFILE_DOC);
  const existing = (await privRef.get()).data() ?? {};
  const copy = Object.fromEntries(keys.filter((k) => existing[k] === undefined).map((k) => [k, legacy[k]]));

  const batch = db.batch();
  if (Object.keys(copy).length) batch.set(privRef, copy, { merge: true });
  batch.update(u.ref, {
    ...Object.fromEntries(keys.map((k) => [k, FieldValue.delete()])),
    hasContact: !!(String(legacy.phone ?? existing.phone ?? "").trim() ||
      String(legacy.whatsappNumber ?? existing.whatsappNumber ?? "").trim()),
  });
  await batch.commit();
}

console.log(
  `\n${toMove} of ${users.size} profiles ${confirmed ? "moved" : "would move"}.` +
    (confirmed ? "" : " Run again with --yes to apply."),
);
