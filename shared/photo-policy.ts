// When a seller's own photographs are mandatory.
//
// A catalogue image shows a flawless specimen of the card, whatever the seller
// is claiming about the one in their hand. That's harmless for a common in
// played condition at a few ringgit — the buyer's expectations are low and so
// is the stake — and actively misleading everywhere else.
//
// WHERE THIS APPLIES
// At listing time only, never at stocking time. Inventory is a private
// ledger: the POS scanner and CSV import add hundreds of rows with no
// photographs by design, and demanding pictures to write down what you own
// would break both for no one's benefit. The claim only matters once it's a
// public offer with a price on it.

export const HIGH_VALUE_THRESHOLD = 200;

/** Ungraded conditions that assert the card is effectively flawless. */
export const TOP_CONDITIONS = ["Mint (M)", "Near Mint (NM)"];

export interface PhotoRequirement {
  required: boolean;
  /** Shown to the seller. Explains the rule rather than just asserting it. */
  reason: string;
}

export const photoRequirement = (
  productType: string | undefined,
  condition: string | undefined,
  price: number | undefined,
): PhotoRequirement => {
  // The slab, its label and the cert number are the product. A picture of the
  // bare card doesn't show any of them, and a buyer can't check the cert
  // against the grader's registry without seeing it.
  if (productType === "Graded") {
    return {
      required: true,
      reason:
        "Graded cards need your own photo — buyers check the slab label and cert number against the grader's registry, and a catalogue image shows neither.",
    };
  }

  // For sealed product the state of the wrap, seams and box corners is the
  // entire question. A stock render answers none of it.
  if (productType === "Sealed") {
    return {
      required: true,
      reason:
        "Sealed product needs your own photo — the state of the wrap and the box corners is what buyers are judging.",
    };
  }

  // A top-condition claim is precisely the claim a catalogue image cannot
  // support, because that image looks mint no matter what you're selling.
  if (condition && TOP_CONDITIONS.includes(condition)) {
    return {
      required: true,
      reason: `A "${condition}" claim needs your own photo — a catalogue image looks flawless whatever the real card is like, so there's nothing for the buyer to check it against.`,
    };
  }

  // Independent of condition: above this, a disappointed buyer is a dispute
  // and a chargeback rather than a shrug. This catches the played-but-pricey
  // case the condition rule above deliberately lets through.
  if ((price ?? 0) >= HIGH_VALUE_THRESHOLD) {
    return {
      required: true,
      reason: `Anything over RM${HIGH_VALUE_THRESHOLD} needs your own photo, whatever the condition — at this price a surprise is a dispute.`,
    };
  }

  return { required: false, reason: "" };
};

/**
 * Whether a seller has satisfied it.
 *
 * `photos` means pictures the seller took. A catalogue image imported from the
 * product database is explicitly NOT one, which is the whole point — it's the
 * thing the rule exists to stop standing in for evidence.
 */
export const photoRequirementMet = (
  requirement: PhotoRequirement,
  sellerPhotoCount: number,
): boolean => !requirement.required || sellerPhotoCount > 0;
