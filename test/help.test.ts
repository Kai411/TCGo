// The Help guide's content: every article reachable by one slug, every link
// pointing at a page that exists, and none of the words the guide promises
// to avoid (fee rates belong on /pricing, "escrow" is not what TCGo offers).

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";

import { HELP_TOPICS, findHelpArticle, searchHelp } from "~/shared/help";

const articles = HELP_TOPICS.flatMap((t) => t.articles);

const pageExists = (to: string) => {
  const path = to.split("?")[0].replace(/\/$/, "");
  if (!path) return existsSync("pages/index.vue");
  return existsSync(`pages${path}.vue`) || existsSync(`pages${path}/index.vue`);
};

describe("help content", () => {
  it("gives every article a unique slug", () => {
    const slugs = articles.map((a) => a.slug);
    assert.equal(new Set(slugs).size, slugs.length);
  });

  it("gives every article steps", () => {
    for (const a of articles) assert.ok(a.steps.length > 0, a.slug);
  });

  it("links only to pages that exist", () => {
    for (const a of articles) {
      for (const l of a.links ?? []) assert.ok(pageExists(l.to), `${a.slug} → ${l.to}`);
    }
  });

  it("never says escrow or quotes a fee rate", () => {
    for (const a of articles) {
      const text = [a.title, a.summary, ...a.steps, ...(a.notes ?? [])].join(" ");
      assert.doesNotMatch(text, /escrow/i, a.slug);
      assert.doesNotMatch(text, /\d\s*%/, a.slug);
    }
  });

  it("finds articles by slug and by words", () => {
    assert.equal(findHelpArticle("bid")?.topic.id, "auctions");
    assert.equal(findHelpArticle("nope"), null);
    assert.ok(searchHelp("payout").some((a) => a.slug === "get-paid"));
    assert.deepEqual(searchHelp("   "), []);
  });
});
