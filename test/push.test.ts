// Push notifications: who gets told, what it says, and what's refused.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_PUSH_PREFS,
  announcedStatus,
  buildPushPayload,
  categoryForKind,
  chatPush,
  normalizePushPrefs,
  outbidTargets,
  parsePushSubscription,
  pickPushPrefs,
  safePushUrl,
} from "~/shared/push";
import { auctionOutbid, auctionWon, orderShipped } from "~/shared/notifications";

describe("push settings", () => {
  it("defaults everything on and ignores junk", () => {
    assert.deepEqual(normalizePushPrefs(undefined), DEFAULT_PUSH_PREFS);
    assert.deepEqual(normalizePushPrefs({ messages: false, orders: "no", extra: true }), {
      messages: false,
      orders: true,
      auctions: true,
    });
  });

  it("only takes known on/off keys from a request", () => {
    assert.deepEqual(pickPushPrefs({ auctions: false, uid: "x", messages: 1 }), { auctions: false });
  });

  it("files each notification under a category", () => {
    assert.equal(categoryForKind("order_shipped"), "orders");
    assert.equal(categoryForKind("auction_outbid"), "auctions");
    assert.equal(categoryForKind("new_follower"), "orders");
  });
});

describe("push payloads", () => {
  it("never opens another site", () => {
    assert.equal(safePushUrl("/orders/1"), "/orders/1");
    assert.equal(safePushUrl("https://evil.example"), "/");
    assert.equal(safePushUrl("//evil.example"), "/");
    assert.equal(safePushUrl(null), "/");
  });

  it("clips long text for a lock screen", () => {
    const p = buildPushPayload({ title: "x".repeat(200), body: "y ".repeat(300), href: "/a" });
    assert.ok(p.title.length <= 80 && p.title.endsWith("…"));
    assert.ok(p.body.length <= 180);
  });

  it("groups a chat's messages under one tag and opens that chat", () => {
    const p = chatPush({ senderUid: "u1", senderName: "Kai", preview: "Still available?", conversationId: "u1__u2" });
    assert.equal(p.title, "Kai");
    assert.equal(p.url, "/messages/u1");
    assert.equal(p.tag, "chat-u1__u2");
  });

  it("puts the money and the deadline where they're seen", () => {
    assert.match(auctionOutbid({ auctionId: "a", currentPrice: 120, cardName: "Charizard" }).title, /RM 120\.00/);
    const won = auctionWon({ auctionId: "a", orderId: "o", price: 50, payWithinHours: 48 });
    assert.equal(won.href, "/orders/o");
    assert.match(won.body, /48 hours/);
    assert.match(orderShipped({ orderId: "o", courier: "J&T" }).body, /J&T/);
  });
});

describe("subscriptions", () => {
  const ok = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "k", auth: "a" } };

  it("accepts a browser subscription", () => {
    assert.deepEqual(parsePushSubscription(ok), ok);
  });

  it("refuses anything that would make the server call somewhere it shouldn't", () => {
    assert.equal(parsePushSubscription({ ...ok, endpoint: "http://fcm.googleapis.com/x" }), null);
    assert.equal(parsePushSubscription({ ...ok, endpoint: "https://localhost/x" }), null);
    assert.equal(parsePushSubscription({ ...ok, endpoint: "https://169.254.169.254/x" }), null);
    assert.equal(parsePushSubscription({ ...ok, endpoint: "https://[::1]/x" }), null);
    assert.equal(parsePushSubscription({ endpoint: ok.endpoint }), null);
    assert.equal(parsePushSubscription("nope"), null);
  });
});

describe("who has been outbid", () => {
  const bids = [
    { bidderUid: "a", amount: 10 },
    { bidderUid: "b", amount: 12 },
    { bidderUid: "a", amount: 14 },
    { bidderUid: "c", amount: 16 },
  ];

  it("tells everyone below the top bidder, with their best bid", () => {
    assert.deepEqual(outbidTargets(bids, "c", 16), [
      { uid: "a", myBest: 14 },
      { uid: "b", myBest: 12 },
    ]);
  });

  it("doesn't tell someone twice about the same bid", () => {
    assert.deepEqual(outbidTargets(bids, "c", 16, { a: 14, b: 12 }), []);
  });

  it("tells them again once they bid again and lose again", () => {
    const more = [...bids, { bidderUid: "a", amount: 18 }, { bidderUid: "c", amount: 20 }];
    assert.deepEqual(outbidTargets(more, "c", 20, { a: 14, b: 12 }), [{ uid: "a", myBest: 18 }]);
  });

  it("never tells the person on top", () => {
    assert.deepEqual(outbidTargets([{ bidderUid: "a", amount: 5 }], "a", 5), []);
    assert.deepEqual(outbidTargets(bids, undefined, 16), []);
  });
});

describe("which order changes are announced", () => {
  it("only shipped and delivered", () => {
    assert.equal(announcedStatus("shipped"), "shipped");
    assert.equal(announcedStatus("delivered"), "delivered");
    assert.equal(announcedStatus("paid"), null);
  });
});
