// Calls Gemini 2.0 Flash Lite to read the visible card name + set number
// off a photo of a Pokemon TCG card. The browser sends the image as
// base64; we forward it to Gemini with a strict JSON response schema and
// return { name, number } back. The actual card lookup happens client-side
// against api.pokemontcg.io using those two fields.

const MODEL = "gemini-2.0-flash-lite";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const PROMPT = `You are reading a single Pokemon TCG card from the image.

Return ONLY a JSON object with two fields:
- "name": the card's printed name as shown near the top (e.g. "Charizard ex", "Tyranitar", "Pikachu VMAX"). Use the main name only, no HP or attack text.
- "number": the set number from the bottom corner, formatted exactly as "N/Total" (e.g. "20/189", "222/193"). Strip any leading zeros from N — write "20" not "020".

If you genuinely cannot read a field, use null for that field. Do not guess.`;

interface RequestBody {
  imageBase64?: string;
  mimeType?: string;
}

export default defineEventHandler(async (event) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw createError({
      statusCode: 500,
      message: "GEMINI_API_KEY is not set on the server.",
    });
  }

  const body = await readBody<RequestBody>(event);
  if (!body?.imageBase64) {
    throw createError({ statusCode: 400, message: "imageBase64 is required." });
  }

  const requestBody = {
    contents: [
      {
        parts: [
          { text: PROMPT },
          {
            inline_data: {
              mime_type: body.mimeType || "image/jpeg",
              data: body.imageBase64,
            },
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          name: { type: "string", nullable: true },
          number: { type: "string", nullable: true },
        },
        required: ["name", "number"],
      },
      temperature: 0,
    },
  };

  const res = await fetch(`${ENDPOINT}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw createError({
      statusCode: 502,
      message: `Gemini error (${res.status}): ${errText.slice(0, 200)}`,
    });
  }

  const json: any = await res.json();
  const text: string =
    json?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

  let parsed: { name?: string | null; number?: string | null } = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = {};
  }

  // Defensive: strip leading zeros from number if the model didn't.
  let number = parsed.number || "";
  const m = number.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (m) number = `${m[1].replace(/^0+/, "") || "0"}/${m[2]}`;

  return {
    name: (parsed.name || "").trim(),
    number,
  };
});
