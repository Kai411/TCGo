import { doc, runTransaction } from "firebase/firestore";
import { computed } from "vue";

export const FREE_SCAN_LIMIT = 20;

const firstOfNextMonth = (from: Date) =>
  new Date(from.getFullYear(), from.getMonth() + 1, 1).getTime();

export const useScanQuota = () => {
  const { firestore } = useFirebase();
  const { user } = useAuth();
  const { profile } = useMyProfile();

  const isPremium = computed(() => profile.value?.tier === "premium");

  // Live remaining count, accounting for lazy monthly reset.
  const remaining = computed(() => {
    if (!profile.value) return 0;
    if (isPremium.value) return Infinity;
    const dueReset =
      profile.value.scansResetAt && Date.now() >= profile.value.scansResetAt;
    const used = dueReset ? 0 : profile.value.scansUsed ?? 0;
    return Math.max(0, FREE_SCAN_LIMIT - used);
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

  // Reserves one scan atomically. Returns true if allowed, false if over cap.
  // Premium short-circuits — no write, no read.
  const tryConsumeScan = async (): Promise<boolean> => {
    if (!user.value || !firestore) return false;
    if (isPremium.value) return true;
    const ref = doc(firestore, "users", user.value.uid);
    try {
      return await runTransaction(firestore, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) return false;
        const data = snap.data() as { scansUsed?: number; scansResetAt?: number; tier?: string };
        if (data.tier === "premium") return true;
        const now = Date.now();
        const needsReset = !data.scansResetAt || now >= data.scansResetAt;
        const currentUsed = needsReset ? 0 : data.scansUsed ?? 0;
        if (currentUsed >= FREE_SCAN_LIMIT) return false;
        tx.update(ref, {
          scansUsed: currentUsed + 1,
          scansResetAt: needsReset
            ? firstOfNextMonth(new Date(now))
            : data.scansResetAt,
        });
        return true;
      });
    } catch (e) {
      console.error("[useScanQuota] tryConsumeScan failed:", e);
      return false;
    }
  };

  return { isPremium, remaining, limit, used, tryConsumeScan };
};
