// eBay listings: the search built from a catalogue card, and how Browse API
// results are shaped for the card price page.

import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  EBAY_IMAGE_HOST,
  ebayImageUrl,
  ebayQuery,
  ebaySearchUrl,
  toEbayListing,
} from "~/shared/ebay";

describe("ebay search query", () => {
  it("uses the name and printed number", () => {
    assert.equal(
      ebayQuery({ name: "Charizard ex", number: "199/165", language: "English" }),
      "Charizard ex 199/165",
    );
  });

  it("drops the catalogue's qualifier and brackets", () => {
    assert.equal(
      ebayQuery({ name: "Pikachu - 2006 (Jason Klaczynski)", number: null }),
      "Pikachu",
    );
    assert.equal(ebayQuery({ name: "Umbreon [Holo]" }), "Umbreon Holo");
  });

  it("doesn't repeat a number already in the name", () => {
    assert.equal(ebayQuery({ name: "Mew 151/165", number: "151/165" }), "Mew 151/165");
  });

  it("marks Japanese printings", () => {
    assert.equal(
      ebayQuery({ name: "Pikachu", number: "001", language: "Japanese" }),
      "Pikachu 001 Japanese",
    );
  });

  it("stays within eBay's 100-character limit", () => {
    assert.ok(ebayQuery({ name: "x".repeat(300), number: "1/1" }).length <= 100);
  });

  it("links to the same search in the card singles category", () => {
    const url = new URL(ebaySearchUrl("Charizard ex 199/165"));
    assert.equal(url.hostname, "www.ebay.com");
    assert.equal(url.searchParams.get("_nkw"), "Charizard ex 199/165");
    assert.equal(url.searchParams.get("_sacat"), "183454");
  });
});

describe("ebay listing shape", () => {
  const raw = {
    itemId: "v1|1234|0",
    title: "Charizard ex 199/165 SIR Pokemon 151",
    itemWebUrl: "https://www.ebay.com/itm/1234",
    thumbnailImages: [{ imageUrl: "https://i.ebayimg.com/thumbs/a.jpg" }],
    image: { imageUrl: "https://i.ebayimg.com/images/a.jpg" },
    condition: "Ungraded",
    seller: { username: "cardshop" },
    price: { value: "100.00", currency: "USD" },
  };

  it("converts USD to ringgit", () => {
    const item = toEbayListing(raw, 4.2);
    assert.equal(item?.myr, 420);
    assert.deepEqual(item?.price, { value: 100, currency: "USD" });
    assert.equal(item?.imageUrl, "https://i.ebayimg.com/thumbs/a.jpg");
    assert.equal(item?.seller, "cardshop");
  });

  it("keeps other currencies unconverted", () => {
    const item = toEbayListing({ ...raw, price: { value: "80", currency: "GBP" } }, 4.2);
    assert.equal(item?.myr, null);
  });

  it("drops listings it can't show honestly", () => {
    assert.equal(toEbayListing({ ...raw, price: undefined }, 4.2), null);
    assert.equal(toEbayListing({ ...raw, itemWebUrl: "javascript:alert(1)" }, 4.2), null);
    assert.equal(toEbayListing(null, 4.2), null);
  });
});

describe("ebay listing photos", () => {
  it("go through our image CDN at 2x", () => {
    const url = ebayImageUrl("https://i.ebayimg.com/images/g/abc/s-l225.jpg", 48);
    assert.ok(url?.startsWith("/.netlify/images?"));
    const params = new URLSearchParams(url!.split("?")[1]);
    assert.equal(params.get("url"), "https://i.ebayimg.com/images/g/abc/s-l225.jpg");
    assert.equal(params.get("w"), "96");
  });

  it("leaves other hosts alone and drops junk", () => {
    assert.equal(ebayImageUrl("https://example.com/a.jpg", 48), "https://example.com/a.jpg");
    assert.equal(ebayImageUrl("not a url", 48), null);
    assert.equal(ebayImageUrl(null, 48), null);
  });
});

describe("the netlify allowlist covers eBay photos", () => {
  it("lets the image CDN fetch from eBay's image host", () => {
    const toml = readFileSync(new URL("../netlify.toml", import.meta.url), "utf8");
    const line = toml.split("\n").find((l) => l.includes("remote_images"))!;
    const patterns = [...line.matchAll(/'([^']+)'/g)].map((m) => m[1]!);
    const sample = `https://${EBAY_IMAGE_HOST}/images/g/abc/s-l225.jpg`;
    assert.ok(patterns.some((p) => new RegExp(p).test(sample)), patterns.join(", "));
  });
});
