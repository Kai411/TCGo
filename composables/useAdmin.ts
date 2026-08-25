import { isAdminUid } from "~/shared/admins";

export const useAdmin = () => {
  const { user } = useAuth();

  // UI gate only — money-moving server routes re-check with requireAdmin().
  const isAdmin = computed(() => isAdminUid(user.value?.uid));

  return { isAdmin };
};
