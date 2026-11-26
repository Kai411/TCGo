// The clear-test-data workflow must never delete user data, whatever is typed
// into it, and must not delete at all without the phrase and the project id.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  CLEARABLE,
  PROTECTED,
  DEFAULT_SELECTION,
  CONFIRM_PHRASE,
  parseSelection,
  deleteBlockers,
  relatedWarnings,
  permissionHint,
} from "../scripts/lib/clear-firebase.mjs";

const RULES = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
const WORKFLOW = readFileSync(
  new URL("../.github/workflows/clear-firebase-test-data.yml", import.meta.url),
  "utf8",
);

describe("clear-firebase classification", () => {
  it("never lists a collection as both clearable and protected", () => {
    for (const name of Object.keys(PROTECTED)) assert.ok(!Object.hasOwn(CLEARABLE, name), name);
  });

  it("protects accounts and what people keep for themselves", () => {
    for (const name of ["users", "accountSecurity", "userCollection", "favourites", "staff"]) {
      assert.ok(Object.hasOwn(PROTECTED, name), name);
    }
  });

  it("names every top-level collection in firestore.rules", () => {
    const top = [...RULES.matchAll(/^ {4}match \/([A-Za-z]+)\/\{/gm)].map((m) => m[1]);
    assert.ok(top.length > 10);
    for (const name of top) {
      assert.ok(Object.hasOwn(CLEARABLE, name) || Object.hasOwn(PROTECTED, name), `${name} is unclassified`);
    }
  });

  it("the workflow's default list is the suggested selection and is all clearable", () => {
    const m = WORKFLOW.match(/collections:[\s\S]*?default: "([^"]+)"/);
    assert.ok(m);
    assert.deepEqual(m[1].split(","), DEFAULT_SELECTION);
    assert.deepEqual(parseSelection(m[1]).refused, []);
  });

  it("the workflow runs only by hand", () => {
    assert.match(WORKFLOW, /^on:\n {2}workflow_dispatch:/m);
    assert.doesNotMatch(WORKFLOW, /^ {2}(push|pull_request|schedule):/m);
  });
});

describe("parseSelection", () => {
  it("splits on commas and spaces and drops repeats", () => {
    assert.deepEqual(parseSelection(" cards, inventory  cards,,").collections, ["cards", "inventory"]);
  });

  it("refuses user data even mixed in with clearable names", () => {
    const r = parseSelection("compiledOrders,users,favourites");
    assert.deepEqual(r.refused, ["users", "favourites"]);
    assert.deepEqual(r.collections, ["compiledOrders"]);
  });

  it("flags names it does not know, including wrong case", () => {
    assert.deepEqual(parseSelection("Users,cardz").unknown, ["Users", "cardz"]);
  });

  it("does not treat object built-ins as collections", () => {
    assert.deepEqual(parseSelection("constructor,__proto__,toString").unknown, [
      "constructor",
      "__proto__",
      "toString",
    ]);
  });

  it("returns nothing for empty input", () => {
    assert.deepEqual(parseSelection(undefined).collections, []);
  });
});

describe("deleteBlockers", () => {
  const ok = { mode: "delete", confirm: CONFIRM_PHRASE, typedProject: "p1", keyProject: "p1", ref: "refs/heads/staging" };

  it("lets a dry run through with nothing typed", () => {
    assert.deepEqual(deleteBlockers({ mode: "dry-run", keyProject: "p1", ref: "refs/heads/x" }), []);
  });

  it("lets a fully confirmed delete on staging through", () => {
    assert.deepEqual(deleteBlockers(ok), []);
  });

  it("needs the exact phrase", () => {
    assert.equal(deleteBlockers({ ...ok, confirm: "delete test data" }).length, 1);
    assert.equal(deleteBlockers({ ...ok, confirm: "" }).length, 1);
  });

  it("needs the key's project typed exactly", () => {
    assert.equal(deleteBlockers({ ...ok, typedProject: "p2" }).length, 1);
    assert.equal(deleteBlockers({ ...ok, typedProject: "" }).length, 1);
  });

  it("refuses a delete from any branch but staging", () => {
    assert.equal(deleteBlockers({ ...ok, ref: "refs/heads/claude/x" }).length, 1);
  });

  it("skips the branch check when run by hand (no ref)", () => {
    assert.deepEqual(deleteBlockers({ ...ok, ref: undefined }), []);
  });
});

describe("relatedWarnings and permissionHint", () => {
  it("warns when orders go but payouts stay", () => {
    assert.match(relatedWarnings(["compiledOrders"])[0], /payouts/);
    assert.deepEqual(relatedWarnings(["compiledOrders", "payouts", "refunds", "orderProblems"]), []);
  });

  it("names the missing role on a permission error", () => {
    assert.match(permissionHint({ code: 7, message: "7 PERMISSION_DENIED: Missing" }, "firestore"), /roles\/datastore\.user/);
    assert.match(permissionHint({ message: "Permission denied" }, "rtdb"), /firebasedatabase\.admin/);
    assert.equal(permissionHint({ message: "socket hang up" }, "firestore"), null);
  });
});
