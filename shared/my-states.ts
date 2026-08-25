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
