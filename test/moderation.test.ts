// Listing reports, Hide listing and Suspend selling (shared/moderation.ts).

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  LISTING_REPORT_REASONS,
  cleanModerationMessage,
  isHiddenByStaff,
  isListingReportType,
  isSellingSuspended,
  listingHiddenNotice,
  listingReasonLabel,
  parseListingRef,
  sellingRestoredNotice,
  sellingSuspendedNotice,
  MODERATION_MESSAGE_MAX,
} from "~/shared/moderation";
import { isAvailable, unavailableReason } from "~/shared/card-availability";
import { isListable } from "~/shared/listing-lifecycle";
import { categoryForKind } from "~/shared/push";
import { PERMISSION_KEYS, BUILTIN_ROLES } from "~/shared/staff";

describe("listing report reasons", () => {
  it("covers counterfeit, prohibited, misdescribed and stolen", () => {
    const values = LISTING_REPORT_REASONS.map((r) => r.value);
    for (const v of ["listing_counterfeit", "listing_prohibited", "listing_misdescribed", "listing_stolen"]) {
      assert.ok(values.includes(v as any), v);
    }
  });

  it("recognises only its own reasons", () => {
    assert.equal(isListingReportType("listing_counterfeit"), true);
    assert.equal(isListingReportType("scam_seller"), false);
    assert.equal(isListingReportType(undefined), false);
  });

  it("labels the suspension reason", () => {
    assert.equal(listingReasonLabel("seller_suspended"), "Seller suspended");
    assert.equal(listingReasonLabel("listing_counterfeit"), "Fake or counterfeit");
  });
});

describe("a hidden listing", () => {
  const live = { sold: false, status: "active", listedAt: Date.now() };

  it("can't be bought, and says why", () => {
    assert.equal(isAvailable({ ...live, hidden: true }), false);
    assert.equal(unavailableReason({ ...live, hidden: true }), "removed");
    assert.equal(isAvailable({ ...live, hidden: false }), true);
  });

  it("still reads as sold once it sold", () => {
    assert.equal(unavailableReason({ ...live, sold: true, hidden: true }), "sold");
  });

  it("is off the marketplace", () => {
    assert.equal(isListable({ ...live, hidden: true }), false);
    assert.equal(isListable(live), true);
  });

  it("is only hidden when the flag is exactly true", () => {
    assert.equal(isHiddenByStaff({ hidden: true }), true);
    assert.equal(isHiddenByStaff({ hidden: false }), false);
    assert.equal(isHiddenByStaff(null), false);
  });
});

describe("selling suspension", () => {
  it("reads the server-written flag", () => {
    assert.equal(isSellingSuspended({ sellingSuspended: true }), true);
    assert.equal(isSellingSuspended({}), false);
    assert.equal(isSellingSuspended(null), false);
  });
});

describe("parseListingRef", () => {
  it("reads full links and paths", () => {
    assert.deepEqual(parseListingRef("https://tcgo.shop/cards/abc123XYZ"), { kind: "card", id: "abc123XYZ" });
    assert.deepEqual(parseListingRef("/auctions/Qw3rtyUiop?x=1"), { kind: "auction", id: "Qw3rtyUiop" });
  });

  it("refuses a bare id, which doesn't say which collection", () => {
    assert.equal(parseListingRef("abc123XYZ"), null);
    assert.equal(parseListingRef(""), null);
  });
});

describe("what the seller is told", () => {
  it("names the reason and carries the staff message", () => {
    const n = listingHiddenNotice({
      kind: "card",
      id: "c1",
      title: "Charizard ex",
      reason: "listing_counterfeit",
      message: "The holo pattern is wrong for this set.",
    });
    assert.equal(n.kind, "listing_hidden");
    assert.equal(n.audience, "seller");
    assert.match(n.title, /Charizard ex/);
    assert.match(n.body, /Fake or counterfeit/);
    assert.match(n.body, /holo pattern/);
  });

  it("counts the listings a suspension hid and restored", () => {
    assert.match(sellingSuspendedNotice({ message: "x", hiddenCount: 3 }).body, /3 live listings are hidden/);
    assert.match(sellingSuspendedNotice({ message: "x", hiddenCount: 1 }).body, /1 live listing is hidden/);
    assert.match(sellingRestoredNotice({ restoredCount: 2 }).body, /2 listings back/);
  });

  it("pushes under the orders switch", () => {
    for (const k of ["listing_hidden", "listing_restored", "selling_suspended", "selling_restored"] as const) {
      assert.equal(categoryForKind(k), "orders");
    }
  });

  it("bounds and tidies the staff message", () => {
    assert.equal(cleanModerationMessage("  two\n\nlines  "), "two lines");
    assert.equal(cleanModerationMessage("x".repeat(1000)).length, MODERATION_MESSAGE_MAX);
  });
});

describe("staff permission", () => {
  it("exists and the Staff role has it by default", () => {
    assert.ok(PERMISSION_KEYS.includes("listings.moderate"));
    assert.ok(BUILTIN_ROLES.find((r) => r.id === "staff")!.permissions.includes("listings.moderate"));
  });
});
