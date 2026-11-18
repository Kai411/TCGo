// Was this order really paid? Asked before any of its money is paid out.
//
// An order document can't answer that on its own. The buyer creates it from
// the browser, so at creation it can carry any paidAt, sellerPayout or
// billplzBillId, and a buyer can move their own pending order to any status.
// Without this check a buyer and a seller working together could create an
// order, mark it delivered and have TCGo pay the "seller" money nobody paid
// in (hacker review C3, Merchant of Record audit C1).
//
// Billplz is the one record the browser can't write, so the payout request
// reads the order's bill back from Billplz and checks it is paid, belongs to
// this order (create-bill sets reference_1 to the order id), and collected at
// least what the seller would be paid. Pure, so the tests cover each case.

export interface BillplzBillRecord {
  id?: string;
  paid?: boolean;
  state?: string;
  /** Sen. */
  amount?: number;
  /** Sen actually collected. */
  paid_amount?: number;
  reference_1?: string | null;
}

export interface PaidCheckOrder {
  paidAt?: number | null;
  billplzBillId?: string | null;
  paymentMethod?: string;
}

/**
 * Null when the bill proves the order was paid and covers the payout, or a
 * short reason (for logs and staff, not shown to the seller) when it doesn't.
 */
export const orderPaymentProblem = (
  orderId: string,
  order: PaidCheckOrder,
  bill: BillplzBillRecord | null,
  payoutAmount: number,
): string | null => {
  if (order.paymentMethod !== "billplz") return "not an online payment";
  if (!order.paidAt) return "the order was never marked paid";
  if (!order.billplzBillId) return "the order has no Billplz bill";
  if (!bill) return `Billplz has no bill ${order.billplzBillId}`;
  if (bill.id !== order.billplzBillId) return "Billplz returned a different bill";
  if (bill.reference_1 !== orderId) return "the bill belongs to a different order";
  if (bill.paid !== true || (bill.state && bill.state !== "paid")) {
    return `the bill is ${bill.state || "unpaid"}`;
  }
  const paidSen = Number(bill.paid_amount ?? bill.amount ?? 0);
  if (!Number.isFinite(paidSen) || paidSen <= 0) return "the bill shows nothing collected";
  if (Math.round(payoutAmount * 100) > paidSen) {
    return `the payout (${Math.round(payoutAmount * 100)} sen) is more than the buyer paid (${paidSen} sen)`;
  }
  return null;
};
