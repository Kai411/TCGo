import { doc, updateDoc } from "firebase/firestore";
import { computed } from "vue";
import { BONUS_SCANS, FREE_SCAN_LIMIT } from "~/shared/scan-quota";

export { BONUS_SCANS, FREE_SCAN_LIMIT };

export const useScanQuota = () => {
  const { firestore } = useFirebase();
  const { user } = useAuth();
  const { profile } = useMyProfile();

  const isPremium = computed(() => profile.value?.tier === "premium");

  const hasClaimedBonus = computed(
    () => !!(profile.value?.bonusScansClaimedAt),
  );

  const bonusRemaining = computed(
    () => profile.value?.bonusScansRemaining ?? 0,
  );

  // Live remaining count, accounting for lazy monthly reset.
  const remaining = computed(() => {
    if (!profile.value) return 0;
    if (isPremium.value) return Infinity;
    const bonus = profile.value.bonusScansRemaining ?? 0;
    const dueReset =
      profile.value.scansResetAt && Date.now() >= profile.value.scansResetAt;
    const used = dueReset ? 0 : profile.value.scansUsed ?? 0;
    return bonus + Math.max(0, FREE_SCAN_LIMIT - used);
  });

  const limit = computed(() =>
    isPremium.value ? Infinity : FREE_SCAN_LIMIT,
  );

  const used = computed(() => {
    if (!profile.value) return 0;
    const dueReset =
      profile.value.scansResetAt && Date.now() >= profile.value.scansResetAt;
    return dueReset ? 0 : profile.value.scansUsed ?? 0;
  });

  // Claim the one-time +5 bonus scans preview.
  const claimBonusScans = async (): Promise<boolean> => {
    if (!user.value || !firestore) return false;
    if (hasClaimedBonus.value) return false;
    try {
      await updateDoc(doc(firestore, "users", user.value.uid), {
        bonusScansRemaining: BONUS_SCANS,
        bonusScansClaimedAt: Date.now(),
      });
      return true;
    } catch {
      return false;
    }
  };

  // Whether to let a scan start. The server counts and enforces the real
  // allowance (/api/identify-card, shared/scan-quota.ts) and writes the
  // numbers back to the profile; this only saves a doomed upload when the
  // profile already says there are none left.
  const tryConsumeScan = async (): Promise<boolean> => {
    if (!user.value || !firestore) return false;
    return isPremium.value || remaining.value > 0;
  };

  return {
    isPremium,
    remaining,
    limit,
    used,
    hasClaimedBonus,
    bonusRemaining,
    claimBonusScans,
    tryConsumeScan,
  };
};
