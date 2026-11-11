// "You need an account for that" — in one place.
//
// Browsing is open; only the actions that write something need an account.
// Rather than each page deciding what to do about a signed-out visitor, they
// call requireSignIn() and carry on only if it returns true.
//
// It sends people to the login page rather than opening a Google popup,
// because a popup is not a choice: it presumes Google is how you sign in, and
// it loses the page you were on. Passing `next` means the visitor lands back
// exactly where they were, which is the difference between an interruption
// and a dead end.

// Set once any account signs in on this device. Without it, the login page
// opens on "Create your account": a first-time visitor tapping "Sign in to
// buy" was greeted with "Welcome back" and had to find the sign-up link.
export const SIGNED_IN_BEFORE_KEY = "tcgo:signed-in-before";

const loginMode = (): "signin" | "register" => {
  try {
    return localStorage.getItem(SIGNED_IN_BEFORE_KEY) ? "signin" : "register";
  } catch {
    return "signin";
  }
};

export const useSignInGate = () => {
  const { user } = useAuth();
  const route = useRoute();

  /**
   * True when there's an account to act as. False means the caller should
   * stop — navigation to the login page is already under way.
   */
  const requireSignIn = (): boolean => {
    if (user.value) return true;
    navigateTo({ path: "/login", query: { next: route.fullPath, mode: loginMode() } });
    return false;
  };

  /**
   * Send someone to the login page, keeping their place.
   *
   * The click handler for every "Sign in" button. Previously those called
   * signInWithGoogle() directly, which made Google the only way in and threw
   * away the page the visitor was on.
   */
  // Most callers bind this straight to @click, so the argument is often the
  // click event: only an explicit mode string overrides the default.
  const goToLogin = (mode?: unknown) => {
    const m = mode === "signin" || mode === "register" ? mode : loginMode();
    navigateTo({ path: "/login", query: { next: route.fullPath, mode: m } });
  };

  return { requireSignIn, goToLogin };
};
