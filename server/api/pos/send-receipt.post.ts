// Email the receipt for a counter sale.
//
// Reads the sale from Firestore rather than trusting the numbers the till
// sends: a receipt is a record of what was actually charged, and one assembled
// from a request body is a record of what the caller claimed. They agree
// today; they would stop agreeing the first time anything client-side drifted.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireUser } from "~/server/utils/auth";
import { isPlausibleEmail, normaliseEmail } from "~/shared/buyer-qr";
import { sendReceipt } from "~/server/utils/receipt-email";
import { mailConfigured } from "~/server/utils/mail";
import { noteError } from "~/server/utils/oplog";

export default defineEventHandler(async (event) => {
  const caller = await requireUser(event);
  const { saleId, email } = (await readBody(event)) as {
    saleId?: string;
    email?: string;
  };

  if (!saleId) throw createError({ statusCode: 400, message: "saleId required" });
  if (!isPlausibleEmail(email)) {
    throw createError({ statusCode: 400, message: "That doesn't look like an email address." });
  }
  if (!mailConfigured()) {
    throw createError({
      statusCode: 503,
      message: "Email isn't set up yet, so receipts can't be sent.",
    });
  }

  const db = getAdminFirestore();
  const ref = db.collection("posSales").doc(saleId);
  const snap = await ref.get();
  if (!snap.exists) throw createError({ statusCode: 404, message: "Sale not found" });

  const sale = snap.data() as any;

  // The shop's own sale, and only the shop's. Counter sales carry no buyer,
  // so the seller is the only party with a claim to this record.
  if (sale.sellerUid !== caller.uid) {
    throw createError({ statusCode: 403, message: "Not your sale" });
  }
  if (sale.status !== "paid") {
    throw createError({
      statusCode: 409,
      message: "This sale hasn't been paid for yet.",
    });
  }

  const shopSnap = await db.collection("users").doc(caller.uid).get();
  const shop = (shopSnap.data() ?? {}) as Record<string, unknown>;
  const shopName =
    (typeof shop.customName === "string" && shop.customName) ||
    (typeof shop.displayName === "string" && shop.displayName) ||
    caller.name ||
    "The shop";

  const config = useRuntimeConfig();
  const siteUrl =
    getRequestURL(event).origin || (config.public.siteUrl as string) || "https://tcgo.shop";

  const to = normaliseEmail(email!);
  const mail = await sendReceipt({
    to,
    shopName,
    saleId,
    lines: (sale.lines ?? []).map((l: any) => ({
      cardName: l.cardName,
      sub: l.sub,
      listPrice: l.listPrice,
      soldPrice: l.soldPrice,
    })),
    subtotal: sale.subtotal ?? 0,
    discountTotal: sale.discountTotal ?? 0,
    total: sale.total ?? 0,
    method: sale.method ?? "cash",
    paidAt: sale.paidAt ?? sale.updatedAt ?? Date.now(),
    siteUrl,
  });

  if (!mail.sent) {
    noteError({
      area: "pos",
      severity: "warning",
      code: "pos.receipt_failed",
      message: `Couldn't email a counter receipt: ${mail.reason || "unknown"}`,
      userUid: caller.uid,
      context: { saleId },
      hint: "Check the Mailtrap token and sending domain.",
    });
    throw createError({
      statusCode: 502,
      message: "Couldn't send the receipt just now. The sale is recorded either way.",
    });
  }

  // Recorded on the sale so the till can show "sent to …" instead of offering
  // to send it again, and so a customer asking "did you send it?" has an
  // answer that isn't someone's memory.
  await ref.update({
    receiptEmail: to,
    receiptSentAt: Date.now(),
    updatedAt: Date.now(),
  });

  return { sent: true, to, sandbox: mail.sandbox };
});
