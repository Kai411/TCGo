import { requireUser } from "~/server/utils/auth";
import { getAdminFirestore } from "~/server/utils/firebase-admin";

// Seller saves where their payouts go. Body: { bankCode, accountNumber,
// holderName, identityNumber }.
export default defineEventHandler(async (event) => {
  const token = await requireUser(event);
  const b = (await readBody<Record<string, unknown>>(event)) ?? {};
  const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const bankCode = s(b.bankCode).toUpperCase();
  const accountNumber = s(b.accountNumber).replace(/[\s-]/g, "");
  const holderName = s(b.holderName);
  const identityNumber = s(b.identityNumber).replace(/[\s-]/g, "");

  if (!/^[A-Z0-9]{8,11}$/.test(bankCode)) bad("Pick a bank");
  if (!/^\d{6,20}$/.test(accountNumber)) bad("Account number should be 6–20 digits");
  if (holderName.length < 2 || holderName.length > 120) bad("Enter the account holder's name");
  if (!/^[A-Z0-9]{6,20}$/i.test(identityNumber)) bad("Enter your MyKad or SSM number");

  await getAdminFirestore().collection("payoutAccounts").doc(token.uid).set({
    bankCode,
    accountNumber,
    holderName,
    identityNumber,
    email: token.email || "",
    updatedAt: Date.now(),
  });
  return { ok: true };
});

function bad(message: string): never {
  throw createError({ statusCode: 400, message });
}
