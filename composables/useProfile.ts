import {
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { effectScope, ref, onUnmounted, watch } from "vue";

export type MembershipTier = "free" | "premium";

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  customName: string;
  phone: string;
  whatsappNumber: string;
  usePhoneAsWhatsapp: boolean;
  whatsappVerified: boolean;
  shippingWM: number;
  shippingEM: number;
  favouritesPublic: boolean;
  trustScore: number;
  createdAt: number;
  tier: MembershipTier;
  scansUsed: number;
  // Epoch ms of the next monthly reset (1st of next month, 00:00 local).
  scansResetAt: number;
}

export const useProfile = (uid?: string) => {
  const { firestore } = useFirebase();
  const profile = ref<UserProfile | null>(null);
  const loading = ref(true);

  let unsubscribe: Unsubscribe | null = null;

  const listen = (targetUid: string) => {
    loading.value = true;
    unsubscribe?.();
    const profileDoc = doc(firestore!, "users", targetUid);
    unsubscribe = onSnapshot(profileDoc, (snapshot) => {
      if (snapshot.exists()) {
        profile.value = { ...snapshot.data(), uid: targetUid } as UserProfile;
      } else {
        profile.value = null;
      }
      loading.value = false;
    });
  };

  if (uid) {
    listen(uid);
  }

  onUnmounted(() => {
    unsubscribe?.();
  });

  return { profile, loading, listen };
};

// Module-level singleton. Previously each component that needed the
// current user's profile (navbar, profile page, every create form,
// auction detail, etc.) opened its own users/{uid} subscription.
const profile = ref<UserProfile | null>(null);
const loading = ref(true);
const isNewUser = ref(false);
let myProfileInitialized = false;
let myProfileUnsubscribe: Unsubscribe | null = null;
let lastUserId: string | null = null;

export const useMyProfile = () => {
  const { firestore } = useFirebase();
  const { user } = useAuth();

  if (!myProfileInitialized) {
    myProfileInitialized = true;
    // Detached effect scope keeps the watch alive across navigations.
    effectScope(true).run(() => {
      watch(
        user,
        (u) => {
        if ((u?.uid || null) === lastUserId) return;
        lastUserId = u?.uid || null;
        myProfileUnsubscribe?.();
        myProfileUnsubscribe = null;
        if (u) {
          const profileDoc = doc(firestore!, "users", u.uid);
          myProfileUnsubscribe = onSnapshot(
            profileDoc,
            (snapshot) => {
              if (snapshot.exists()) {
                const data = snapshot.data();
                // Backfill quota fields for users created before membership shipped.
                const now = new Date();
                const firstOfNextMonth = new Date(
                  now.getFullYear(),
                  now.getMonth() + 1,
                  1,
                ).getTime();
                profile.value = {
                  tier: "free",
                  scansUsed: 0,
                  scansResetAt: firstOfNextMonth,
                  ...data,
                  uid: u.uid,
                } as UserProfile;
                isNewUser.value = false;
              } else {
                // New user — create a minimal profile and flag them
                const now = new Date();
                const firstOfNextMonth = new Date(
                  now.getFullYear(),
                  now.getMonth() + 1,
                  1,
                ).getTime();
                const newProfile: UserProfile = {
                  uid: u.uid,
                  displayName: u.displayName || "Anonymous",
                  photoURL: u.photoURL || "",
                  customName: "",
                  phone: "",
                  whatsappNumber: "",
                  usePhoneAsWhatsapp: true,
                  whatsappVerified: false,
                  shippingWM: 8,
                  shippingEM: 12,
                  favouritesPublic: true,
                  trustScore: 100,
                  createdAt: Date.now(),
                  tier: "free",
                  scansUsed: 0,
                  scansResetAt: firstOfNextMonth,
                };
                setDoc(profileDoc, newProfile);
                profile.value = newProfile;
                isNewUser.value = true;
              }
              loading.value = false;
            },
            (error) => {
              console.error("[useMyProfile] listener error:", error);
              loading.value = false;
            },
          );
        } else {
          profile.value = null;
          isNewUser.value = false;
          loading.value = false;
        }
        },
        { immediate: true },
      );
    });
  }

  const updateProfile = async (
    data: Partial<Omit<UserProfile, "uid" | "createdAt">>,
  ) => {
    if (!user.value) return;
    const profileDoc = doc(firestore!, "users", user.value.uid);
    await updateDoc(profileDoc, data);
    if (data.customName || data.photoURL) {
      isNewUser.value = false;
    }
  };

  const updateCustomName = async (newName: string) => {
    await updateProfile({ customName: newName });
  };

  return { profile, loading, isNewUser, updateProfile, updateCustomName };
};
