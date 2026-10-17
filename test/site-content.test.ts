// Banners and microsites: links must stay inside the app, slugs must be
// addressable, and article text must parse into plain blocks.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  idFromInput,
  normaliseLinkPath,
  parseArticle,
  slugify,
  validateBanner,
  validateMicrosite,
} from "~/shared/site-content";

const HOSTS = ["tcgo.shop", "tcgo-staging.netlify.app"];
const IMG = "https://res.cloudinary.com/demo/image/upload/v1/poketcg-auctions/a.webp";

describe("normaliseLinkPath", () => {
  it("keeps in-app paths and adds a leading slash", () => {
    assert.equal(normaliseLinkPath("/auctions", HOSTS), "/auctions");
    assert.equal(normaliseLinkPath("auctions", HOSTS), "/auctions");
    assert.equal(normaliseLinkPath("/cards/abc?x=1#y", HOSTS), "/cards/abc?x=1#y");
    assert.equal(normaliseLinkPath("  ", HOSTS), "");
  });

  it("keeps only the path of a pasted TCGo address", () => {
    assert.equal(normaliseLinkPath("https://tcgo.shop/cards/abc", HOSTS), "/cards/abc");
    assert.equal(normaliseLinkPath("https://TCGO.shop/p/sale", HOSTS), "/p/sale");
  });

  it("rejects anything that leaves the app", () => {
    for (const bad of [
      "https://evil.com/cards/abc",
      "//evil.com",
      "/\\evil.com",
      "javascript:alert(1)",
      "data:text/html,hi",
      "mailto:a@b.c",
      "/cards/a b",
    ]) {
      assert.equal(normaliseLinkPath(bad, HOSTS), null, bad);
    }
  });
});

describe("idFromInput", () => {
  it("takes an ID or the last segment of a pasted link", () => {
    assert.equal(idFromInput("abc123"), "abc123");
    assert.equal(idFromInput("https://tcgo.shop/auctions/XyZ_9/?ref=1"), "XyZ_9");
    assert.equal(idFromInput("not an id!"), "");
  });
});

describe("slugify", () => {
  it("makes a lowercase dashed address", () => {
    assert.equal(slugify("Weekend Auction Drop!"), "weekend-auction-drop");
    assert.equal(slugify("  Pokémon — Raya Sale  "), "pokemon-raya-sale");
  });
});

describe("validateBanner", () => {
  it("accepts a linked image banner", () => {
    const r = validateBanner({ visible: true, imageUrl: IMG, headline: " Drop ", linkPath: "/auctions" }, HOSTS);
    assert.ok("banner" in r);
    assert.equal(r.banner.headline, "Drop");
    assert.equal(r.banner.linkPath, "/auctions");
  });

  it("refuses an external link or a foreign image", () => {
    assert.ok("error" in validateBanner({ imageUrl: IMG, linkPath: "https://evil.com" }, HOSTS));
    assert.ok("error" in validateBanner({ imageUrl: "https://evil.com/a.png" }, HOSTS));
  });

  it("refuses to show an empty banner but saves a hidden one", () => {
    assert.ok("error" in validateBanner({ visible: true }, HOSTS));
    assert.ok("banner" in validateBanner({ visible: false }, HOSTS));
  });
});

describe("validateMicrosite", () => {
  it("needs a usable slug and a title", () => {
    assert.ok("error" in validateMicrosite({ slug: "Bad Slug", title: "x" }));
    assert.ok("error" in validateMicrosite({ slug: "-x", title: "x" }));
    assert.ok("error" in validateMicrosite({ slug: "ok", title: " " }));
    assert.ok("microsite" in validateMicrosite({ slug: "ok", title: "Ok" }));
  });

  it("won't publish an empty page", () => {
    assert.ok("error" in validateMicrosite({ slug: "a", title: "A", type: "image", published: true }));
    assert.ok("error" in validateMicrosite({ slug: "a", title: "A", type: "article", published: true }));
    const r = validateMicrosite({ slug: "a", title: "A", type: "article", body: "Hi", published: true });
    assert.ok("microsite" in r && r.microsite.published);
  });

  it("drops article text from an image page", () => {
    const r = validateMicrosite({ slug: "a", title: "A", type: "image", imageUrl: IMG, body: "x" });
    assert.ok("microsite" in r);
    assert.equal(r.microsite.body, "");
  });
});

describe("parseArticle", () => {
  it("splits headings, paragraphs and lists", () => {
    const blocks = parseArticle("# Title\nIntro line one\nline two\n\n## Rules\n- one\n- two\nAfter");
    assert.deepEqual(blocks, [
      { kind: "h2", text: "Title" },
      { kind: "p", text: "Intro line one\nline two" },
      { kind: "h3", text: "Rules" },
      { kind: "ul", items: ["one", "two"] },
      { kind: "p", text: "After" },
    ]);
  });

  it("keeps markup as plain text", () => {
    assert.deepEqual(parseArticle("<script>x</script>"), [{ kind: "p", text: "<script>x</script>" }]);
  });
});
