// Help Center enquiries: what a member can send, and how a conversation's
// status follows who spoke last.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  ENQUIRY_MESSAGES_MAX,
  canAddMessage,
  normaliseOrderRef,
  sortEnquiries,
  statusAfterMessage,
  validateEnquiry,
} from "~/shared/enquiries";
import { HELP_TOPICS } from "~/shared/help";

describe("enquiries", () => {
  it("needs a topic and a real message", () => {
    assert.ok("error" in validateEnquiry({ topic: "nope", message: "Where is my parcel please?" }));
    assert.ok("error" in validateEnquiry({ topic: "order", message: "  hi  " }));
    assert.ok("error" in validateEnquiry({ topic: "order", message: "x".repeat(2001) }));
    assert.deepEqual(validateEnquiry({ topic: "order", message: "  Where is my parcel?  ", orderRef: " #ab12 " }), {
      topic: "order",
      text: "Where is my parcel?",
      orderRef: "ab12",
    });
  });

  it("treats a blank order number as none", () => {
    assert.equal(normaliseOrderRef("   "), null);
    assert.equal(normaliseOrderRef(undefined), null);
  });

  it("is waiting on whoever didn't speak last", () => {
    assert.equal(statusAfterMessage("member"), "open");
    assert.equal(statusAfterMessage("tcgo"), "answered");
  });

  it("takes no more messages once closed or full", () => {
    assert.equal(canAddMessage({ status: "answered", messages: [] }).ok, true);
    assert.equal(canAddMessage({ status: "closed", messages: [] }).ok, false);
    const full = Array.from({ length: ENQUIRY_MESSAGES_MAX }, () => ({ by: "member" as const, text: "x", at: 0 }));
    assert.equal(canAddMessage({ status: "open", messages: full }).ok, false);
  });

  it("puts waiting ones first for staff, newest first otherwise", () => {
    const list = [
      { id: "a", status: "answered" as const, updatedAt: 3 },
      { id: "b", status: "open" as const, updatedAt: 1 },
      { id: "c", status: "open" as const, updatedAt: 2 },
    ];
    assert.deepEqual(sortEnquiries(list, true).map((e) => e.id), ["c", "b", "a"]);
    assert.deepEqual(sortEnquiries(list).map((e) => e.id), ["a", "c", "b"]);
  });

  it("keeps the enquiry pages' paths free of help article slugs", () => {
    const slugs = HELP_TOPICS.flatMap((t) => t.articles.map((a) => a.slug));
    for (const page of ["enquiry", "enquiries"]) assert.ok(!slugs.includes(page), page);
  });
});
