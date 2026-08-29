<template>
  <div
    class="min-h-screen bg-canvas dark:bg-canvas-inverse text-ink dark:text-zinc-100 transition-colors"
  >
    <!-- Top bar -->
    <header class="sticky top-0 z-40 glass">
      <div class="px-4 h-14 flex items-center justify-between gap-3">
        <div class="flex items-center gap-2 min-w-0">
          <NuxtLink
            to="/"
            class="inline-flex items-center gap-1 text-sm text-ink-muted dark:text-zinc-400 hover:text-ink dark:hover:text-white transition-colors shrink-0"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            <span class="hidden sm:inline">Marketplace</span>
          </NuxtLink>
          <span class="text-ink-soft dark:text-zinc-600">/</span>
          <span class="font-bold text-ink dark:text-white truncate">Operations</span>
          <span
            class="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-pokemon-red/10 text-pokemon-red"
            >Admin</span
          >
        </div>

        <div v-if="me?.signedIn" class="flex items-center gap-2 shrink-0">
          <NuxtLink
            to="/mintcondition/account"
            class="hidden sm:flex flex-col items-end leading-tight group"
          >
            <span class="text-[11px] font-mono font-bold group-hover:underline">{{ me.staffId }}</span>
            <span class="text-[10px] text-ink-soft dark:text-zinc-500">{{ me.roleName }}</span>
          </NuxtLink>
          <button
            class="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-black/[0.08] dark:border-white/[0.10] text-ink-muted dark:text-zinc-300"
            @click="logout"
          >
            Sign out
          </button>
        </div>
      </div>

      <!-- The bridge is meant to be temporary; saying so is the only thing
           that stops it quietly becoming permanent. -->
      <p
        v-if="me?.legacy"
        class="px-4 pb-2 text-[11px] leading-relaxed text-amber-700 dark:text-amber-400"
      >
        Signed in through the marketplace admin bridge, not a staff account.
        Create one on
        <NuxtLink to="/mintcondition/staff" class="underline font-semibold">Staff</NuxtLink>
        and use that instead.
      </p>
    </header>

    <div class="lg:flex">
      <!-- Sidebar (desktop) -->
      <aside
        class="hidden lg:block w-56 shrink-0 border-r border-black/[0.06] dark:border-white/[0.08] min-h-[calc(100vh-3.5rem)] sticky top-14 self-start"
      >
        <nav class="p-3 space-y-0.5">
          <NuxtLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
            :class="
              isActive(item)
                ? 'bg-ink text-white dark:bg-white dark:text-ink'
                : 'text-ink-muted dark:text-zinc-400 hover:text-ink dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
            "
          >
            <component :is="item.icon" class="w-4 h-4 shrink-0" />
            {{ item.label }}
          </NuxtLink>

          <div
            v-if="soonItems.length"
            class="pt-3 mt-2 border-t border-black/[0.06] dark:border-white/[0.08]"
          >
            <p
              class="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-soft dark:text-zinc-600"
            >
              Coming soon
            </p>
            <div
              v-for="item in soonItems"
              :key="item.label"
              class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-ink-soft dark:text-zinc-600 cursor-not-allowed"
            >
              <component :is="item.icon" class="w-4 h-4 shrink-0 opacity-60" />
              {{ item.label }}
              <span
                class="ml-auto text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-black/[0.05] dark:bg-white/[0.06]"
                >Soon</span
              >
            </div>
          </div>
        </nav>
      </aside>

      <!-- Main -->
      <main class="flex-1 min-w-0 px-4 py-6 pb-28 lg:pb-10">
        <slot />
      </main>
    </div>

    <!-- Mobile bottom nav -->
    <nav
      class="lg:hidden fixed bottom-0 inset-x-0 z-40 glass border-t border-black/[0.06] dark:border-white/[0.08] pb-[16px]"
    >
      <div class="flex h-16 px-1 overflow-x-auto no-scrollbar">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="relative flex flex-col items-center justify-center gap-0.5 shrink-0 min-w-[68px] flex-1 text-[9px] font-semibold tracking-wide text-ink-soft dark:text-zinc-500 transition-colors"
          :class="isActive(item) ? '!text-pokemon-red' : ''"
        >
          <component :is="item.icon" class="w-5 h-5" />
          <span>{{ item.label }}</span>
        </NuxtLink>
      </div>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { h } from "vue";

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
  { to: "/mintcondition/reports", label: "Reports", icon: IconFlag, perm: "reports.view" },
  { to: "/mintcondition/logs", label: "Logs", icon: IconList, perm: "logs.view" },
  { to: "/mintcondition/staff", label: "Staff", icon: IconUsers, perm: "staff.view" },
];

const navItems = computed(() => allNav.filter((i) => can(i.perm)));

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
