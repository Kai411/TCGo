// Card art served from our own domain.
//
// The allowlist in netlify.toml and CATALOG_IMAGE_HOST here have to agree, or
// every card image 404s at once — the endpoint rejects a remote URL it was not
// told about. That pairing is the thing worth pinning down.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  CATALOG_IMAGE_HOST,
  cardImageUrl,
  isCatalogImage,
  upscaleSource,
} from "~/shared/card-image";

const CATALOG = `https://${CATALOG_IMAGE_HOST}/product/573753_200w.jpg`;

describe("which images we proxy", () => {
  it("recognises catalogue art", () => {
    assert.equal(isCatalogImage(CATALOG), true);
  });

  it("leaves everything else alone", () => {
    // Sellers' own photos live on Cloudinary and are transformed in the URL
    // by cdnUrl; routing them here would break that.
    const cloudinary = "https://res.cloudinary.com/x/image/upload/v1/card.jpg";
    assert.equal(isCatalogImage(cloudinary), false);
    assert.equal(cardImageUrl(cloudinary, { width: 200 }), cloudinary);
  });

  it("survives an empty source", () => {
    for (const empty of ["", "   ", null, undefined]) {
      assert.equal(cardImageUrl(empty, { width: 200 }), "");
    }
  });
});

describe("asking the origin for a usable source", () => {
  it("swaps the small variant for the large one", () => {
    assert.equal(
      upscaleSource(CATALOG),
      `https://${CATALOG_IMAGE_HOST}/product/573753_in_1000x1000.jpg`,
    );
  });

  it("only touches the size suffix", () => {
    // "_200w" appearing anywhere but just before the extension is part of the
    // path, not a size, and must survive untouched.
    const odd = `https://${CATALOG_IMAGE_HOST}/product/_200w_x/12_200w.png`;
    assert.equal(
      upscaleSource(odd),
      `https://${CATALOG_IMAGE_HOST}/product/_200w_x/12_in_1000x1000.png`,
    );
  });

  it("leaves a URL with no size suffix as it is", () => {
    const plain = `https://${CATALOG_IMAGE_HOST}/product/1.jpg`;
    assert.equal(upscaleSource(plain), plain);
  });
});

describe("the URL we render", () => {
  const built = cardImageUrl(CATALOG, { width: 220 });

  it("points at our own domain, not the origin", () => {
    assert.ok(built.startsWith("/.netlify/images?"), built);
  });

  it("carries the upscaled source, encoded", () => {
    const url = new URLSearchParams(built.split("?")[1]).get("url");
    assert.equal(url, `https://${CATALOG_IMAGE_HOST}/product/573753_in_1000x1000.jpg`);
    // Encoded, so the source's own query string could never split ours.
    assert.ok(!built.includes("https://tcgplayer-cdn.tcgplayer.com/product/573753_in"));
  });

  it("asks for twice the rendered width, for a retina screen", () => {
    assert.equal(new URLSearchParams(built.split("?")[1]).get("w"), "440");
  });

  it("asks for webp", () => {
    assert.equal(new URLSearchParams(built.split("?")[1]).get("fm"), "webp");
  });

  it("takes a quality override", () => {
    const q = cardImageUrl(CATALOG, { width: 100, quality: 90 });
    assert.equal(new URLSearchParams(q.split("?")[1]).get("q"), "90");
  });
});

describe("the netlify allowlist agrees with the code", () => {
  const toml = readFileSync(new URL("../netlify.toml", import.meta.url), "utf8");

  it("declares an images section", () => {
    assert.match(toml, /^\[images\]/m, "netlify.toml has no [images] section");
    assert.match(toml, /remote_images\s*=/, "no remote_images allowlist");
  });

  it("allows the exact host the code proxies", () => {
    // A mismatch here 404s every card image on the site at once, and only in
    // production — which is precisely when nobody is watching a test run.
    const line = toml.split("\n").find((l) => l.includes("remote_images"))!;
    const patterns = [...line.matchAll(/'([^']+)'/g)].map((m) => m[1]!);
    assert.ok(patterns.length > 0, "no quoted patterns found");
    const sample = `https://${CATALOG_IMAGE_HOST}/product/1_in_1000x1000.jpg`;
    assert.ok(
      patterns.some((p) => new RegExp(p).test(sample)),
      `no allowlist entry matches ${sample}: ${patterns.join(", ")}`,
    );
  });
});
