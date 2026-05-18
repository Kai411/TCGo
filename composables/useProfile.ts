import {
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { ref, onUnmounted } from "vue";

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
  createdAt: number;
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

export const useMyProfile = () => {
  const { firestore } = useFirebase();
  const { user } = useAuth();
  const profile = ref<UserProfile | null>(null);
  const loading = ref(true);
  const isNewUser = ref(false);

  let unsubscribe: Unsubscribe | null = null;

  watch(
    user,
    (u) => {
      unsubscribe?.();
      if (u) {
        const profileDoc = doc(firestore!, "users", u.uid);
        unsubscribe = onSnapshot(
          profileDoc,
          (snapshot) => {
            if (snapshot.exists()) {
              profile.value = { ...snapshot.data(), uid: u.uid } as UserProfile;
              isNewUser.value = false;
            } else {
              // New user — create a minimal profile and flag them
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
                createdAt: Date.now(),
              };
              setDoc(profileDoc, newProfile);
              profile.value = newProfile;
              isNewUser.value = true;
            }
            loading.value = false;
          },
          (error) => {
            console.error("My profile listener error:", error);
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

  onUnmounted(() => {
    unsubscribe?.();
  });

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
