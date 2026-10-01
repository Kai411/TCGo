import { getAuth } from "firebase/auth";

// $fetch for our own /api routes, signed in as the current Firebase user.
// The server reads the caller from this token, never from the request body.
export const useApi = () => {
  const { app } = useFirebase();

  const apiFetch = async <T>(
    url: string,
    opts: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: Record<string, unknown> } = {},
  ): Promise<T> => {
    const current = getAuth(app!).currentUser;
    if (!current) throw new Error("Please sign in first.");
    const idToken = await current.getIdToken();
    return (await $fetch(url, {
      method: opts.method ?? "GET",
      body: opts.body,
      headers: { Authorization: `Bearer ${idToken}` },
    })) as T;
  };

  return { apiFetch };
};
