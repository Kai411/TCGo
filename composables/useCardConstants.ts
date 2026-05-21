export const PRODUCT_TYPES = ["Ungraded", "Graded", "Sealed"] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const CARD_LANGUAGES = [
  { code: "EN", label: "English" },
  { code: "JP", label: "Japanese" },
  { code: "KR", label: "Korean" },
  { code: "CN", label: "Chinese" },
  { code: "DE", label: "German" },
  { code: "FR", label: "French" },
  { code: "IT", label: "Italian" },
  { code: "ES", label: "Spanish" },
  { code: "PT", label: "Portuguese" },
] as const;

export const UNGRADED_CONDITIONS = [
  "Mint (M)",
  "Near Mint (NM)",
  "Lightly Played (LP)",
  "Moderately Played (MP)",
  "Heavily Played (HP)",
  "Damaged (DMG)",
] as const;

export const GRADING_PROVIDERS = [
  "PSA",
  "CGC",
  "TAG",
  "Beckett",
  "ACE",
  "Others",
] as const;
export type GradingProvider = (typeof GRADING_PROVIDERS)[number];

// Grade scales per provider
export const PSA_GRADES = [
  "10",
  "9",
  "8.5",
  "8",
  "7",
  "6",
  "5",
  "4",
  "3",
  "2",
  "1",
  "Authentic",
];

export const CGC_GRADES = [
  "10 Pristine",
  "10",
  "9.5",
  "9",
  "8.5",
  "8",
  "7.5",
  "7",
  "6.5",
  "6",
  "5.5",
  "5",
  "4.5",
  "4",
  "3.5",
  "3",
  "2.5",
  "2",
  "1.5",
  "1",
];

export const TAG_GRADES = [
  "10",
  "9.5",
  "9",
  "8.5",
  "8",
  "7",
  "6",
  "5",
  "4",
  "3",
  "2",
  "1",
];

export const BECKETT_GRADES = [
  "10 Pristine",
  "10",
  "9.5",
  "9",
  "8.5",
  "8",
  "7.5",
  "7",
  "6.5",
  "6",
  "5.5",
  "5",
  "4.5",
  "4",
  "3.5",
  "3",
  "2.5",
  "2",
  "1.5",
  "1",
];

export const ACE_GRADES = ["10", "9", "8", "7", "6", "5", "4", "3", "2", "1"];

export const getGradesForProvider = (provider: string): string[] => {
  switch (provider) {
    case "PSA":
      return PSA_GRADES;
    case "CGC":
      return CGC_GRADES;
    case "TAG":
      return TAG_GRADES;
    case "Beckett":
      return BECKETT_GRADES;
    case "ACE":
      return ACE_GRADES;
    default:
      return [];
  }
};
