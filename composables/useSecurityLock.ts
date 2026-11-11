// Whether payouts and bank details are on their 24-hour hold after a
// password change (shared/security-lock.ts). Display only: the server
// routes check again and are the authority.

import { lockMessage } from "~/shared/security-lock";

export const useSecurityLock = () => {
  const { user } = useAuth();
  const { authedFetch } = useAuthedFetch();
  const lockedUntil = ref<number | null>(null);

  const refresh = async () => {
    if (!user.value) {
      lockedUntil.value = null;
      return;
    }
    try {
      const res = await authedFetch<{ lockedUntil: number | null }>("/api/account/security");
      lockedUntil.value = res.lockedUntil;
    } catch {
      // Unknown is shown as unlocked; the server still refuses if it isn't.
      lockedUntil.value = null;
    }
  };

  onMounted(refresh);
  watch(() => user.value?.uid, (uid, prev) => {
    if (uid !== prev) refresh();
  });

  const lockText = computed(() => (lockedUntil.value ? lockMessage(lockedUntil.value) : ""));
  return { lockedUntil, lockText, refresh };
};
