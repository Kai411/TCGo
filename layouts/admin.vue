<template>
  <div class="mc mc-shell">
    <!-- Sidebar: sticky on desktop, a drawer under 900px -->
    <aside
      id="mc-nav"
      class="mc-side"
      :class="{ 'is-open': drawerOpen }"
      :aria-hidden="isNarrow && !drawerOpen ? 'true' : undefined"
      :inert="isNarrow && !drawerOpen ? true : undefined"
    >
      <div class="mc-brand">
        <NuxtLink to="/mintcondition" class="mc-brand-name">Mint Condition</NuxtLink>
        <span class="mc-small">TCGo operations</span>
      </div>

      <nav class="mc-nav" aria-label="Mint Condition">
        <template v-for="group in navGroups" :key="group.label">
          <p class="mc-eyebrow mc-nav-group">{{ group.label }}</p>
          <NuxtLink
            v-for="item in group.items"
            :key="item.to"
            :to="item.to"
            class="mc-nav-link"
            :aria-current="isActive(item) ? 'page' : undefined"
          >
            <component :is="item.icon" class="mc-nav-icon" />
            <span class="truncate">{{ item.label }}</span>
          </NuxtLink>
        </template>

        <template v-if="soonItems.length">
          <p class="mc-eyebrow mc-nav-group">Coming soon</p>
          <div
            v-for="item in soonItems"
            :key="item.label"
            class="mc-nav-link is-soon"
            aria-disabled="true"
          >
            <component :is="item.icon" class="mc-nav-icon" />
            <span class="truncate">{{ item.label }}</span>
          </div>
        </template>
      </nav>

      <div class="mc-side-foot">
        <NuxtLink v-if="me?.signedIn" to="/mintcondition/account" class="mc-me">
          <span class="mc-avatar" aria-hidden="true">{{ initials }}</span>
          <span class="min-w-0">
            <span class="mc-me-name">{{ me.name || me.staffId }}</span>
            <span class="mc-small block truncate">{{ me.staffId }} · {{ me.roleName }}</span>
          </span>
        </NuxtLink>
        <div class="mc-side-actions">
          <NuxtLink to="/" class="mc-btn mc-btn-ghost mc-btn-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
            Marketplace
          </NuxtLink>
          <button v-if="me?.signedIn" class="mc-btn mc-btn-sm" @click="logout">Sign out</button>
        </div>
      </div>
    </aside>

    <Transition name="mc-scrim">
      <div v-if="drawerOpen" class="mc-scrim" aria-hidden="true" @click="drawerOpen = false" />
    </Transition>

    <div class="mc-body">
      <!-- Top bar, narrow screens only -->
      <header class="mc-topbar">
        <button
          class="mc-btn mc-btn-ghost mc-btn-icon"
          aria-controls="mc-nav"
          :aria-expanded="drawerOpen"
          aria-label="Open menu"
          @click="drawerOpen = true"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
        </button>
        <span class="mc-topbar-title truncate">{{ currentLabel }}</span>
        <span class="mc-small shrink-0">Mint Condition</span>
      </header>

      <!-- The bridge is meant to be temporary; saying so is the only thing
           that stops it quietly becoming permanent. -->
      <div v-if="me?.legacy" class="mc-page !pb-0">
        <p class="mc-callout">
          Signed in through the marketplace admin bridge, not a staff account.
          Create one on
          <NuxtLink to="/mintcondition/staff" class="underline font-semibold">Staff</NuxtLink>
          and use that instead.
        </p>
      </div>

      <main class="mc-main">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { h } from "vue";
import "~/assets/css/mint-condition.css";

const route = useRoute();

// Keep the whole admin surface out of search results. The obscure path only
// stops casual discovery — requireAdmin on the server routes is the actual
// control — but there's no reason to let a crawler index it either. Note we
// deliberately do NOT add it to robots.txt: a Disallow line would advertise
// the path to anyone who reads it.
useHead({ meta: [{ name: "robots", content: "noindex, nofollow" }] });

const stroke = {
  fill: "none",
  stroke: "currentColor",
  "stroke-width": "2",
  "stroke-linecap": "round",
  "stroke-linejoin": "round",
};

const IconDashboard = () =>
  h("svg", { viewBox: "0 0 24 24", ...stroke }, [
    h("path", { d: "M3 13h8V3H3zM13 21h8V3h-8zM3 21h8v-6H3z" }),
  ]);
const IconWallet = () =>
  h("svg", { viewBox: "0 0 24 24", ...stroke }, [
    h("rect", { x: "2", y: "5", width: "20", height: "14", rx: "2" }),
    h("line", { x1: "2", y1: "10", x2: "22", y2: "10" }),
  ]);
const IconFlag = () =>
  h("svg", { viewBox: "0 0 24 24", ...stroke }, [
    h("path", { d: "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" }),
    h("line", { x1: "4", y1: "22", x2: "4", y2: "15" }),
  ]);
