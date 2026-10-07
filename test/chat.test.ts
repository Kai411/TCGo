// Chat: what counts as a risky message, and how reply times are measured.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  REPLY_CAP_MS,
  REPLY_SAMPLE_SIZE,
  addReplySample,
  applyReplyTiming,
  conversationIdFor,
  detectChatRisks,
  isUnreadFor,
  lastSeenLabel,
  messagePreview,
  replyTimeLabel,
} from "~/shared/chat";

const codes = (text: string) => detectChatRisks(text).map((r) => r.code);

describe("risky messages", () => {
  it("leaves ordinary card talk alone", () => {
    for (const text of [
      "Is the Charizard ex 199/165 still available?",
      "Can do RM1,200 for the pair, or RM 650 each",
      "PSA 10, cert looks fine. Corners are sharp",
      "I'll ship tomorrow morning, thanks!",
      "SV3a set, 2023 print, NM condition",
      "Is it negotiable? Would you take 85?",
      "Booster box sealed, 36 packs",
    ]) {
      assert.deepEqual(codes(text), [], text);
    }
  });

  it("catches Malaysian phone numbers however they're typed", () => {
    for (const text of [
      "call 012-345 6789",
      "0123456789",
      "my no +60 12 345 6789",
      "011 1234 5678",
      "office 03-1234 5678",
    ]) {
      assert.ok(codes(text).includes("phone"), text);
    }
  });

  it("tells an IC number from a bank account", () => {
    assert.deepEqual(codes("IC 900101-14-5567"), ["ic_number"]);
    assert.deepEqual(codes("acc 5142 3456 7890 1"), ["bank_account"]);
  });

  it("catches emails, without also calling the domain a link", () => {
    assert.deepEqual(codes("email me at ash.k@gmail.com"), ["email"]);
  });

  it("catches addresses by street word or postcode and state", () => {
    assert.ok(codes("send to No 5, Jalan SS2/24").includes("address"));
    assert.ok(codes("47300 Petaling Jaya, Selangor").includes("address"));
  });

  it("catches moving the deal to another app or payment", () => {
    assert.deepEqual(codes("add me on whatsapp"), ["outside_contact"]);
    assert.deepEqual(codes("can bank in direct, cheaper"), ["outside_payment"]);
    assert.deepEqual(codes("TNG ok?"), ["outside_payment"]);
    assert.deepEqual(codes("COD at Mid Valley?"), ["outside_payment"]);
  });

  it("flags links to other sites but not our own", () => {
    assert.deepEqual(codes("see https://bit.ly/abc"), ["link"]);
    assert.deepEqual(codes("check scam-site.xyz now"), ["link"]);
    assert.deepEqual(codes("here https://tcgo.my/cards/abc"), []);
  });

  it("flags requests for codes and passwords", () => {
    assert.deepEqual(codes("send me the OTP you got"), ["credentials"]);
  });

  it("reports each risk once, in a fixed order", () => {
    assert.deepEqual(codes("whatsapp 0123456789 or 0198765432"), ["phone", "outside_contact"]);
  });
});

describe("reply times", () => {
  it("measures from the first unanswered message to the reply", () => {
    let clock = applyReplyTiming({}, "ann", "bob", 1_000).next;
    // Ann sends again; the clock keeps its start.
    clock = applyReplyTiming(clock, "ann", "bob", 5_000).next;
    const reply = applyReplyTiming(clock, "bob", "ann", 61_000);
    assert.equal(reply.replyMs, 60_000);
    assert.deepEqual(reply.next, { awaitingReplyFrom: "ann", awaitingSince: 61_000 });
  });

  it("doesn't count a message nobody was waiting for", () => {
    assert.equal(applyReplyTiming({}, "ann", "bob", 1).replyMs, null);
  });

  it("caps one slow reply", () => {
    const clock = { awaitingReplyFrom: "bob", awaitingSince: 0 };
    assert.equal(applyReplyTiming(clock, "bob", "ann", REPLY_CAP_MS * 10).replyMs, REPLY_CAP_MS);
  });

  it("averages only the most recent replies", () => {
    let stats = addReplySample(undefined, 1_000_000);
    for (let i = 0; i < REPLY_SAMPLE_SIZE; i++) stats = addReplySample(stats, 60_000);
    assert.equal(stats.recentReplyMs.length, REPLY_SAMPLE_SIZE);
    assert.equal(stats.avgReplyMs, 60_000);
    assert.equal(stats.replyCount, REPLY_SAMPLE_SIZE + 1);
  });

  it("says nothing until there are enough replies", () => {
    assert.equal(replyTimeLabel(addReplySample(undefined, 60_000)), "Not enough replies yet");
    let s = addReplySample(undefined, 20 * 60_000);
    s = addReplySample(s, 30 * 60_000);
    s = addReplySample(s, 25 * 60_000);
    assert.equal(replyTimeLabel(s), "Replies in about 25 min on average");
  });
});

describe("conversations", () => {
  it("is the same conversation from either side", () => {
    assert.equal(conversationIdFor("b", "a"), conversationIdFor("a", "b"));
  });

  it("is unread only when the other person wrote since you looked", () => {
    const c = { lastMessage: { preview: "hi", senderUid: "ann", at: 10 }, lastReadAt: { bob: 5 } };
    assert.equal(isUnreadFor(c, "bob"), true);
    assert.equal(isUnreadFor(c, "ann"), false);
    assert.equal(isUnreadFor({ ...c, lastReadAt: { bob: 10 } }, "bob"), false);
  });

  it("previews photos and attachments when there's no text", () => {
    assert.equal(messagePreview({ images: ["a", "b"] }), "Sent 2 photos");
    assert.equal(
      messagePreview({ attachment: { type: "order", orderId: "o", itemCount: 1, firstItemName: "x", imageUrl: "", total: 1, status: "paid" } }),
      "Shared an order",
    );
  });

  it("describes last online plainly", () => {
    const now = 100 * 24 * 3600_000;
    assert.equal(lastSeenLabel(now - 60_000, now), "Online now");
    assert.equal(lastSeenLabel(now - 30 * 60_000, now), "Active 30 min ago");
    assert.equal(lastSeenLabel(now - 26 * 3600_000, now), "Active yesterday");
    assert.equal(lastSeenLabel(null, now), "Not seen recently");
  });
});
