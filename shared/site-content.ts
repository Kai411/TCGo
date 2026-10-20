// Content staff manage from Mint Condition: the banner above each listing
// page and the microsites at /p/{slug}.
//
// Both live in Firestore (`banners/{placement}`, `microsites/{slug}`), read
// straight from the browser so they show signed out, and are written only by
// the /api/mc/content routes. The checks here are shared by the console form
// and those routes, so what the form accepts is what the server saves.

export const BANNER_PLACEMENTS = ["shop", "auctions"] as const;
export type BannerPlacement = (typeof BANNER_PLACEMENTS)[number];

export const BANNER_PLACEMENT_LABELS: Record<BannerPlacement, string> = {
  shop: "Shop",
  auctions: "Auctions",
};

export const BANNER_HEADLINE_MAX = 60;
export const BANNER_SUBTEXT_MAX = 120;

/** One banner in a listing page's rotation. */
export interface BannerSlide {
  /** Stable key for the console list; carries no meaning. */
  id: string;
  imageUrl: string;
  headline: string;
  subtext: string;
  /** In-app path such as /auctions or /p/summer-sale; empty for no link. */
  linkPath: string;
}

/** Everything above one listing page: its show/hide switch and its banners, in order. */
export interface Banner {
  visible: boolean;
  slides: BannerSlide[];
  updatedAt?: number;
  updatedBy?: string;
}

export const BANNER_SLIDES_MAX = 8;
/** How long each banner stays before the next slides in. */
export const BANNER_INTERVAL_MS = 5000;

const newSlideId = () => Math.random().toString(36).slice(2, 10);

export const emptySlide = (): BannerSlide => ({
  id: newSlideId(),
  imageUrl: "",
  headline: "",
  subtext: "",
  linkPath: "",
});

export const emptyBanner = (): Banner => ({ visible: false, slides: [] });

export const slideHasContent = (s: Pick<BannerSlide, "imageUrl" | "headline">) =>
  !!(s.imageUrl || s.headline.trim());

/**
 * A stored banner doc in today's shape. Docs saved before banners could
 * rotate hold one banner's fields at the top level; they become one slide.
 */
export const normaliseBanner = (raw: any): Banner => {
  if (!raw || typeof raw !== "object") return emptyBanner();
  const slideFrom = (x: any, i: number): BannerSlide => ({
    id: typeof x?.id === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(x.id) ? x.id : `s${i}`,
    imageUrl: String(x?.imageUrl ?? ""),
    headline: String(x?.headline ?? ""),
    subtext: String(x?.subtext ?? ""),
    linkPath: String(x?.linkPath ?? ""),
  });
  const slides = Array.isArray(raw.slides)
    ? raw.slides.map(slideFrom)
    : slideHasContent({ imageUrl: String(raw.imageUrl ?? ""), headline: String(raw.headline ?? "") })
      ? [slideFrom(raw, 0)]
      : [];
  return {
    visible: raw.visible === true,
    slides,
    ...(typeof raw.updatedAt === "number" ? { updatedAt: raw.updatedAt } : {}),
    ...(typeof raw.updatedBy === "string" ? { updatedBy: raw.updatedBy } : {}),
  };
};

export type MicrositeType = "image" | "article";

export const MICROSITE_TITLE_MAX = 100;
export const MICROSITE_BODY_MAX = 20_000;

export interface Microsite {
  slug: string;
  type: MicrositeType;
  title: string;
  /** The whole page for "image"; the full-width banner for "article". */
  imageUrl: string;
  /** Article text: paragraphs, "# " / "## " headings and "- " lists. */
  body: string;
  published: boolean;
  createdAt?: number;
  updatedAt?: number;
  updatedBy?: string;
}

export const micrositePath = (slug: string) => `/p/${slug}`;

// ── Links ────────────────────────────────────────────────────────────────

/**
 * Turn what someone typed or pasted into an in-app path, or null when it
 * points anywhere else.
 *
 * Accepts "/auctions", "auctions" and a pasted TCGo address
 * ("https://tcgo.shop/cards/abc"): only the path of a pasted address is kept,
 * and only when the host is one of `appHosts`. Anything else with a scheme or
 * a host ("//evil.com", "javascript:", another site) is rejected, so a banner
 * can never send people off the app.
 */
export const normaliseLinkPath = (
  raw: string,
  appHosts: readonly string[] = [],
): string | null => {
  let s = String(raw ?? "").trim();
  if (!s) return "";
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) {
    let url: URL;
    try {
      url = new URL(s);
    } catch {
      return null;
    }
    if (!/^https?:$/.test(url.protocol)) return null;
    const host = url.host.toLowerCase();
    if (!appHosts.some((h) => h.toLowerCase() === host)) return null;
    s = url.pathname + url.search + url.hash;
  }
  if (s.startsWith("//") || s.includes("\\")) return null;
  if (!s.startsWith("/")) s = `/${s}`;
  if (s.length > 300) return null;
  // Spaces and control characters have no place in an app path.
  if (/[\s\u0000-\u001f]/.test(s)) return null;
  return s;
};

/** Addresses whose links count as in-app when pasted whole. */
export const APP_HOSTS = ["tcgo.shop", "www.tcgo.shop", "tcgo-staging.netlify.app"];

/** Common destinations for the console's link picker. */
export const LINK_PRESETS: { label: string; path: string }[] = [
  { label: "Shop", path: "/" },
  { label: "Auctions", path: "/auctions" },
  { label: "TCGo Dex", path: "/collection" },
  { label: "Sell a card", path: "/seller/listings/new" },
  { label: "Start an auction", path: "/seller/auctions/new" },
  { label: "Messages", path: "/messages" },
  { label: "Buyer Protection", path: "/refund-policy" },
];

