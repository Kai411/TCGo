// Card images, served from our own domain.
//
// The catalogue stores TCGPlayer CDN URLs, so every card on every page
// advertised tcgplayer-cdn.tcgplayer.com in the page source. Routing them
// through Netlify's Image CDN puts them behind our hostname, caches them at
// our edge, and lets each surface ask for the size it actually renders.
//
// This is a proxy, not a copy: Netlify fetches from TCGPlayer on a cache miss,
// and nothing is stored by us. TCGCSV's guidelines permit linking to the CDN
// directly — they document how to change the size suffix — so this is a
// lighter arrangement than re-hosting, not a heavier one.
//
// The remote host must be allowlisted in netlify.toml under [images]
// remote_images, or the endpoint 404s. Both live and die together; if you add
// another image source, add it there too.

/** The one remote host we proxy. Must match the netlify.toml allowlist. */
export const CATALOG_IMAGE_HOST = "tcgplayer-cdn.tcgplayer.com";

export const isCatalogImage = (url: string): boolean =>
  url.includes(CATALOG_IMAGE_HOST);

/**
 * Ask the origin for a big enough source to resize from.
 *
 * The catalogue stores the 200px variant, which is why cards look soft on a
 * phone at 2x and worse on a desktop grid. TCGCSV documents the swap, and it
 * costs nothing here because the Image CDN resizes and re-encodes anyway — we
 * fetch the good one once per size, at the edge, not per visitor.
 */
export const upscaleSource = (url: string): string =>
  url.replace(/_200w(?=\.[a-z]+$)/i, "_in_1000x1000");

export interface ImageOptions {
  /** Rendered width in CSS pixels. The CDN is asked for 2x this. */
  width: number;
  /** JPEG/WebP quality. The CDN default is 75. */
  quality?: number;
}

/**
 * A card image URL on our own domain.
 *
 * Returns the source untouched when it is not a catalogue image (sellers'
 * own photos live elsewhere and are handled by cdnUrl), and in dev, where
 * /.netlify/images is not served by `nuxt dev` — gating there rather than
 * feature-detecting keeps local development working with no setup, at the
 * cost of showing the origin's URL on a developer's machine.
 */
export const cardImageUrl = (
  src: string | null | undefined,
  opts: ImageOptions,
): string => {
  const url = (src ?? "").trim();
  if (!url || !isCatalogImage(url)) return url;

  const source = upscaleSource(url);
  if (import.meta.dev) return source;

  const params = new URLSearchParams({
    url: source,
    // Retina: the grid is dense and these are small, so the extra bytes are
    // cheap next to a visibly soft card.
    w: String(Math.round(opts.width * 2)),
    fm: "webp",
    q: String(opts.quality ?? 78),
  });
  return `/.netlify/images?${params.toString()}`;
};
