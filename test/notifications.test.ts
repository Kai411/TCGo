// What buyers and sellers are told, and when it goes away.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  AUDIENCE_LABEL,
  SEEN_RETENTION_MS,
  isStaleSeen,
  newFollower,
  orderCancelled,
  orderCreated,
  orderMerged,
  orderPlaced,
  unreadCount,
} from "~/shared/notifications";

describe("who each notification is for", () => {
  it("tells the buyer their order is confirmed, linking to it", () => {
    const n = orderPlaced({ orderId: "abc", sellerName: "Kai", total: 84, itemCount: 2 });
    assert.equal(n.audience, "buyer");
    assert.equal(n.kind, "order_placed");
    assert.equal(n.href, "/orders/abc");
    assert.match(n.title, /RM 84\.00/);
    assert.match(n.body, /2 cards from Kai/);
  });

  it("tells the seller about a new order", () => {
    const n = orderCreated({ orderId: "abc", buyerName: "Ann", total: 50 });
    assert.equal(n.audience, "seller");
    assert.match(n.title, /RM 50\.00/);
  });

  it("tags every seller event as Selling", () => {
    for (const n of [
      orderCreated({ orderId: "a" }),
      orderMerged({ parentOrderId: "a" }),
      orderCancelled({ orderId: "a" }),
      newFollower({ followerUid: "u" }),
    ]) {
      assert.equal(n.audience, "seller", n.kind);
      assert.equal(AUDIENCE_LABEL[n.audience], "Selling");
    }
    assert.equal(AUDIENCE_LABEL.buyer, "Buying");
  });

  it("never links a seller to a page that doesn't exist", () => {
    // There is no /seller/orders/:id page; that link used to 404.
    for (const n of [
      orderCreated({ orderId: "a" }),
      orderMerged({ parentOrderId: "a" }),
      orderCancelled({ orderId: "a" }),
    ]) {
      assert.ok(!/^\/seller\/orders\/[^?]/.test(n.href ?? ""), `${n.kind} → ${n.href}`);
    }
  });
});

describe("clearing read notifications after a week", () => {
  const now = 1_000_000_000_000;

  it("keeps anything unread, however old", () => {
    assert.equal(isStaleSeen({ readAt: null, createdAt: 0 }, now), false);
  });

  it("keeps a read notification for a week", () => {
    assert.equal(isStaleSeen({ readAt: now - SEEN_RETENTION_MS + 1 }, now), false);
  });

  it("marks it for deletion once a week has passed since it was read", () => {
    assert.equal(isStaleSeen({ readAt: now - SEEN_RETENTION_MS }, now), true);
  });

  it("measures from when it was read, not when it was sent", () => {
    // Sent a month ago, read a minute ago: still fresh.
    assert.equal(
      isStaleSeen({ createdAt: now - 30 * 86_400_000, readAt: now - 60_000 }, now),
      false,
    );
  });
});

describe("the red dot", () => {
  it("counts only unread", () => {
    assert.equal(unreadCount([{ readAt: null }, { readAt: 5 }, { readAt: undefined }]), 2);
  });
});
