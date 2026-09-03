// The address book, and the mirror that keeps checkout working.
//
// The flat `delivery*` fields are still read by the cart, the order page and
// the onboarding gate. The list is the source of truth and those fields are a
// copy of whichever entry is default — so the invariant worth protecting is
// that there is always exactly one default, and that the mirror follows it.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  MAX_ADDRESSES,
  defaultAddress,
  formatAddress,
  fromFlatFields,
  isCompleteAddress,
  newAddressId,
  removeAddress,
  toFlatFields,
  upsertAddress,
  withDefault,
  type Address,
} from "~/shared/addresses";
import { hasDeliveryAddress } from "~/shared/onboarding";

const make = (over: Partial<Address> = {}): Address => ({
  id: over.id ?? newAddressId(),
  name: "Kai",
  phone: "0129224545",
  line1: "M Vertica Residence, No.555, Jln Cheras",
  line2: "D-46-13A",
  postcode: "56000",
  city: "Kuala Lumpur",
  state: "kul",
  ...over,
});

describe("completeness", () => {
  it("accepts an address a courier could deliver to", () => {
    assert.equal(isCompleteAddress(make()), true);
  });

  it("does not demand a unit line", () => {
    assert.equal(isCompleteAddress(make({ line2: "" })), true);
  });

  it("rejects a missing field", () => {
    for (const k of ["name", "phone", "line1", "postcode", "city", "state"] as const) {
      assert.equal(isCompleteAddress(make({ [k]: "" })), false, `${k} required`);
    }
  });

  it("rejects whitespace", () => {
    assert.equal(isCompleteAddress(make({ city: "   " })), false);
  });
});

describe("exactly one default, always", () => {
  it("makes the first address default without being asked", () => {
    const list = upsertAddress([], make({ id: "a" }));
    assert.equal(list[0]!.isDefault, true);
  });

  it("moves the flag rather than adding a second", () => {
    let list = upsertAddress([], make({ id: "a" }));
    list = upsertAddress(list, make({ id: "b" }));
    list = withDefault(list, "b");
    assert.deepEqual(
      list.map((a) => [a.id, !!a.isDefault]),
      [["a", false], ["b", true]],
    );
    assert.equal(list.filter((a) => a.isDefault).length, 1);
  });

  it("honours a new address that asks to be default", () => {
    let list = upsertAddress([], make({ id: "a" }));
    list = upsertAddress(list, make({ id: "b", isDefault: true }));
    assert.equal(defaultAddress(list)?.id, "b");
    assert.equal(list.filter((a) => a.isDefault).length, 1);
  });

  it("edits in place rather than duplicating", () => {
    let list = upsertAddress([], make({ id: "a", city: "Puchong" }));
    list = upsertAddress(list, make({ id: "a", city: "Kajang" }));
    assert.equal(list.length, 1);
    assert.equal(list[0]!.city, "Kajang");
  });

  it("promotes a replacement when the default is deleted", () => {
    let list = upsertAddress([], make({ id: "a" }));
    list = upsertAddress(list, make({ id: "b" }));
    assert.equal(defaultAddress(list)?.id, "a");
    const after = removeAddress(list, "a");
    assert.equal(after.length, 1);
    assert.equal(after[0]!.isDefault, true, "the survivor must become default");
  });

  it("survives deleting the last one", () => {
    const list = upsertAddress([], make({ id: "a" }));
    assert.deepEqual(removeAddress(list, "a"), []);
    assert.equal(defaultAddress([]), null);
  });

  it("falls back to the first when no flag is set", () => {
    // A checkout saying "no address" while showing three is worse than
    // picking the top one.
    const list = [make({ id: "a" }), make({ id: "b" })];
    assert.equal(defaultAddress(list)?.id, "a");
  });
});

describe("the mirror the cart still reads", () => {
  it("copies the default into the flat fields", () => {
    const a = make({ id: "a" });
    const flat = toFlatFields(a);
    assert.equal(flat.deliveryName, "Kai");
    assert.equal(flat.deliveryAddress1, "M Vertica Residence, No.555, Jln Cheras");
    assert.equal(flat.deliveryPostcode, "56000");
    assert.equal(flat.deliveryState, "kul");
  });

  it("produces a shape the onboarding gate accepts", () => {
    // If these disagreed, saving an address would leave the gate still
    // demanding one — an unfinishable loop.
    assert.equal(hasDeliveryAddress(toFlatFields(make())), true);
  });

  it("writes empty strings, never undefined, for no address", () => {
    // Firestore rejects undefined, so a null default must still produce a
    // writable object.
    const flat = toFlatFields(null);
    assert.equal(Object.values(flat).every((v) => v === ""), true);
    assert.equal(hasDeliveryAddress(flat), false);
  });
});

describe("migrating the old single address", () => {
  const legacy = {
    deliveryName: "Kai",
    deliveryPhone: "0129224545",
    deliveryAddress1: "M Vertica Residence",
    deliveryAddress2: "D-46-13A",
    deliveryPostcode: "56000",
    deliveryCity: "Kuala Lumpur",
    deliveryState: "kul",
  };

  it("becomes the first card, marked default", () => {
    const a = fromFlatFields(legacy)!;
    assert.ok(a);
    assert.equal(a.isDefault, true);
    assert.equal(a.name, "Kai");
    assert.equal(a.line2, "D-46-13A");
  });

  it("round-trips without losing anything", () => {
    assert.deepEqual(toFlatFields(fromFlatFields(legacy)), legacy);
  });

  it("returns null rather than storing a blank card", () => {
    assert.equal(fromFlatFields({}), null);
    assert.equal(fromFlatFields(null), null);
    assert.equal(fromFlatFields({ ...legacy, deliveryPostcode: "" }), null);
  });
});

describe("details", () => {
  it("gives every address a distinct id", () => {
    const ids = new Set(Array.from({ length: 50 }, () => newAddressId()));
    assert.equal(ids.size, 50);
  });

  it("formats one line, skipping what's absent", () => {
    assert.equal(
      formatAddress(make({ line2: "" })),
      "M Vertica Residence, No.555, Jln Cheras, 56000, Kuala Lumpur",
    );
  });

  it("caps the book at a browsable size", () => {
    assert.ok(MAX_ADDRESSES >= 3 && MAX_ADDRESSES <= 20);
  });
});
