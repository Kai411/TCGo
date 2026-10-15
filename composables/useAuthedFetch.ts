// $fetch wrapper that attaches the caller's Firebase ID token.
//
// Any server route guarded by requireUser/requireAdmin must be called through
// this — a bare $fetch will come back 401.

export const useAuthedFetch = () => {
  const { user } = useAuth();

  const authedFetch = async <T>(
    url: string,
    opts: Record<string, any> = {},
  ): Promise<T> => {
    if (!user.value) {
      throw createError({ statusCode: 401, message: "Sign in required" });
    }
    // Firebase refreshes this automatically when it's close to expiry.
    const token = await user.value.getIdToken();
    return (await $fetch(url, {
      ...opts,
      headers: { ...(opts.headers || {}), Authorization: `Bearer ${token}` },
    })) as T;
  };

  return { authedFetch };
};
