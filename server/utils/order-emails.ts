// "You made a sale" — the seller's email when an order is paid.
//
// The buyer already gets one at the same moment: the invoice, sent from the
// payment webhook. The seller got nothing, so a sale made while they were away
// from the app waited until they next opened the dashboard — and the 3-hour
// cancellation window and packing time both start at payment, not at login.
//
// Transactional, one seller, one sale: no unsubscribe, no tracking.

import type { Firestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { mailConfigured, sendMail } from "~/server/utils/mail";

const esc = (v: unknown): string =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const money = (n: unknown) => `RM ${Number(n ?? 0).toFixed(2)}`;

/** The seller's address: their profile first, then their sign-in account. */
const sellerEmailFor = async (db: Firestore, uid: string): Promise<string> => {
  const profile = await db.collection("users").doc(uid).get();
  const fromProfile = (profile.data() as any)?.email;
  if (fromProfile) return fromProfile;
  try {
    return (await getAuth().getUser(uid)).email || "";
  } catch {
    return "";
  }
};

export const renderSellerOrderEmail = (
  order: any,
  opts: { siteUrl: string; payout?: number | null },
) => {
  const ref = String(order.id ?? "").slice(0, 8).toUpperCase();
  const items: any[] = order.items ?? [];
  const count = items.length || 1;
  const ordersUrl = `${opts.siteUrl}/seller/orders?q=toship`;

  const rows = items
    .map(
      (i) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #eee;font:14px/1.4 Helvetica,Arial,sans-serif;color:#111">
            <strong>${esc(i.cardName)}</strong>
            ${
              [i.cardSet, i.condition].filter(Boolean).length
                ? `<div style="color:#666;font-size:12px">${esc(
                    [i.cardSet, i.condition].filter(Boolean).join(" · "),
                  )}</div>`
                : ""
            }
          </td>
          <td align="right" style="padding:10px 0;border-bottom:1px solid #eee;font:14px/1.4 Helvetica,Arial,sans-serif;color:#111;white-space:nowrap">${money(i.price)}</td>
        </tr>`,
    )
    .join("");

  const payoutRow =
    typeof opts.payout === "number"
      ? `<tr>
           <td style="padding:12px 0;border-top:2px solid #111;font:700 16px Helvetica,Arial,sans-serif;color:#111">Your payout</td>
           <td align="right" style="padding:12px 0;border-top:2px solid #111;font:700 16px Helvetica,Arial,sans-serif;color:#111">${money(opts.payout)}</td>
         </tr>`
      : "";

  const html = `<!doctype html><html><body style="margin:0;background:#f5f5f5">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:12px;padding:28px">
  <tr><td style="font:700 20px Helvetica,Arial,sans-serif;color:#111;padding-bottom:4px">You made a sale</td></tr>
  <tr><td style="font:14px/1.5 Helvetica,Arial,sans-serif;color:#555;padding-bottom:18px">
    ${esc(order.buyerName || "A buyer")} paid for ${count} card${count === 1 ? "" : "s"} · order #${esc(ref)}.
    Pack it and book the courier when you're ready.
  </td></tr>
  <tr><td>
    <table width="100%" cellpadding="0" cellspacing="0">
      ${rows}
      <tr>
        <td style="padding:12px 0 6px;font:14px Helvetica,Arial,sans-serif;color:#666">Sale</td>
        <td align="right" style="padding:12px 0 6px;font:14px Helvetica,Arial,sans-serif;color:#666">${money(order.subtotal)}</td>
      </tr>
      ${payoutRow}
    </table>
  </td></tr>
  <tr><td align="center" style="padding:22px 0 6px">
    <a href="${esc(ordersUrl)}" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;font:700 14px Helvetica,Arial,sans-serif;padding:12px 22px;border-radius:8px">
      Open orders to ship
    </a>
  </td></tr>
  <tr><td style="padding-top:16px;border-top:1px solid #e5e7eb;font:11px/1.6 Helvetica,Arial,sans-serif;color:#999">
    Payout is released after the buyer receives the parcel. Amounts in Malaysian Ringgit (MYR).
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

  const text = [
    `You made a sale — order #${ref}`,
    ``,
    `${order.buyerName || "A buyer"} paid for ${count} card${count === 1 ? "" : "s"}.`,
    ``,
    ...items.map((i) => `- ${i.cardName} — ${money(i.price)}`),
    ``,
    `Sale: ${money(order.subtotal)}`,
    ...(typeof opts.payout === "number" ? [`Your payout: ${money(opts.payout)}`] : []),
    ``,
    `Pack it and book the courier when you're ready: ${ordersUrl}`,
  ].join("\n");

  return { subject: `New order #${ref} · ${money(order.subtotal)}`, html, text };
};

export const sendSellerOrderEmail = async (
  db: Firestore,
  order: any,
  opts: { payout?: number | null } = {},
): Promise<{ sent: boolean; sandbox?: boolean; reason?: string }> => {
  if (!mailConfigured()) return { sent: false, reason: "Mail not configured" };
  if (!order?.sellerUid) return { sent: false, reason: "Order has no seller" };

  const email = await sellerEmailFor(db, order.sellerUid);
  if (!email) return { sent: false, reason: "Seller has no email address" };

  const config = useRuntimeConfig();
  const siteUrl = (config.public.siteUrl as string) || "https://tcgo.shop";
  const { subject, html, text } = renderSellerOrderEmail(order, {
    siteUrl,
    payout: opts.payout,
  });

  const result = await sendMail({
    to: [{ email, name: order.sellerName || undefined }],
    subject,
    html,
    text,
    category: "seller-order",
  });

  if (result.sent && order.id) {
    await db.collection("compiledOrders").doc(order.id).update({
      sellerOrderEmailedAt: Date.now(),
      sellerOrderEmailSandbox: !!result.sandbox,
    });
  }
  return { sent: result.sent, sandbox: result.sandbox, reason: result.reason };
};
