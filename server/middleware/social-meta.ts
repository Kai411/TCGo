// Intercept social-crawler requests for product pages and return a minimal
// HTML page with correct Open Graph / Twitter Card meta tags.
//
// Regular users get undefined (passes through to the SPA shell). Bots get
// a real HTML page with product meta, then a JS redirect to the SPA URL.
// This works because Nitro always runs even in ssr:false mode on Netlify.

const BOT_UA = [
  "whatsapp",
  "facebookexternalhit",
  "facebookbot",
  "twitterbot",
  "telegrambot",
  "linkedinbot",
  "slackbot",
  "slack-imgproxy",
  "discordbot",
  "applebot",
  "googlebot",
  "bingbot",
  "yandexbot",
  "pinterest",
  "snapchat",
  "viber",
  "line-poker",
  "iframely",
  "embedly",
  "crawler",
  "spider",
  "bot/",
  "preview/",
  "prerender",
];

function isBot(ua: string): boolean {
  const l = ua.toLowerCase();
  return BOT_UA.some((p) => l.includes(p));
}

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Convert a Firestore REST API typed value to a plain JS value.
function fsVal(v: any): any {
  if (!v) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return new Date(v.timestampValue).getTime();
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(fsVal);
  if ("mapValue" in v) {
    const obj: Record<string, any> = {};
    for (const [k, val] of Object.entries<any>(v.mapValue.fields || {})) {
      obj[k] = fsVal(val);
    }
    return obj;
  }
  return null;
}

// Insert a Cloudinary width transformation into an /image/upload/ URL.
function cdnUrl(url: string, width: number): string {
  if (!url || !url.includes("/image/upload/")) return url;
  return url.replace(
    "/image/upload/",
    `/image/upload/w_${width},c_limit,q_auto,f_auto/`,
  );
}

export default defineEventHandler(async (event) => {
  const ua = getHeader(event, "user-agent") || "";
  if (!isBot(ua)) return;

  const path = event.path.split("?")[0];

  const cardMatch = path.match(/^\/cards\/([^/]+)$/);
  const auctionMatch = path.match(/^\/auctions\/([^/]+)$/);
  if (!cardMatch && !auctionMatch) return;

  const config = useRuntimeConfig();
  const projectId = config.public.firebaseProjectId;
  const apiKey = config.public.firebaseApiKey;
  if (!projectId) return;

  const isAuction = !!auctionMatch;
  const docId = (cardMatch || auctionMatch)![1];
  const collection = isAuction ? "auctions" : "cards";

  try {
    const fsUrl =
      `https://firestore.googleapis.com/v1/projects/${projectId}` +
      `/databases/(default)/documents/${collection}/${docId}` +
      (apiKey ? `?key=${apiKey}` : "");

    const res = await fetch(fsUrl, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return;

    const doc = await res.json();
    const f: Record<string, any> = {};
    for (const [k, v] of Object.entries<any>(doc.fields || {})) {
      f[k] = fsVal(v);
    }

    const cardName: string = f.cardName || "Pokemon Card";
    const rawImageUrls: string[] = Array.isArray(f.imageUrls)
      ? f.imageUrls
      : [];
    const rawImage: string = rawImageUrls[0] || f.imageUrl || "";
    const ogImage = cdnUrl(rawImage, 800) || "https://tcgo.shop/og.webp";

    // For auctions, currentPrice lives in RTDB auction_summaries — use
    // startingPrice from Firestore as a reasonable fallback for OG previews.
    const price: number | null =
      isAuction ? (f.startingPrice ?? null) : (f.price ?? null);
    const priceStr =
      price != null
        ? `RM ${Number(price).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : "";

    const cardSet: string = f.cardSet || "";
    const condition: string = f.condition || "";
    const seller: string = f.seller || "";

    const title = `${cardName}${cardSet ? ` — ${cardSet}` : ""} | TCGo`;
    const descParts = [
      priceStr,
      isAuction ? "Auction" : "For Sale",
      condition,
      seller ? `@${seller}` : "",
    ].filter(Boolean);
    const description = descParts.join(" · ");
    const pageUrl = `https://tcgo.shop${path}`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:type" content="product">
<meta property="og:url" content="${esc(pageUrl)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(ogImage)}">
<meta property="og:site_name" content="TCGo Marketplace">
<meta property="og:locale" content="en_MY">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(ogImage)}">
<link rel="canonical" href="${esc(pageUrl)}">
<script>location.replace(${JSON.stringify(pageUrl)});</script>
</head>
<body>
<a href="${esc(pageUrl)}">${esc(title)}</a>
</body>
</html>`;

    setHeader(event, "content-type", "text/html; charset=utf-8");
    setHeader(event, "cache-control", "public, max-age=60, s-maxage=300");
    return html;
  } catch {
    return; // Fall through to SPA on any error
  }
});
