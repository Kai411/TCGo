import { doc, updateDoc, increment } from "firebase/firestore";

export const TRUST_THRESHOLDS = {
  WARNING: 80,
  NO_BID: 60,
  NO_LIST: 40,
  SUSPENDED: 20,
} as const;

export const useTrustScore = () => {
  const { firestore } = useFirebase();

  const getScoreColor = (score: number): string => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    if (score >= 40) return "text-orange-600";
    return "text-red-600";
  };

  const getScoreBadge = (
    score: number,
  ): { label: string; class: string } | null => {
    if (score >= 80) return null; // No badge needed for good scores
    if (score >= 60)
      return { label: "Low Trust", class: "bg-yellow-100 text-yellow-700" };
    if (score >= 40)
      return { label: "Restricted", class: "bg-orange-100 text-orange-700" };
    if (score >= 20)
      return { label: "Heavily Restricted", class: "bg-red-100 text-red-700" };
    return { label: "Suspended", class: "bg-red-200 text-red-800" };
  };

  const canBid = (score: number): boolean => {
    return score >= TRUST_THRESHOLDS.NO_BID;
  };

  const canList = (score: number): boolean => {
    return score >= TRUST_THRESHOLDS.NO_LIST;
  };

  const canUseApp = (score: number): boolean => {
    return score >= TRUST_THRESHOLDS.SUSPENDED;
  };

  const applyPenalty = async (uid: string, penalty: number) => {
    const userDoc = doc(firestore!, "users", uid);
    await updateDoc(userDoc, {
      trustScore: increment(-Math.abs(penalty)),
    });
  };

  const applyRecovery = async (uid: string, amount: number = 2) => {
    // Cap at 100 — we'll handle this by reading current score first
    const userDoc = doc(firestore!, "users", uid);
    await updateDoc(userDoc, {
      trustScore: increment(Math.abs(amount)),
    });
  };

  return {
    getScoreColor,
    getScoreBadge,
    canBid,
    canList,
    canUseApp,
    applyPenalty,
    applyRecovery,
  };
};
