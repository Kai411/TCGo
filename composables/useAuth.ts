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
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  type User,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { computed, ref } from "vue";
import { SIGNED_IN_BEFORE_KEY } from "~/composables/useSignInGate";

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
      if (u) {
        try {
          localStorage.setItem(SIGNED_IN_BEFORE_KEY, "1");
        } catch {
          // Storage blocked: the login page just opens on sign-up next time.
        }
      }
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
   * Create the account, record the PDPA consent ticked on the form, then
   * ask the server to email a code.
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

    // The form only calls this once the PDPA consent box is ticked, so record
    // it now, before anything else is collected. A failed write doesn't undo
    // the account: onboarding sees no consent on file and asks again.
    await recordConsentFor(cred.user.uid, "signup").catch((e) =>
      console.warn("[consent] not recorded at sign-up", e),
    );

    const name = displayName?.trim();
    if (name) {
      // Two writes, because the name has to reach two places.
      //
      // Auth carries it for anything reading the token; Firestore's
      // customName is what the app actually displays. useProfile's listener
      // creates that document the instant the account exists — which is
      // BEFORE this line runs — so it seeds customName from an Auth profile
      // that is still nameless. Writing it here, merged, is what makes the
      // name entered at signup the name on the settings page.
      await updateProfile(cred.user, { displayName: name });
      const { firestore } = useFirebase();
      // Not fatal: if the profile write is refused, the code still has to go
      // out, or the new account is stuck unverified. useProfile adopts the
      // Auth name on the next visit.
      await setDoc(
        doc(firestore!, "users", cred.user.uid),
        { displayName: name, customName: name },
        { merge: true },
      ).catch((e) => console.error("[registerWithEmail] profile name:", e));
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

  /**
   * Email and password accounts only. Firebase wants a recent sign-in before
   * a password change, so the current password re-authenticates first; that
   * also means a borrowed, unlocked phone can't change it.
   */
  const changePassword = async (current: string, next: string) => {
    const u = auth.currentUser;
    if (!u?.email) throw new Error("Sign in again to change your password.");
    await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, current));
    await updatePassword(u, next);
  };

  const signOut = async () => {
    // While still signed in: the server needs the token to drop this
    // device's push subscription, so the next person on it doesn't get ours.
    await usePush().forgetDevice();
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
    changePassword,
    signOut,
  };
};
