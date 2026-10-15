// Malaysian states.
//
// `code` is the short code profiles and delivery addresses have always stored. `name` is the full name — Delyva's quote API
// wants that rather than a code, so this map is the bridge.
//
// Dependency-free so both the browser bundle and Nitro can import it.

export const MY_STATES: { code: string; name: string }[] = [
  { code: "jhr", name: "Johor" },
  { code: "kdh", name: "Kedah" },
  { code: "ktn", name: "Kelantan" },
  { code: "kul", name: "Kuala Lumpur" },
  { code: "lbn", name: "Labuan" },
  { code: "mlk", name: "Melaka" },
  { code: "nsn", name: "Negeri Sembilan" },
  { code: "phg", name: "Pahang" },
  { code: "png", name: "Pulau Pinang" },
  { code: "prk", name: "Perak" },
  { code: "pls", name: "Perlis" },
  { code: "pjy", name: "Putrajaya" },
  { code: "sbh", name: "Sabah" },
  { code: "sgr", name: "Selangor" },
  { code: "srw", name: "Sarawak" },
  { code: "trg", name: "Terengganu" },
];

export const stateName = (code: string | undefined): string =>
  MY_STATES.find((s) => s.code === code)?.name || code || "";

// First two digits of a Malaysian postcode → state code.
//
// Ranges follow Pos Malaysia's allocation. A few prefixes sit outside their
// state's main block (39 Cameron Highlands, 49 Fraser's Hill and 69 Genting
// are Pahang; 63, 64 and 68 are Selangor). Used only to fill in an empty
// State field as a suggestion — the member can always change it, because a
// handful of border postcodes are shared.
const POSTCODE_RANGES: [from: number, to: number, code: string][] = [
  [1, 2, "pls"],
  [5, 9, "kdh"],
  [10, 14, "png"],
  [15, 18, "ktn"],
  [20, 24, "trg"],
  [25, 28, "phg"],
  [30, 36, "prk"],
  [39, 39, "phg"],
  [40, 48, "sgr"],
  [49, 49, "phg"],
  [50, 60, "kul"],
  [62, 62, "pjy"],
  [63, 64, "sgr"],
  [68, 68, "sgr"],
  [69, 69, "phg"],
  [70, 73, "nsn"],
  [75, 78, "mlk"],
  [79, 86, "jhr"],
  [87, 87, "lbn"],
  [88, 91, "sbh"],
  [93, 98, "srw"],
];

export const stateForPostcode = (postcode: string | undefined | null): string | null => {
  const digits = (postcode || "").trim();
  if (!/^\d{5}$/.test(digits)) return null;
  const prefix = Number(digits.slice(0, 2));
  return POSTCODE_RANGES.find(([from, to]) => prefix >= from && prefix <= to)?.[2] ?? null;
};
