const ADMIN_UIDS = ["sFXZjtYD13dT2DYE7XDaTwtx4Dn1"];

export const useAdmin = () => {
  const { user } = useAuth();

  const isAdmin = computed(() => {
    return user.value ? ADMIN_UIDS.includes(user.value.uid) : false;
  });

  return { isAdmin };
};
