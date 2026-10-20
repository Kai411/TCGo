// The 24-hour hold on payouts and bank details after a password change.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  CREATION_GRACE_MS,
  SECURITY_LOCK_MS,
  formatLockTime,
  lastSecurityChange,
  lockedUntil,
  lockMessage,
} from "~/shared/security-lock";

const HOUR = 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 20, 6); // 2:00 pm in Malaysia
const CREATED = NOW - 90 * 24 * HOUR;

describe("lockedUntil", () => {
  it("is off for an account that never changed its password", () => {
    assert.equal(lockedUntil({ createdAt: CREATED, tokensValidAfter: CREATED }, NOW), null);
    assert.equal(lockedUntil({}, NOW), null);
  });

  it("ignores Firebase's session time from the moment of sign-up", () => {
    const fresh = NOW - 2 * HOUR;
    assert.equal(
      lockedUntil({ createdAt: fresh, tokensValidAfter: fresh + CREATION_GRACE_MS - 1 }, NOW),
      null,
    );
  });

  it("holds for 24 hours after a reset through the emailed link", () => {
    const reset = NOW - 3 * HOUR;
    assert.equal(
      lockedUntil({ createdAt: CREATED, tokensValidAfter: reset }, NOW),
      reset + SECURITY_LOCK_MS,
    );
  });

  it("holds for 24 hours after a change the server recorded", () => {
    const changed = NOW - HOUR;
    assert.equal(
      lockedUntil({ createdAt: CREATED, passwordChangedAt: changed }, NOW),
      changed + SECURITY_LOCK_MS,
    );
  });

  it("takes the later of the two times", () => {
    const a = NOW - 5 * HOUR;
    const b = NOW - 2 * HOUR;
    assert.equal(lastSecurityChange({ createdAt: CREATED, passwordChangedAt: a, tokensValidAfter: b }), b);
    assert.equal(lastSecurityChange({ createdAt: CREATED, passwordChangedAt: b, tokensValidAfter: a }), b);
  });

  it("lifts once the day has passed", () => {
    assert.equal(
      lockedUntil({ createdAt: CREATED, tokensValidAfter: NOW - SECURITY_LOCK_MS }, NOW),
      null,
    );
  });

  it("treats junk as no record", () => {
    assert.equal(
      lockedUntil({ passwordChangedAt: NaN, tokensValidAfter: "x" as unknown as number }, NOW),
      null,
    );
  });
});

describe("lock wording", () => {
  it("names the time in Malaysia", () => {
    assert.equal(formatLockTime(Date.UTC(2026, 9, 21, 7, 40)), "21 Oct, 3:40 pm");
    assert.match(lockMessage(Date.UTC(2026, 9, 21, 7, 40)), /locked until 21 Oct, 3:40 pm/);
  });
});
