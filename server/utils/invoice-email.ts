// Invoice email.
//
// Written as tables with inline styles rather than reusing the invoice page's
// markup: email clients (Outlook especially) don't support flexbox, grid, or
// external stylesheets, so the two renderings genuinely can't share markup.
// The numbers both show come from the same order document, so they agree.
//
// This is a transactional receipt, not marketing — it goes to one buyer about
// one purchase they just made, so it carries no unsubscribe or tracking.

import { stateName } from "~/shared/my-states";

const esc = (v: unknown): string =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const money = (n: unknown) => `RM ${Number(n ?? 0).toFixed(2)}`;

const fmtDate = (ms?: number) =>
  ms
    ? new Date(ms).toLocaleDateString("en-MY", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

export interface InvoiceEmail {
  subject: string;
  html: string;
  text: string;
}

export const renderInvoiceEmail = (
  order: any,
  opts: { siteUrl: string },
): InvoiceEmail => {
  const ref = String(order.id ?? "").slice(0, 8).toUpperCase();
  const addr = order.deliveryAddress;
  const orderUrl = `${opts.siteUrl}/orders/${order.id}`;
  const invoiceUrl = `${opts.siteUrl}/invoices/${order.id}`;

  const rows = (order.items ?? [])
    .map(
      (i: any) => `
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
          <td align="right" style="padding:10px 0;border-bottom:1px solid #eee;font:14px/1.4 Helvetica,Arial,sans-serif;color:#111;white-space:nowrap">
            ${money(i.price)}
          </td>
        </tr>`,
    )
    .join("");

  const addressBlock = addr
    ? `${esc(addr.name)}<br/>${esc(addr.phone)}<br/>${esc(addr.address1)}${
        addr.address2 ? `, ${esc(addr.address2)}` : ""
      }<br/>${esc(addr.postcode)} ${esc(addr.city)}<br/>${esc(stateName(addr.state))}`
    : "—";

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Invoice ${esc(ref)}</title></head>
<body style="margin:0;padding:0;background:#f5f5f5">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:12px;padding:28px">

  <tr><td style="padding-bottom:18px;border-bottom:1px solid #e5e7eb">
    <table role="presentation" width="100%"><tr>
      <td style="font:800 20px Helvetica,Arial,sans-serif;color:#111">TCGo</td>
      <td align="right" style="font:14px Helvetica,Arial,sans-serif;color:#111">
        <strong>INVOICE</strong><br/>
        <span style="font-family:monospace;color:#666;font-size:12px">#${esc(ref)}</span>
      </td>
    </tr></table>
  </td></tr>

  <tr><td style="padding:18px 0;font:14px/1.5 Helvetica,Arial,sans-serif;color:#111">
    Hi ${esc(order.buyerName || "there")}, thanks for your order — payment received.
  </td></tr>

  <tr><td style="padding-bottom:6px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="50%" valign="top" style="font:12px/1.5 Helvetica,Arial,sans-serif;color:#666;padding-right:12px">
          <strong style="color:#111;text-transform:uppercase;font-size:11px">Delivered to</strong><br/>
          ${addressBlock}
        </td>
        <td width="50%" valign="top" style="font:12px/1.5 Helvetica,Arial,sans-serif;color:#666">
          <strong style="color:#111;text-transform:uppercase;font-size:11px">Order</strong><br/>
          Sold by ${esc(order.sellerName)}<br/>
          Placed ${esc(fmtDate(order.createdAt))}<br/>
          ${order.paidAt ? `Paid ${esc(fmtDate(order.paidAt))}` : ""}
        </td>
      </tr>
    </table>
  </td></tr>

  <tr><td style="padding-top:14px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${rows}
      <tr>
        <td style="padding:10px 0;font:14px Helvetica,Arial,sans-serif;color:#666">Subtotal</td>
        <td align="right" style="padding:10px 0;font:14px Helvetica,Arial,sans-serif;color:#666">${money(order.subtotal)}</td>
      </tr>
      <tr>
        <td style="padding:0 0 10px;font:14px Helvetica,Arial,sans-serif;color:#666">
          Shipping${order.shippingCourier ? ` (${esc(order.shippingCourier)})` : ""}
        </td>
        <td align="right" style="padding:0 0 10px;font:14px Helvetica,Arial,sans-serif;color:#666">${money(order.shipping)}</td>
      </tr>
      <tr>
        <td style="padding:12px 0;border-top:2px solid #111;font:700 16px Helvetica,Arial,sans-serif;color:#111">Total</td>
        <td align="right" style="padding:12px 0;border-top:2px solid #111;font:700 16px Helvetica,Arial,sans-serif;color:#111">${money(order.total)}</td>
      </tr>
    </table>
  </td></tr>

  ${
    order.trackingNumber
      ? `<tr><td style="padding:14px 0;font:13px/1.5 Helvetica,Arial,sans-serif;color:#111">
           <strong>Tracking:</strong> <span style="font-family:monospace">${esc(order.trackingNumber)}</span>
           ${order.shippingCarrier ? ` · ${esc(order.shippingCarrier)}` : ""}
         </td></tr>`
      : ""
  }

  <tr><td align="center" style="padding:18px 0">
    <a href="${esc(orderUrl)}" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;font:700 14px Helvetica,Arial,sans-serif;padding:12px 22px;border-radius:8px">
      View your order
    </a>
    <div style="font:12px Helvetica,Arial,sans-serif;color:#666;padding-top:10px">
      Or open the <a href="${esc(invoiceUrl)}" style="color:#dc2626">printable invoice</a>.
    </div>
  </td></tr>

  <tr><td style="padding-top:16px;border-top:1px solid #e5e7eb;font:11px/1.6 Helvetica,Arial,sans-serif;color:#999">
    Paid online via FPX${order.billplzBillId ? ` · ref ${esc(order.billplzBillId)}` : ""}.<br/>
    Computer generated and valid without a signature. Amounts in Malaysian Ringgit (MYR).
  </td></tr>

</table>
</td></tr></table>
</body></html>`;

  const text = [
    `TCGo — Invoice #${ref}`,
    ``,
    `Hi ${order.buyerName || "there"}, thanks for your order — payment received.`,
    ``,
    ...(order.items ?? []).map(
      (i: any) => `- ${i.cardName} — ${money(i.price)}`,
    ),
    ``,
    `Subtotal: ${money(order.subtotal)}`,
    `Shipping: ${money(order.shipping)}`,
    `Total:    ${money(order.total)}`,
    ``,
    ...(order.trackingNumber ? [`Tracking: ${order.trackingNumber}`, ``] : []),
    `View your order: ${orderUrl}`,
    `Printable invoice: ${invoiceUrl}`,
  ].join("\n");

  return { subject: `Your TCGo invoice #${ref}`, html, text };
};
