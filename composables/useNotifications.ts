// The notification bell — buyer and seller events in one feed.
//
// Module-level state, like useCards: one Firestore listener for the whole app
// rather than one per component that mounts a bell. The layout renders the
// icon and the dashboard renders a list, and both must show the same count.

import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { computed, ref } from "vue";
import {
  badgeLabel,
  byNewest,
  isUnread,
  SEEN_RETENTION_MS,
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
    void pruneSeen(uid);

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

  /**
   * Delete this user's notifications that were read more than a week ago.
   *
   * Runs once per sign-in rather than on every snapshot, and queries past the
   * 30-row feed window so an old backlog is cleared too. Best-effort: a
   * failure leaves a few extra rows, which is harmless. `expireAt` is also set
   * on read, so a Firestore TTL policy can take over server-side if enabled.
   */
  const pruneSeen = async (uid: string) => {
    try {
      const cutoff = Date.now() - SEEN_RETENTION_MS;
      const snap = await getDocs(
        query(
          collection(firestore!, "notifications"),
          where("userUid", "==", uid),
          where("readAt", "<=", cutoff),
          limit(400),
        ),
      );
      if (snap.empty) return;
      const batch = writeBatch(firestore!);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    } catch (e) {
      console.warn("[useNotifications] prune skipped:", e);
    }
  };

  const readFields = (now: number) => ({
    readAt: now,
    expireAt: Timestamp.fromMillis(now + SEEN_RETENTION_MS),
  });

  const stop = () => {
    unsubscribe?.();
    unsubscribe = null;
    listeningFor = null;
  };

  const markRead = async (id: string) => {
    const batch = writeBatch(firestore!);
    batch.update(doc(firestore!, "notifications", id), readFields(Date.now()));
    await batch.commit();
  };

  /** Clears the dot. Only touches what's unread, so it's cheap to call. */
  const markAllRead = async () => {
    const unread = items.value.filter(isUnread);
    if (!unread.length) return;
    const now = Date.now();
    const batch = writeBatch(firestore!);
    for (const n of unread) {
      batch.update(doc(firestore!, "notifications", n.id), readFields(now));
    }
    await batch.commit();
  };

  const notifications = computed(() => byNewest(items.value));
  const unread = computed(() => unreadCount(items.value));
  const hasUnread = computed(() => unread.value > 0);
  const badge = computed(() => badgeLabel(unread.value));
  /** Unread seller events only — for the Seller Dashboard link's dot. */
  const hasUnreadSeller = computed(() =>
    items.value.some((n) => isUnread(n) && n.audience !== "buyer"),
  );

  return {
    notifications,
    loading,
    unread,
    hasUnread,
    hasUnreadSeller,
    badge,
    listen,
    stop,
    markRead,
    markAllRead,
  };
};
