// The receipt for an in-person sale.
//
// BRANDED AS THE SHOP, NOT AS TCGo — and that is a factual matter, not a
// design preference.
//
// On an online order TCGo is the merchant of record: the money went through
// our Billplz account, we booked the courier, we held the escrow. Our name on
// that invoice is accurate.
//
// At a counter we are in none of it. The money went from the customer to the
// shop's own bank through HitPay; we supplied the till. A receipt headed with
// our logo would misstate who sold the card and, more importantly, who the
// customer's recourse is against — a dispute over an in-person sale is with
// the shop. We are also not SST-registered and not the supplier, so it must
// not read as our tax document.
//
// So: the shop's name is the header and the merchant. TCGo appears once, in
// the footer, as the thing that sent it. That is the pattern Square and
// Stripe receipts use, it is honest, and it puts our name in front of every
// walk-in customer without claiming their sale.

import { sendMail } from "~/server/utils/mail";

const esc = (s: unknown): string =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

const money = (n: unknown): string =>
  `RM ${Number(n ?? 0).toFixed(2)}`;

export interface ReceiptLine {
  cardName: string;
  sub?: string;
  listPrice?: number;
  soldPrice: number;
}

export interface ReceiptInput {
  to: string;
  shopName: string;
  saleId: string;
  lines: ReceiptLine[];
  subtotal: number;
  discountTotal: number;
  total: number;
  method: string;
  paidAt: number;
  siteUrl: string;
}

const METHOD_LABEL: Record<string, string> = {
  duitnow_qr: "DuitNow QR",
  tap_to_pay: "Card",
  cash: "Cash",
};

export const sendReceipt = async (input: ReceiptInput) => {
  const ref = input.saleId.slice(0, 8).toUpperCase();
  const when = new Date(input.paidAt).toLocaleString("en-MY", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const rows = input.lines
    .map((l) => {
      const discounted =
        typeof l.listPrice === "number" && l.listPrice > l.soldPrice;
      return `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #eee;font:14px/1.4 Helvetica,Arial,sans-serif;color:#111">
          <strong>${esc(l.cardName)}</strong>
          ${l.sub ? `<div style="color:#666;font-size:12px">${esc(l.sub)}</div>` : ""}
        </td>
        <td align="right" style="padding:10px 0;border-bottom:1px solid #eee;font:14px/1.4 Helvetica,Arial,sans-serif;color:#111;white-space:nowrap">
          ${
            discounted
              ? `<span style="color:#999;text-decoration:line-through;font-size:12px">${money(l.listPrice)}</span><br>`
              : ""
          }${money(l.soldPrice)}
        </td>
      </tr>`;
    })
    .join("");

  const html = `
<div style="margin:0;padding:28px 16px;background:#f4f5f7">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:14px;padding:28px 26px;font-family:Helvetica,Arial,sans-serif">
    <h1 style="margin:0 0 2px;font-size:20px;color:#111">${esc(input.shopName)}</h1>
    <p style="margin:0 0 20px;font-size:13px;color:#666">
      Receipt ${esc(ref)} · ${esc(when)}
    </p>

    <table style="width:100%;border-collapse:collapse">${rows}</table>

    ${
      input.discountTotal > 0
        ? `<div style="display:flex;justify-content:space-between;padding:10px 0;font:13px Helvetica,Arial,sans-serif;color:#666">
             <span>Discount</span><span>−${money(input.discountTotal)}</span>
           </div>`
        : ""
    }

    <div style="margin-top:14px;padding-top:14px;border-top:2px solid #111;display:flex;justify-content:space-between;align-items:baseline">
      <span style="font:700 15px Helvetica,Arial,sans-serif;color:#111">Total paid</span>
      <span style="font:700 20px Helvetica,Arial,sans-serif;color:#111">${money(input.total)}</span>
    </div>
    <p style="margin:6px 0 0;font-size:12px;color:#666">
      Paid by ${esc(METHOD_LABEL[input.method] ?? input.method)}
    </p>

    <p style="margin:22px 0 0;padding-top:16px;border-top:1px solid #eee;font-size:12px;line-height:1.6;color:#888">
      Sold by ${esc(input.shopName)}. Questions about this purchase go to them
      directly.<br>
      Sent via <a href="${esc(input.siteUrl)}" style="color:#888">TCGo</a>.
    </p>
  </div>
</div>`;

  const text = [
    input.shopName,
    `Receipt ${ref} · ${when}`,
    "",
    ...input.lines.map((l) => `${l.cardName}  ${money(l.soldPrice)}`),
    "",
    input.discountTotal > 0 ? `Discount  -${money(input.discountTotal)}` : "",
    `Total paid  ${money(input.total)}`,
    `Paid by ${METHOD_LABEL[input.method] ?? input.method}`,
    "",
    `Sold by ${input.shopName}. Questions about this purchase go to them directly.`,
    `Sent via TCGo — ${input.siteUrl}`,
  ]
    .filter((l) => l !== "")
    .join("\n");

  return sendMail({
    to: [{ email: input.to }],
    // The shop's name, not ours: this lands in an inbox next to other
    // receipts, and "TCGo" would be a name the customer may not recognise.
    subject: `Your receipt from ${input.shopName} — ${money(input.total)}`,
    category: "pos-receipt",
    html,
    text,
  });
};
