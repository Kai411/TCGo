// Mint Condition session state for the browser.
//
// Nothing here is a security control. The cookie is httpOnly so this code
// can't read it, and every permission check below only decides what to render
// — the server re-checks each one with requireStaff. A `can()` that returns
// true on a tampered state object gets a 403 from the API, which is the
// intended outcome.

import { hasPermission } from "~/shared/staff";
import type { PermissionDef } from "~/shared/staff";
import type { Ref } from "vue";

export interface StaffMe {
  signedIn: boolean;
  staffId?: string;
  name?: string;
  roleId?: string;
  roleName?: string;
  permissions?: string[];
  legacy?: boolean;
  catalogue?: PermissionDef[];
}

const state = () => useState<StaffMe | null>("mc-staff", () => null);
const ready = () => useState<boolean>("mc-staff-ready", () => false);

/**
 * Headers for a console request.
 *
 * `x-mc-auth` is the CSRF marker the server requires on state-changing calls.
 *
 * The Authorization header is the bootstrap path, and it has to be here or
 * the console is unusable on a fresh install: the very first staff account
 * can only be created by the legacy marketplace-admin bridge, and without a
 * Firebase token an admin is redirected to a login page that needs an account
 * only the bridge can create. Once real staff accounts exist the cookie takes
 * over — requireStaff tries it first and never reaches this.
 *
 * The auth refs are passed in rather than read here: useAuth() reaches for the
 * Nuxt instance, and this runs inside async call chains where that context is
 * already gone. Resolving them in setup and closing over them keeps the bridge
 * working from every call site instead of only the ones that happen to call in
 * before their first await.
 */
const buildHeaders = async (
  user: Ref<{ getIdToken: () => Promise<string> } | null>,
  authLoading: Ref<boolean>,
): Promise<Record<string, string>> => {
  const headers: Record<string, string> = { "x-mc-auth": "1" };
  try {
    // Firebase restores the session asynchronously. Without this wait, a hard
    // refresh races the listener and drops the token on the first request,
    // which reads to the user as being randomly signed out.
    if (authLoading.value) {
      await new Promise<void>((resolve) => {
        const stop = watch(authLoading, (l) => {
          if (!l) {
            stop();
            resolve();
          }
        });
        // Never hang the console if Firebase doesn't initialise at all.
        setTimeout(() => {
          stop();
          resolve();
        }, 3000);
      });
    }
    if (user.value) {
      headers.Authorization = `Bearer ${await user.value.getIdToken()}`;
    }
  } catch {
    // No Firebase is a perfectly normal state for a staff-only account.
  }
  return headers;
};

export const useStaffAuth = () => {
  const me = state();
  const loaded = ready();
  const { user, authLoading } = useAuth();
  const headers = () => buildHeaders(user as any, authLoading);

  /**
   * Ask the server who we are.
   *
   * `credentials: "include"` is explicit rather than relying on the
   * same-origin default — the console is one deploy away from living on its
   * own subdomain, and a silent auth failure at that point would be a
   * miserable thing to debug.
   */
  const refresh = async (): Promise<StaffMe> => {
    try {
      const res = await $fetch<StaffMe>("/api/mc/me", {
        credentials: "include",
        headers: await headers(),
      });
      me.value = res;
      return res;
    } catch {
      me.value = { signedIn: false };
      return me.value;
    } finally {
      loaded.value = true;
    }
  };

  /** Load once per page load; subsequent callers reuse the result. */
  const ensure = async (): Promise<StaffMe> => {
    if (loaded.value && me.value) return me.value;
    return refresh();
  };

  const login = async (staffId: string, password: string) => {
    const res = await $fetch<{ ok: boolean; mustChangePassword: boolean }>(
      "/api/mc/login",
      {
        method: "POST",
        body: { staffId, password },
        credentials: "include",
        headers: await headers(),
      },
    );
    await refresh();
    return res;
  };

  const logout = async () => {
    await $fetch("/api/mc/logout", {
      method: "POST",
      credentials: "include",
      headers: await headers(),
    }).catch(() => undefined);
    me.value = { signedIn: false };
    await navigateTo("/mintcondition/login");
  };

  const signedIn = computed(() => !!me.value?.signedIn);
  const can = (permission: string) =>
    hasPermission(me.value?.permissions, permission);

  return { me, loaded, signedIn, can, refresh, ensure, login, logout };
};

/**
 * Authenticated fetch for console routes.
 *
 * Adds `x-mc-auth` to every request. SameSite=Lax already blocks cross-site
 * POSTs, but a custom header can't be set by a simple cross-origin form or
 * image request either, so this is a second independent barrier against CSRF
 * on routes that send money.
 */
export const useMcFetch = () => {
  // Resolved here, in setup, for the reason given on buildHeaders.
  const { user, authLoading } = useAuth();

  const mcFetch = async <T>(url: string, opts: Record<string, any> = {}): Promise<T> =>
    (await $fetch(url, {
      ...opts,
      credentials: "include",
      headers: {
        ...(await buildHeaders(user as any, authLoading)),
        ...(opts.headers || {}),
      },
    })) as T;
  return { mcFetch };
};
