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

export const useSignInGate = () => {
  const { user } = useAuth();
  const route = useRoute();

  /**
   * True when there's an account to act as. False means the caller should
   * stop — navigation to the login page is already under way.
   */
  const requireSignIn = (): boolean => {
    if (user.value) return true;
    navigateTo({ path: "/login", query: { next: route.fullPath } });
    return false;
  };

  return { requireSignIn };
};
