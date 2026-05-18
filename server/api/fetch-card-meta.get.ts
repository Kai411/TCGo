export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const url = query.url as string;

  if (!url) {
    throw createError({ statusCode: 400, message: "URL is required" });
  }

  // Only allow collectr domains
  const allowed = ["getcollectr.com", "collectr.com"];
  const urlObj = new URL(url);
  if (!allowed.some((d) => urlObj.hostname.includes(d))) {
    throw createError({
      statusCode: 400,
      message: "Only Collectr links are supported",
    });
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; TCGoBot/1.0)",
      },
    });

    if (!response.ok) {
      throw createError({ statusCode: 502, message: "Failed to fetch URL" });
    }

    const html = await response.text();

    // Extract og:title
    const ogTitleMatch = html.match(
      /<meta\s+property="og:title"\s+content="([^"]+)"/i,
    );
    const ogTitle = ogTitleMatch?.[1] || "";

    // Extract twitter:image or og:image
    const imageMatch =
      html.match(/<meta\s+name="twitter:image"\s+content="([^"]+)"/i) ||
      html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
    let imageUrl = imageMatch?.[1] || "";

    // Decode HTML entities
    imageUrl = imageUrl.replace(/&amp;/g, "&");

    // Change quality to 100%
    if (imageUrl.includes("quality=")) {
      imageUrl = imageUrl.replace(/quality=\d+/, "quality=100");
    }

    // Parse title: "{Name} - {set number} - {set name} - Collectr"
    // or "{Name} - {set number} - {set name} Pokemon - Collectr"
    let cardName = "";
    let cardNumber = "";
    let cardSet = "";

    if (ogTitle) {
      // Remove trailing " - Collectr" or " Pokemon - Collectr"
      const cleaned = ogTitle
        .replace(/\s*-?\s*Collectr\s*$/i, "")
        .replace(/\s*Pokemon\s*$/i, "")
        .trim();

      const parts = cleaned.split(" - ").map((p: string) => p.trim());

      if (parts.length >= 3) {
        cardName = parts[0];
        cardNumber = parts[1];
        cardSet = parts.slice(2).join(" - "); // In case set name has dashes
      } else if (parts.length === 2) {
        cardName = parts[0];
        cardNumber = parts[1];
      } else {
        cardName = cleaned;
      }
    }

    return {
      cardName,
      cardNumber,
      cardSet,
      imageUrl,
      rawTitle: ogTitle,
    };
  } catch (e: any) {
    if (e.statusCode) throw e;
    throw createError({
      statusCode: 500,
      message: e.message || "Failed to parse URL",
    });
  }
});
