// Re-asks the setup gates once auth and the profile have loaded.
//
// The route middlewares run before either has loaded on a hard refresh or a
// link opened straight into a page, and they let that first navigation
// through rather than guess. Without this, a refresh on /seller/items or
// /checkout skipped setup entirely.
export default defineNuxtPlugin(() => {
  const route = useRoute();
  const { authLoading } = useAuth();
  const { loading } = useMyProfile();

  watch(
    () => !authLoading.value && !loading.value,
    (ready) => {
      if (!ready) return;
      const target = buyerGateRedirect(route) ?? sellerGateRedirect(route);
      if (target) void navigateTo(target, { replace: true });
    },
    { immediate: true },
  );
});
