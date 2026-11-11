// Banners and microsites: links must stay inside the app, slugs must be
// addressable, and article text must parse into plain blocks.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  idFromInput,
  normaliseLinkPath,
  parseArticle,
  slugify,
  normaliseBanner,
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
  const slide = (x: Record<string, unknown> = {}) => ({ id: "a1", imageUrl: IMG, headline: "", subtext: "", linkPath: "", ...x });

  it("keeps several banners in order", () => {
    const r = validateBanner(
      { visible: true, slides: [slide({ headline: " Drop ", linkPath: "/auctions" }), slide({ id: "b2" })] },
      HOSTS,
    );
    assert.ok("banner" in r);
    assert.deepEqual(r.banner.slides.map((s) => s.id), ["a1", "b2"]);
    assert.equal(r.banner.slides[0]!.headline, "Drop");
    assert.equal(r.banner.slides[0]!.linkPath, "/auctions");
  });

  it("refuses an external link or a foreign image, naming the banner", () => {
    const r = validateBanner({ slides: [slide(), slide({ linkPath: "https://evil.com" })] }, HOSTS);
    assert.ok("error" in r && r.error.includes("banner 2"));
    assert.ok("error" in validateBanner({ slides: [slide({ imageUrl: "https://evil.com/a.png" })] }, HOSTS));
  });

  it("refuses an empty banner, too many, or showing none", () => {
    assert.ok("error" in validateBanner({ slides: [slide({ imageUrl: "" })] }, HOSTS));
    assert.ok("error" in validateBanner({ slides: Array.from({ length: 9 }, () => slide()) }, HOSTS));
    assert.ok("error" in validateBanner({ visible: true, slides: [] }, HOSTS));
    assert.ok("banner" in validateBanner({ visible: false, slides: [] }, HOSTS));
  });
});

describe("normaliseBanner", () => {
  it("turns a banner saved before rotation into one slide", () => {
    const b = normaliseBanner({ visible: true, imageUrl: IMG, headline: "Old", subtext: "", linkPath: "/" });
    assert.equal(b.visible, true);
    assert.equal(b.slides.length, 1);
    assert.equal(b.slides[0]!.headline, "Old");
  });

  it("handles a missing or empty doc", () => {
    assert.deepEqual(normaliseBanner(undefined), { visible: false, slides: [] });
    assert.deepEqual(normaliseBanner({ visible: false, imageUrl: "", headline: "" }).slides, []);
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
