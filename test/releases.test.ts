// Release notes are the one thing we write FOR users and ship verbatim.
//
// The interesting test here is the vocabulary one. A note is written in a
// hurry, next to the code that prompted it, and the natural thing to reach for
// is the language of the change — the service, the table, the job, the
// provider. That is our operations, and it should not leave the repository.
// The rule is worth enforcing rather than remembering.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  APP_VERSION,
  MAX_SHOWN,
  RELEASES,
  compareVersions,
  unseenReleases,
} from "~/shared/releases";

/**
 * Words that describe how TCGo is built or run, not what it does.
 *
 * Vendors, stores, jobs, and internal money handling. Matched whole-word and
 * case-insensitively against every note we would show someone.
 */
const FORBIDDEN = [
  // Vendors and services
  "supabase", "firebase", "firestore", "stripe", "billplz", "hitpay", "didit",
  "delyva", "tcgcsv", "tcgplayer", "netlify", "mailtrap", "nuxt", "vue",
  // Infrastructure and operations
  "cron", "webhook", "endpoint", "api", "database", "schema", "migration",
  "deploy", "server", "cache", "index", "query", "rpc", "backend", "sdk",
  "repository", "commit", "branch", "build",
  // Internal money handling
  "commission", "payout", "settlement", "platform fee", "margin", "escrow",
];

const allNotes = RELEASES.flatMap((r) => [r.title, ...r.notes]);

describe("release notes say nothing about how it works", () => {
  it("names no service, store, job or internal money term", () => {
    for (const note of allNotes) {
      for (const word of FORBIDDEN) {
        const pattern = new RegExp(`\\b${word.replace(/ /g, "\\s+")}\\b`, "i");
        assert.ok(
          !pattern.test(note),
          `"${word}" appears in a user-facing release note: ${note}`,
        );
      }
    }
  });

  it("reads like a sentence to a person", () => {
    for (const note of allNotes) {
      assert.ok(note.trim().length > 0, "empty note");
      assert.ok(note.length <= 160, `too long to scan: ${note}`);
      // A note is a statement, not a symbol or a path.
      assert.ok(!/[{}<>#]|\.\w{2,3}\b|\//.test(note), `looks like code: ${note}`);
    }
  });
});

describe("the shape of the log", () => {
  it("is newest first", () => {
    for (let i = 1; i < RELEASES.length; i++) {
      assert.ok(
        compareVersions(RELEASES[i - 1]!.version, RELEASES[i]!.version) > 0,
        `${RELEASES[i - 1]!.version} should sort above ${RELEASES[i]!.version}`,
      );
    }
  });

  it("reports the newest version as the app's", () => {
    assert.equal(APP_VERSION, RELEASES[0]!.version);
  });

  it("has no duplicate versions and real dates", () => {
    const seen = new Set<string>();
    for (const r of RELEASES) {
      assert.ok(!seen.has(r.version), `duplicate version ${r.version}`);
      seen.add(r.version);
      assert.match(r.date, /^\d{4}-\d{2}-\d{2}$/, r.date);
      assert.ok(!Number.isNaN(new Date(r.date).getTime()), r.date);
      assert.ok(r.notes.length > 0, `${r.version} has no notes`);
    }
  });
});

describe("version ordering", () => {
  it("compares numerically, not as text", () => {
    // The bug this exists for: "1.10.0" < "1.9.0" as strings.
    assert.ok(compareVersions("1.10.0", "1.9.0") > 0);
    assert.ok(compareVersions("2.0.0", "1.99.99") > 0);
    assert.equal(compareVersions("1.1.0", "1.1.0"), 0);
  });

  it("treats a missing segment as zero", () => {
    assert.equal(compareVersions("1.1", "1.1.0"), 0);
    assert.ok(compareVersions("1.1.1", "1.1") > 0);
  });
});

describe("what someone is shown", () => {
  it("shows only the current release to someone with nothing stored", () => {
    // Brand-new visitor, or someone who was here before this existed. The
    // whole history would be noise; nothing at all would waste the release
    // they actually missed.
    const shown = unseenReleases(null);
    assert.equal(shown.length, 1);
    assert.equal(shown[0]!.version, APP_VERSION);
  });

  it("shows nothing to someone already on the current version", () => {
    assert.deepEqual(unseenReleases(APP_VERSION), []);
  });

  it("shows what they missed after being away", () => {
    const oldest = RELEASES[RELEASES.length - 1]!.version;
    const shown = unseenReleases(oldest);
    assert.ok(shown.length >= 1);
    assert.ok(
      shown.every((r) => compareVersions(r.version, oldest) > 0),
      "showed a release they had already seen",
    );
  });

  it("never shows more than a screenful", () => {
    assert.ok(unseenReleases("0.0.1").length <= MAX_SHOWN);
  });

  it("survives a stored version we do not recognise", () => {
    // Storage is the user's, and it can hold anything.
    assert.doesNotThrow(() => unseenReleases("banana"));
    assert.doesNotThrow(() => unseenReleases(""));
    assert.doesNotThrow(() => unseenReleases("999.0.0"));
    assert.deepEqual(unseenReleases("999.0.0"), []);
  });
});
