// Mint Condition session state for the browser.
//
// Nothing here is a security control. The cookie is httpOnly so this code
// can't read it, and every permission check below only decides what to render
// — the server re-checks each one with requireStaff. A `can()` that returns
// true on a tampered state object gets a 403 from the API, which is the
// intended outcome.

import { hasPermission } from "~/shared/staff";
import type { PermissionDef } from "~/shared/staff";

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

export const useStaffAuth = () => {
  const me = state();
  const loaded = ready();

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
      const res = await $fetch<StaffMe>("/api/mc/me", { credentials: "include" });
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
        headers: { "x-mc-auth": "1" },
      },
    );
    await refresh();
    return res;
  };

  const logout = async () => {
    await $fetch("/api/mc/logout", {
      method: "POST",
      credentials: "include",
      headers: { "x-mc-auth": "1" },
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
  const mcFetch = async <T>(url: string, opts: Record<string, any> = {}): Promise<T> =>
    (await $fetch(url, {
      ...opts,
      credentials: "include",
      headers: { ...(opts.headers || {}), "x-mc-auth": "1" },
    })) as T;
  return { mcFetch };
};
