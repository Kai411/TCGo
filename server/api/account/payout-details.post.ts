// Save the seller's payout bank account.
//
// Through the server, not a direct Firestore write, so the 24-hour hold
// after a password change (shared/security-lock.ts) can be enforced with a
// time the browser can't fake. The rules stop the owner changing these
// fields directly.
//
// Adding a first account is never held: there is nothing to redirect, and a
// payout needs a request, which is held too. Saving the same details again
// (seller setup re-saves the form) is not a change either.

import { requireUser } from "~/server/utils/auth";
import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { getUserProfile, privateProfileRef } from "~/server/utils/user-profile";
import { assertNotLocked } from "~/server/utils/security-lock";
import { bankByCode, checkBankAccount, normaliseAccountNumber } from "~/shared/banks";

export default defineEventHandler(async (event) => {
  const caller = await requireUser(event);
  const body = (await readBody(event)) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");

  const bankCode = str(body.bankCode);
  const bank = bankByCode(bankCode);
  const accountRaw = str(body.bankAccountNumber);
  const bankAccountHolder = str(body.bankAccountHolder).trim();
  const identityNumber = str(body.identityNumber).replace(/[\s-]/g, "");

  if (!bank || !accountRaw.trim() || !bankAccountHolder || !identityNumber) {
    throw createError({ statusCode: 400, message: "All four are needed before a payout can be sent." });
  }
  const check = checkBankAccount(accountRaw, bankCode);
  if (!check.ok) throw createError({ statusCode: 400, message: check.error });
  if (bankAccountHolder.length > 120 || !/^\d{6,20}$/.test(identityNumber)) {
    throw createError({ statusCode: 400, message: "Check the account holder and IC number." });
  }
  const bankAccountNumber = normaliseAccountNumber(accountRaw);

  const db = getAdminFirestore();
  const current = (await getUserProfile(db, caller.uid)) ?? {};
  const changed =
    current.bankCode !== bankCode ||
    current.bankAccountNumber !== bankAccountNumber ||
    current.bankAccountHolder !== bankAccountHolder ||
    current.identityNumber !== identityNumber;
  if (!changed) return { saved: true };
  if (current.bankAccountNumber) await assertNotLocked(caller.uid);

  await privateProfileRef(db, caller.uid).set(
    { bankAccountNumber, bankAccountHolder, identityNumber },
    { merge: true },
  );
  // Denormalised for display (order pages, admin console).
  await db.collection("users").doc(caller.uid).set(
    { bankCode, bankName: bank.name },
    { merge: true },
  );
  return { saved: true };
});
