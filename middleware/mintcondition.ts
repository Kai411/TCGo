// Gate for the operations console.
//
// A convenience redirect, not a control: this runs in the browser and can be
// skipped by anyone who wants to. What actually protects the console is that
// every /api/mc route and every admin route calls requireStaff, so a page
// reached without a session renders empty and errors on load.

export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === "/mintcondition/login") return;

  const { ensure } = useStaffAuth();
  const me = await ensure();

  if (!me.signedIn) {
    // Remember where they were headed so signing in doesn't dump them on the
    // dashboard when they clicked a link to a specific payout.
    return navigateTo({
      path: "/mintcondition/login",
      query: to.fullPath !== "/mintcondition" ? { next: to.fullPath } : undefined,
    });
  }
});
