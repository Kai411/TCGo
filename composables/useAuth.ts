import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  reload,
  type User,
} from "firebase/auth";
import { computed, ref } from "vue";

const user = ref<User | null>(null);
const authLoading = ref(true);
let initialized = false;

/**
 * Firebase's own error codes, in words a person can act on.
 *
 * Two deliberate choices. Wrong password and unknown account give the SAME
 * message, because separate ones turn the login form into a way to discover
 * who has an account. And "too many requests" says what to do rather than
 * just naming the problem.
 */
const AUTH_MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "That email and password don't match.",
  "auth/wrong-password": "That email and password don't match.",
  "auth/user-not-found": "That email and password don't match.",
  "auth/invalid-email": "That doesn't look like an email address.",
  "auth/email-already-in-use": "That address already has an account. Try signing in.",
  "auth/weak-password": "Use at least 8 characters.",
  "auth/user-disabled": "That account has been disabled. Get in touch if that's unexpected.",
  "auth/too-many-requests": "Too many attempts. Wait a few minutes and try again.",
  "auth/popup-closed-by-user": "Sign-in was cancelled.",
  "auth/popup-blocked": "Your browser blocked the sign-in window. Allow pop-ups and retry.",
  "auth/network-request-failed": "Couldn't reach the server. Check your connection.",
};

export const authMessage = (e: unknown): string => {
  const code = (e as { code?: string })?.code ?? "";
  return (
    AUTH_MESSAGES[code] ||
    (e as { message?: string })?.message ||
    "Something went wrong. Try again."
  );
};

export const useAuth = () => {
  const { app } = useFirebase();
  const auth = getAuth(app!);

  if (!initialized) {
    initialized = true;
    onAuthStateChanged(auth, (u) => {
      user.value = u;
      authLoading.value = false;
    });
  }

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const signInWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  };

  /**
   * Create the account, then ask the server to email a code.
   *
   * The account exists before it is verified, on purpose: Firebase needs a
   * user to hang `emailVerified` on, and a half-finished signup that the user
   * can complete later beats one that vanishes if they close the tab.
   */
  const registerWithEmail = async (
    email: string,
    password: string,
    displayName?: string,
  ) => {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    if (displayName?.trim()) {
      await updateProfile(cred.user, { displayName: displayName.trim() });
    }
    await requestCode(email, "verify_email");
  };

  /** Ask for a verification or reset code. Never reveals whether the account exists. */
  const requestCode = async (email: string, purpose: "verify_email" | "reset_password") =>
    await $fetch<{ sent: boolean; message: string }>("/api/auth/send-code", {
      method: "POST",
      body: { email: email.trim(), purpose },
    });

  const confirmEmail = async (email: string, code: string) => {
    await $fetch("/api/auth/verify-email", {
      method: "POST",
      body: { email: email.trim(), code: code.trim() },
    });
    // The flag lives on the token, so it stays stale until the client refetches.
    if (auth.currentUser) {
      await reload(auth.currentUser);
      user.value = auth.currentUser;
    }
  };

  const resetPassword = async (email: string, code: string, password: string) =>
    await $fetch("/api/auth/reset-password", {
      method: "POST",
      body: { email: email.trim(), code: code.trim(), password },
    });

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  /**
   * Google accounts arrive verified; email signups do not until they enter
   * the code. Anything gating on a real address should read this.
   */
  const emailVerified = computed(() => !!user.value?.emailVerified);

  return {
    user,
    authLoading,
    emailVerified,
    signInWithGoogle,
    signInWithEmail,
    registerWithEmail,
    requestCode,
    confirmEmail,
    resetPassword,
    signOut,
  };
};
