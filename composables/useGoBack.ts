/**
 * Back button that returns to whatever in-app page came before, like the
 * phone's own back gesture. Vue Router records the previous entry in
 * history.state.back; when there is none (opened from a push, a bell item,
 * a refresh or a direct link) it goes to `fallback` instead.
 *
 *   const goBack = useGoBack("/messages");
 *   <button @click="goBack">
 */
export const useGoBack = (fallback: string) => {
  const router = useRouter();
  return () => {
    if (import.meta.client && window.history.state?.back) router.back();
    else navigateTo(fallback, { replace: true });
  };
};
