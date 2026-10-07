// "Last online" for chat: while a tab is open and visible, write the signed-in
// member's lastSeenAt every few minutes.
//
// Throttled per device through localStorage so several open tabs don't each
// write, and paused while the tab is hidden so a forgotten background tab
// doesn't show someone as online all night.

import { doc, updateDoc } from "firebase/firestore";
import { watch } from "vue";
import { PRESENCE_HEARTBEAT_MS } from "~/shared/chat";

const KEY = "tcgo:lastSeenWrite";

export default defineNuxtPlugin(() => {
  const { user } = useAuth();
  const { firestore } = useFirebase();
  let timer: ReturnType<typeof setInterval> | null = null;

  const beat = async () => {
    const uid = user.value?.uid;
    if (!uid || document.visibilityState !== "visible") return;
    const now = Date.now();
    let last = 0;
    try {
      last = Number(localStorage.getItem(`${KEY}:${uid}`) || 0);
    } catch {}
    if (now - last < PRESENCE_HEARTBEAT_MS - 5_000) return;
    try {
      localStorage.setItem(`${KEY}:${uid}`, String(now));
    } catch {}
    try {
      await updateDoc(doc(firestore!, "users", uid), { lastSeenAt: now });
    } catch {
      // A missing profile (mid-signup) or a dropped connection: try next beat.
    }
  };

  watch(
    () => user.value?.uid,
    (uid) => {
      if (timer) clearInterval(timer);
      timer = null;
      if (!uid) return;
      void beat();
      timer = setInterval(beat, PRESENCE_HEARTBEAT_MS);
    },
    { immediate: true },
  );

  document.addEventListener("visibilitychange", () => void beat());
});