const IconInbox = () =>
  h("svg", { viewBox: "0 0 24 24", ...stroke }, [
    h("path", { d: "M22 12h-6l-2 3h-4l-2-3H2" }),
    h("path", { d: "M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" }),
  ]);
const IconUsers = () =>
  h("svg", { viewBox: "0 0 24 24", ...stroke }, [
    h("path", { d: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" }),
    h("circle", { cx: "9", cy: "7", r: "4" }),
    h("path", { d: "M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" }),
  ]);
const IconChart = () =>
  h("svg", { viewBox: "0 0 24 24", ...stroke }, [
    h("line", { x1: "18", y1: "20", x2: "18", y2: "10" }),
    h("line", { x1: "12", y1: "20", x2: "12", y2: "4" }),
    h("line", { x1: "6", y1: "20", x2: "6", y2: "14" }),
  ]);

const IconImage = () =>
  h("svg", { viewBox: "0 0 24 24", ...stroke }, [
    h("rect", { x: "3", y: "3", width: "18", height: "18", rx: "2" }),
    h("circle", { cx: "9", cy: "9", r: "2" }),
    h("path", { d: "m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21" }),
  ]);

const IconList = () =>
  h("svg", { viewBox: "0 0 24 24", ...stroke }, [
    h("line", { x1: "8", y1: "6", x2: "21", y2: "6" }),
    h("line", { x1: "8", y1: "12", x2: "21", y2: "12" }),
    h("line", { x1: "8", y1: "18", x2: "21", y2: "18" }),
    h("line", { x1: "3", y1: "6", x2: "3.01", y2: "6" }),
    h("line", { x1: "3", y1: "12", x2: "3.01", y2: "12" }),
    h("line", { x1: "3", y1: "18", x2: "3.01", y2: "18" }),
  ]);

const { me, can, logout } = useStaffAuth();

// Hiding a link isn't access control — the server rejects the call regardless.
// It's so nobody spends their day clicking into pages that will only tell them
// no.
const allNav = [
  { to: "/mintcondition", label: "Overview", icon: IconDashboard, exact: true, perm: "overview.view" },
  { to: "/mintcondition/payouts", label: "Payouts", icon: IconWallet, perm: "payouts.view" },
  { to: "/mintcondition/refunds", label: "Refunds", icon: IconWallet, perm: "payouts.view" },
  { to: "/mintcondition/problems", label: "Order problems", icon: IconFlag, perm: "reports.view" },
  { to: "/mintcondition/reports", label: "Reports", icon: IconFlag, perm: "reports.view" },
  { to: "/mintcondition/enquiries", label: "Enquiries", icon: IconInbox, perm: "reports.view" },
  { to: "/mintcondition/content", label: "Content", icon: IconImage, perm: "content.manage" },
  { to: "/mintcondition/logs", label: "Logs", icon: IconList, perm: "logs.view" },
  { to: "/mintcondition/staff", label: "Staff", icon: IconUsers, perm: "staff.view" },
];

const navItems = computed(() => allNav.filter((i) => can(i.perm)));

// Grouped by the kind of work, so nine links read as four short lists.
const groupOf: Record<string, string> = {
  "/mintcondition": "Money",
  "/mintcondition/payouts": "Money",
  "/mintcondition/refunds": "Money",
  "/mintcondition/problems": "Trust and safety",
  "/mintcondition/reports": "Trust and safety",
  "/mintcondition/enquiries": "Trust and safety",
  "/mintcondition/content": "Site",
  "/mintcondition/logs": "Admin",
  "/mintcondition/staff": "Admin",
};
const navGroups = computed(() => {
  const groups: { label: string; items: typeof allNav }[] = [];
  for (const item of navItems.value) {
    const label = groupOf[item.to] ?? "More";
    let g = groups.find((x) => x.label === label);
    if (!g) groups.push((g = { label, items: [] }));
    g.items.push(item);
  }
  return groups;
});

const currentLabel = computed(
  () =>
    allNav.find((i) => isActive(i))?.label ??
    (route.path.startsWith("/mintcondition/account") ? "Account" : "Mint Condition"),
);

const initials = computed(() => {
  const n = (me.value?.name || me.value?.staffId || "").trim();
  const parts = n.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "MC";
});

// Drawer for narrow screens. Closes on navigation and on Escape.
const drawerOpen = ref(false);
const isNarrow = ref(false);
let mq: MediaQueryList | null = null;
const syncNarrow = () => {
  isNarrow.value = !!mq?.matches;
  if (!isNarrow.value) drawerOpen.value = false;
};
const onKey = (e: KeyboardEvent) => {
  if (e.key === "Escape") drawerOpen.value = false;
};
onMounted(() => {
  mq = window.matchMedia("(max-width: 899.98px)");
  syncNarrow();
  mq.addEventListener("change", syncNarrow);
  window.addEventListener("keydown", onKey);
});
onBeforeUnmount(() => {
  mq?.removeEventListener("change", syncNarrow);
  window.removeEventListener("keydown", onKey);
});
watch(() => route.fullPath, () => (drawerOpen.value = false));

// Signposts for what this dashboard is meant to grow into, so the nav doesn't
// silently imply these already exist somewhere else.
const soonItems: { label: string; icon: any }[] = [
  { label: "Accounting", icon: IconChart },
];

const isActive = (item: { to: string; exact?: boolean }) => {
  if (item.exact) return route.path === item.to;
  return route.path === item.to || route.path.startsWith(item.to + "/");
};
</script>

<style>
.mc-shell {
  min-height: 100vh;
  min-height: 100dvh;
  display: grid;
  grid-template-columns: 248px minmax(0, 1fr);
}
.mc-side {
  position: sticky;
  top: 0;
  height: 100vh;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  border-right: 1px solid var(--line);
  user-select: none;
}
.mc-brand {
  display: flex;
  flex-direction: column;
  padding: 20px 20px 12px;
}
.mc-brand-name {
  font-size: 15px;
  font-weight: 650;
  letter-spacing: -0.01em;
  color: var(--ink);
}
.mc-nav {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 4px 12px 12px;
}
.mc-nav-group {
  padding: 16px 10px 6px;
}
.mc-nav-group:first-child {
  padding-top: 8px;
}
.mc-nav-link {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 32px;
  padding: 0 10px;
  border-radius: 7px;
  font-size: 13.5px;
  font-weight: 500;
  color: var(--ink-2);
  transition:
    background-color 120ms ease,
    color 120ms ease;
}
.mc-nav-link[aria-current="page"] {
  background: var(--surface-3);
  color: var(--ink);
}
.mc-nav-link.is-soon {
  color: var(--ink-3);
  cursor: default;
}
.mc-nav-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}
@media (hover: hover) and (pointer: fine) {
  .mc-nav-link:not(.is-soon):not([aria-current="page"]):hover {
    background: var(--surface-2);
    color: var(--ink);
  }
}
.mc-side-foot {
  border-top: 1px solid var(--line);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.mc-me {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px;
  margin: -6px;
  border-radius: 8px;
  min-width: 0;
}
@media (hover: hover) and (pointer: fine) {
  .mc-me:hover {
    background: var(--surface-2);
  }
}
.mc-me-name {
  display: block;
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mc-avatar {
  width: 30px;
  height: 30px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  font-size: 11.5px;
  font-weight: 650;
  background: oklch(90% 0.045 33);
  color: oklch(38% 0.08 33);
}
.dark .mc-avatar {
  background: oklch(36% 0.06 33);
  color: oklch(90% 0.05 33);
}
.mc-side-actions {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
.mc-side-actions .mc-btn-ghost {
  padding-left: 6px;
}
.mc-body {
  min-width: 0;
}
.mc-topbar {
  display: none;
}

@media (max-width: 899.98px) {
  .mc-shell {
    display: block;
  }
  .mc-side {
    position: fixed;
    z-index: 60;
    inset: 0 auto 0 0;
    width: 272px;
    max-width: 85vw;
    background: var(--surface);
    box-shadow: var(--shadow-3);
    transform: translateX(-100%);
    visibility: hidden;
    transition:
      transform 320ms var(--ease-drawer),
      visibility 0s linear 320ms;
  }
  .mc-side.is-open {
    transform: none;
    visibility: visible;
    transition:
      transform 320ms var(--ease-drawer),
      visibility 0s;
  }
  .mc-side-foot {
    padding-bottom: calc(12px + env(safe-area-inset-bottom));
  }
  .mc-scrim {
    position: fixed;
    inset: 0;
    z-index: 55;
    background: var(--scrim);
  }
  .mc-topbar {
    position: sticky;
    top: 0;
    z-index: 40;
    display: flex;
    align-items: center;
    gap: 6px;
    height: 52px;
    padding: 0 12px 0 6px;
    padding-top: env(safe-area-inset-top);
    box-sizing: content-box;
    background: color-mix(in oklch, var(--bg) 88%, transparent);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--line);
  }
  .mc-topbar-title {
    flex: 1;
    min-width: 0;
    font-size: 15px;
    font-weight: 600;
  }
}
.mc-scrim-enter-active {
  transition: opacity 240ms ease;
}
.mc-scrim-leave-active {
  transition: opacity 180ms ease;
}
.mc-scrim-enter-from,
.mc-scrim-leave-to {
  opacity: 0;
}

/* Pages that predate the system bring their own width and padding; give them
   the standard page gutter. The Overview uses .mc-page itself. */
.mc-main {
  padding: 28px 32px 64px;
}
.mc-main:has(> .mc-page) {
  padding: 0;
}
@media (max-width: 720px) {
  .mc-main {
    padding: 20px 16px 48px;
  }
}
</style>