/** Kinds of page the picker builds a path for from an ID or pasted link. */
export const LINK_KINDS = [
  { key: "card", label: "A card listing", prefix: "/cards/" },
  { key: "auction", label: "An auction", prefix: "/auctions/" },
  { key: "profile", label: "A profile", prefix: "/profile/" },
] as const;

/** Last path segment of a pasted link, or the input itself when it's an ID. */
export const idFromInput = (raw: string): string => {
  const s = (String(raw ?? "").trim().split(/[?#]/)[0] ?? "").replace(/\/+$/, "");
  const last = s.split("/").pop() || "";
  return /^[A-Za-z0-9_-]{1,128}$/.test(last) ? last : "";
};

// ── Slugs ────────────────────────────────────────────────────────────────

export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/;

export const slugify = (s: string): string =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");

export const isValidSlug = (s: string) => SLUG_PATTERN.test(s);

// ── Images ───────────────────────────────────────────────────────────────

/** Uploads go to Cloudinary (composables/useStorage.ts); nothing else is accepted. */
export const isAllowedImageUrl = (url: string) =>
  url === "" || /^https:\/\/res\.cloudinary\.com\/[^\s"'<>]+$/.test(url);

// ── Validation ───────────────────────────────────────────────────────────

const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

export const validateBanner = (
  input: { visible?: unknown; slides?: unknown },
  appHosts: readonly string[] = [],
): { banner: Banner } | { error: string } => {
  const raw = Array.isArray(input.slides) ? input.slides : [];
  if (raw.length > BANNER_SLIDES_MAX) return { error: `Up to ${BANNER_SLIDES_MAX} banners per page.` };
  const slides: BannerSlide[] = [];
  for (const [i, x] of raw.entries()) {
    const n = raw.length > 1 ? ` (banner ${i + 1})` : "";
    const imageUrl = str(x?.imageUrl, 1000);
    if (!isAllowedImageUrl(imageUrl)) return { error: `Upload the image here instead of linking one${n}.` };
    const linkPath = normaliseLinkPath(String(x?.linkPath ?? ""), appHosts);
    if (linkPath === null) return { error: `Links can only go to pages inside TCGo${n}.` };
    const slide: BannerSlide = {
      id: typeof x?.id === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(x.id) ? x.id : newSlideId(),
      imageUrl,
      headline: str(x?.headline, BANNER_HEADLINE_MAX),
      subtext: str(x?.subtext, BANNER_SUBTEXT_MAX),
      linkPath,
    };
    if (!slideHasContent(slide)) return { error: `Add an image or a headline${n}, or remove it.` };
    slides.push(slide);
  }
  const visible = input.visible === true;
  if (visible && !slides.length) return { error: "Add a banner before showing them." };
  return { banner: { visible, slides } };
};

export const validateMicrosite = (
  input: Partial<Microsite>,
): { microsite: Microsite } | { error: string } => {
  const slug = str(input.slug, 60).toLowerCase();
  if (!isValidSlug(slug)) {
    return { error: "The address can use lowercase letters, numbers and dashes." };
  }
  const type: MicrositeType = input.type === "article" ? "article" : "image";
  const title = str(input.title, MICROSITE_TITLE_MAX);
  if (!title) return { error: "Give the page a title." };
  const imageUrl = str(input.imageUrl, 1000);
  if (!isAllowedImageUrl(imageUrl)) return { error: "Upload the image here instead of linking one." };
  const body = type === "article" ? String(input.body ?? "").replace(/\r\n?/g, "\n").trim().slice(0, MICROSITE_BODY_MAX) : "";
  const published = input.published === true;
  if (published && type === "image" && !imageUrl) {
    return { error: "Upload the image before publishing." };
  }
  if (published && type === "article" && !body) {
    return { error: "Write the article before publishing." };
  }
  return { microsite: { slug, type, title, imageUrl, body, published } };
};

// ── Article text ─────────────────────────────────────────────────────────

export type ArticleBlock =
  | { kind: "h2" | "h3" | "p"; text: string }
  | { kind: "ul"; items: string[] };

/**
 * Plain text to article blocks. Rendered as text nodes, never as HTML, so
 * nothing typed here can inject markup.
 *
 *   # Heading        → large heading
 *   ## Subheading    → small heading
 *   - item           → bulleted list (consecutive lines)
 *   anything else    → paragraph; a blank line starts the next one
 */
export const parseArticle = (body: string): ArticleBlock[] => {
  const blocks: ArticleBlock[] = [];
  let para: string[] = [];
  let list: string[] | null = null;
  const flushPara = () => {
    if (para.length) blocks.push({ kind: "p", text: para.join("\n") });
    para = [];
  };
  const flushList = () => {
    if (list?.length) blocks.push({ kind: "ul", items: list });
    list = null;
  };
  for (const raw of String(body ?? "").replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    const t = line.trim();
    if (!t) {
      flushPara();
      flushList();
      continue;
    }
    const h = /^(#{1,2})\s+(.+)$/.exec(t);
    if (h) {
      flushPara();
      flushList();
      blocks.push({ kind: h[1]!.length === 1 ? "h2" : "h3", text: h[2]!.trim() });
      continue;
    }
    const li = /^[-*•]\s+(.+)$/.exec(t);
    if (li) {
      flushPara();
      (list ||= []).push(li[1]!.trim());
      continue;
    }
    flushList();
    para.push(t);
  }
  flushPara();
  flushList();
  return blocks;
};
