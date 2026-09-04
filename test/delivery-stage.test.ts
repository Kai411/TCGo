// Where a parcel is, and which orders are parcels at all.
//
// The expensive bug this guards: a merged child stayed in the seller's queue
// with its own "book courier" button, so a combined parcel got a second label
// and the platform paid for it — while the buyer had paid RM 1.25 to combine.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  BUYER_TIMELINE,
  timelineIndex,
  deliveryStage,
  deliveryStageLabel,
  isOnItsWay,
  withoutMergedChildren,
} from "~/shared/delivery-stage";

describe("merged children are not parcels", () => {
  it("drops them from a list", () => {
    const list = [
      { id: "parent", status: "paid" },
      { id: "child", status: "cancelled", mergedInto: "parent" },
      { id: "other", status: "shipped" },
    ] as any[];
    assert.deepEqual(withoutMergedChildren(list).map((o) => o.id), ["parent", "other"]);
  });

  it("keeps a genuinely cancelled order", () => {
    // Cancelled and merged are different things; only one is a duplicate view
    // of another parcel.
    const list = [{ id: "a", status: "cancelled" }] as any[];
    assert.equal(withoutMergedChildren(list).length, 1);
  });

  it("labels one Combined rather than implying a delivery", () => {
    assert.equal(deliveryStageLabel({ status: "cancelled", mergedInto: "p" }), "Combined");
  });
});

describe("stages after payment", () => {
  it("is Preparing before a label exists", () => {
    assert.equal(deliveryStage({ status: "paid" }), "preparing");
  });

  it("is Ready to ship once the label is bought", () => {
    assert.equal(deliveryStage({ status: "paid", shipmentOrderNo: "DLV1" }), "ready");
  });

  it("is Collected when the courier has it and nothing finer is known", () => {
    assert.equal(deliveryStage({ status: "shipped" }), "collected");
  });

  it("splits collected from in transit once a code arrives", () => {
    assert.equal(deliveryStage({ status: "shipped", shipmentStatusCode: 500 }), "collected");
    assert.equal(deliveryStage({ status: "shipped", shipmentStatusCode: 549 }), "collected");
    assert.equal(deliveryStage({ status: "shipped", shipmentStatusCode: 550 }), "in_transit");
    assert.equal(deliveryStage({ status: "shipped", shipmentStatusCode: 699 }), "in_transit");
  });

  it("is Delivered at the delivered code, and by status alone", () => {
    assert.equal(deliveryStage({ status: "shipped", shipmentStatusCode: 700 }), "delivered");
    assert.equal(deliveryStage({ status: "delivered" }), "delivered");
  });

  it("never walks a delivered order backwards on a stale code", () => {
    // The order status is the record; a lagging tracking read must not undo it.
    assert.equal(deliveryStage({ status: "delivered", shipmentStatusCode: 500 }), "delivered");
  });

  it("treats a cancelled shipment code as cancelled", () => {
    assert.equal(deliveryStage({ status: "shipped", shipmentStatusCode: 900 }), "cancelled");
    assert.equal(deliveryStage({ status: "shipped", shipmentStatusCode: 99 }), "cancelled");
  });

  it("shows awaiting payment before money is in", () => {
    assert.equal(deliveryStage({ status: "pending" }), "awaiting_payment");
    assert.equal(deliveryStage({ status: "confirmed" }), "awaiting_payment");
  });

  it("survives a missing order", () => {
    assert.equal(deliveryStage(null), "preparing");
    assert.equal(deliveryStage({}), "preparing");
  });
});

describe("what counts as on its way", () => {
  it("covers label-bought through in transit", () => {
    assert.equal(isOnItsWay({ status: "paid", shipmentOrderNo: "X" }), true);
    assert.equal(isOnItsWay({ status: "shipped" }), true);
    assert.equal(isOnItsWay({ status: "shipped", shipmentStatusCode: 600 }), true);
  });

  it("excludes both ends", () => {
    assert.equal(isOnItsWay({ status: "paid" }), false);
    assert.equal(isOnItsWay({ status: "delivered" }), false);
    assert.equal(isOnItsWay({ status: "cancelled" }), false);
  });
});

describe("the buyer's timeline", () => {
  it("advances with the parcel", () => {
    const at = (o: any) => BUYER_TIMELINE[timelineIndex(o)]?.label;
    assert.equal(at({ status: "paid" }), "Arranging delivery");
    assert.equal(at({ status: "paid", shipmentOrderNo: "DLV1" }), "Arranging delivery");
    assert.equal(at({ status: "shipped" }), "Collected");
    assert.equal(at({ status: "shipped", shipmentStatusCode: 600 }), "In transit");
    assert.equal(at({ status: "delivered" }), "Delivered");
  });

  it("collapses ready and preparing into one step", () => {
    // Whether a label has been bought is a seller's concern. To a buyer both
    // mean the parcel has not moved.
    assert.equal(
      timelineIndex({ status: "paid" }),
      timelineIndex({ status: "paid", shipmentOrderNo: "DLV1" }),
    );
  });

  it("puts nothing on the timeline before payment or after cancelling", () => {
    assert.equal(timelineIndex({ status: "pending" }), -1);
    assert.equal(timelineIndex({ status: "cancelled" }), -1);
  });

  it("only ever moves forward through the listed steps", () => {
    const seen = [
      { status: "paid" },
      { status: "shipped" },
      { status: "shipped", shipmentStatusCode: 600 },
      { status: "delivered" },
    ].map(timelineIndex);
    assert.deepEqual(seen, [...seen].sort((a, b) => a - b), "timeline went backwards");
    assert.ok(Math.max(...seen) < BUYER_TIMELINE.length, "index off the end");
  });
});
