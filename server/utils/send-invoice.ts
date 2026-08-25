// Emailing an order's invoice to the buyer.
//
// Shared by the payment webhook (automatic, once payment clears) and the
// manual resend route, so both produce an identical message and both record
// that it was sent.

import type { Firestore } from "firebase-admin/firestore";
import { renderInvoiceEmail } from "~/server/utils/invoice-email";
import { sendMail, mailConfigured } from "~/server/utils/mail";

export const sendInvoiceForOrder = async (
  db: Firestore,
  orderId: string,
): Promise<{ sent: boolean; sandbox?: boolean; reason?: string }> => {
  if (!mailConfigured()) return { sent: false, reason: "Mail not configured" };

  const orderRef = db.collection("compiledOrders").doc(orderId);
  const snap = await orderRef.get();
  if (!snap.exists) return { sent: false, reason: "Order not found" };
  const order = { ...(snap.data() as any), id: snap.id };

  // Only invoice something that's actually been paid for.
  if (!["paid", "shipped", "delivered"].includes(order.status)) {
    return { sent: false, reason: `Order is ${order.status}, not paid` };
  }

  // The order's own buyerEmail is the address the buyer signed up with; fall
  // back to the profile in case it was never denormalised onto the order.
  let email: string = order.buyerEmail || "";
  if (!email && order.buyerUid) {
    const u = await db.collection("users").doc(order.buyerUid).get();
    email = (u.data() as any)?.email || "";
  }
  if (!email) return { sent: false, reason: "Buyer has no email address" };

  const config = useRuntimeConfig();
  const siteUrl = (config.public.siteUrl as string) || "https://tcgo.shop";
  const { subject, html, text } = renderInvoiceEmail(order, { siteUrl });

  const result = await sendMail({
    to: [{ email, name: order.buyerName || undefined }],
    subject,
    html,
    text,
    category: "invoice",
  });

  if (result.sent) {
    await orderRef.update({
      invoiceEmailedAt: Date.now(),
      invoiceEmailedTo: email,
      // Sandbox messages are captured, never delivered — record that so a
      // "sent" flag can't be mistaken for the buyer having received it.
      invoiceEmailSandbox: !!result.sandbox,
    });
  }
  return { sent: result.sent, sandbox: result.sandbox, reason: result.reason };
};
