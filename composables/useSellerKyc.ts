// Seller verification ("KYC") — the gate for selling on TCGo.
//
// Deliberately NOT document KYC (no IC uploads): a seller is "verified" when
// their profile carries everything the platform needs to pay them and ship
// for them:
//   1. a contact number (WhatsApp/phone — buyer comms),
//   2. a Malaysian bank account (Billplz payouts / manual transfer),
//   3. a pickup address (EasyParcel sender details).
//
// Bank accounts in MY require IC to open, so the bank-account requirement is
// the real-identity anchor without us touching documents.

import { computed } from "vue";

// EasyParcel Malaysian state codes — used by both the seller pickup form and
// the buyer delivery-address form.
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

export const stateName = (code: string | undefined) =>
  MY_STATES.find((s) => s.code === code)?.name || code || "";

export const useSellerKyc = () => {
  const { profile, loading } = useMyProfile();

  const missing = computed<string[]>(() => {
    const p = profile.value;
    if (!p) return ["profile"];
    const out: string[] = [];
    if (!p.whatsappNumber && !p.phone) out.push("contact number");
    if (!p.bankName || !p.bankAccountNumber || !p.bankAccountHolder)
      out.push("bank account");
    if (!p.pickupAddress1 || !p.pickupPostcode || !p.pickupCity || !p.pickupState)
      out.push("pickup address");
    return out;
  });

  const sellerReady = computed(
    () => !!profile.value && missing.value.length === 0,
  );

  return { sellerReady, missing, kycLoading: loading };
};
