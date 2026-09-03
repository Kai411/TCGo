// The seller's bell.
//
// Module-level state, like useCards: one Firestore listener for the whole app
// rather than one per component that mounts a bell. The layout renders the
// icon and the dashboard renders a list, and both must show the same count.

import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { computed, ref } from "vue";
import {
  badgeLabel,
  byNewest,
  isUnread,
  unreadCount,
  type AppNotification,
} from "~/shared/notifications";

// The bell is a glance, not an archive — older ones live on the list page.
const FEED_LIMIT = 30;

const items = ref<AppNotification[]>([]);
const loading = ref(true);
let unsubscribe: Unsubscribe | null = null;
let listeningFor: string | null = null;

export const useNotifications = () => {
  const { firestore } = useFirebase();
  const { user } = useAuth();

  /**
   * Start (or move) the listener.
   *
   * Keyed by uid so signing in as someone else re-points it rather than
   * leaving the previous seller's notifications on screen — which, on a
   * shared shop device, would be someone else's order values.
   */
  const listen = () => {
    const uid = user.value?.uid;
    if (!uid) {
      unsubscribe?.();
      unsubscribe = null;
      listeningFor = null;
      items.value = [];
      loading.value = false;
      return;
    }
    if (listeningFor === uid && unsubscribe) return;

    unsubscribe?.();
    listeningFor = uid;
    loading.value = true;

    const q = query(
      collection(firestore!, "notifications"),
      where("userUid", "==", uid),
      orderBy("createdAt", "desc"),
      limit(FEED_LIMIT),
    );
    unsubscribe = onSnapshot(
      q,
      (snap) => {
        items.value = snap.docs.map((d) => ({
          ...(d.data() as Omit<AppNotification, "id">),
          id: d.id,
        }));
        loading.value = false;
      },
      (e) => {
        console.error("[useNotifications] listener error:", e);
        loading.value = false;
      },
    );
  };

  const stop = () => {
    unsubscribe?.();
    unsubscribe = null;
    listeningFor = null;
  };

  const markRead = async (id: string) => {
    const batch = writeBatch(firestore!);
    batch.update(doc(firestore!, "notifications", id), { readAt: Date.now() });
    await batch.commit();
  };

  /** Clears the dot. Only touches what's unread, so it's cheap to call. */
  const markAllRead = async () => {
    const unread = items.value.filter(isUnread);
    if (!unread.length) return;
    const now = Date.now();
    const batch = writeBatch(firestore!);
    for (const n of unread) {
      batch.update(doc(firestore!, "notifications", n.id), { readAt: now });
    }
    await batch.commit();
  };

  const notifications = computed(() => byNewest(items.value));
  const unread = computed(() => unreadCount(items.value));
  const hasUnread = computed(() => unread.value > 0);
  const badge = computed(() => badgeLabel(unread.value));

  return {
    notifications,
    loading,
    unread,
    hasUnread,
    badge,
    listen,
    stop,
    markRead,
    markAllRead,
  };
};
