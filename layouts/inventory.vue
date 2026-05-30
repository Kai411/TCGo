<template>
  <div class="min-h-screen bg-canvas dark:bg-canvas-inverse text-ink dark:text-zinc-100 transition-colors">
    <!-- Top bar -->
    <header class="sticky top-0 z-40 glass">
      <div class="px-4 h-14 flex items-center justify-between gap-3">
        <div class="flex items-center gap-2 min-w-0">
          <NuxtLink to="/" class="inline-flex items-center gap-1 text-sm text-ink-muted dark:text-zinc-400 hover:text-ink dark:hover:text-white transition-colors shrink-0">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            <span class="hidden sm:inline">Marketplace</span>
          </NuxtLink>
          <span class="text-ink-soft dark:text-zinc-600">/</span>
          <span class="font-bold text-ink dark:text-white truncate">Inventory</span>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <NuxtLink
            to="/inventory/listings/new"
            class="px-3 py-1.5 rounded-full text-xs font-semibold bg-ink text-white dark:bg-white dark:text-ink hover:opacity-90 transition-opacity"
          >
            + Card
          </NuxtLink>
          <NuxtLink
            to="/inventory/auctions/new"
            class="px-3 py-1.5 rounded-full text-xs font-semibold bg-pokemon-red text-white hover:shadow-glow transition-shadow"
          >
            + Auction
          </NuxtLink>
        </div>
      </div>
    </header>

    <div class="lg:flex">
      <!-- Sidebar (desktop) -->
      <aside class="hidden lg:block w-56 shrink-0 border-r border-black/[0.06] dark:border-white/[0.08] min-h-[calc(100vh-3.5rem)] sticky top-14 self-start">
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

          <!-- Coming soon (roadmap signposts) -->
          <div class="pt-3 mt-2 border-t border-black/[0.06] dark:border-white/[0.08]">
            <p class="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-soft dark:text-zinc-600">Coming soon</p>
            <div
              v-for="item in soonItems"
              :key="item.label"
              class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-ink-soft dark:text-zinc-600 cursor-not-allowed"
            >
              <component :is="item.icon" class="w-4 h-4 shrink-0 opacity-60" />
              {{ item.label }}
              <span class="ml-auto text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-black/[0.05] dark:bg-white/[0.06]">Soon</span>
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
    <nav class="lg:hidden fixed bottom-0 inset-x-0 z-40 glass border-t border-black/[0.06] dark:border-white/[0.08] pb-[16px]">
      <div class="grid grid-cols-3 h-16 px-1">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="relative flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold tracking-wide text-ink-soft dark:text-zinc-500 transition-colors"
          :class="isActive(item) ? '!text-pokemon-red' : ''"
        >
          <component :is="item.icon" class="w-6 h-6" />
          <span>{{ item.label }}</span>
        </NuxtLink>
      </div>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { h } from "vue";

const route = useRoute();

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
const IconTag = () =>
  h("svg", { viewBox: "0 0 24 24", ...stroke }, [
    h("path", { d: "M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3H4a1 1 0 0 0-1 1v5.59A2 2 0 0 0 3.83 11l9.58 9.59a2 2 0 0 0 2.83 0l4.35-4.35a2 2 0 0 0 0-2.83z" }),
    h("circle", { cx: "7.5", cy: "7.5", r: "1.5", fill: "currentColor" }),
  ]);
const IconGavel = () =>
  h("svg", { viewBox: "0 0 24 24", ...stroke }, [
    h("path", { d: "M14 4l6 6-3 3-6-6 3-3z" }),
    h("path", { d: "M11 7l-7 7 3 3 7-7" }),
    h("path", { d: "M3 21h12" }),
  ]);
const IconUpload = () =>
  h("svg", { viewBox: "0 0 24 24", ...stroke }, [
    h("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }),
    h("polyline", { points: "17 8 12 3 7 8" }),
    h("line", { x1: "12", y1: "3", x2: "12", y2: "15" }),
  ]);
const IconScan = () =>
  h("svg", { viewBox: "0 0 24 24", ...stroke }, [
    h("path", { d: "M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" }),
    h("line", { x1: "3", y1: "12", x2: "21", y2: "12" }),
  ]);

const navItems = [
  { to: "/inventory", label: "Dashboard", icon: IconDashboard, exact: true },
  { to: "/inventory/listings", label: "Listings", icon: IconTag },
  { to: "/inventory/auctions", label: "Auctions", icon: IconGavel },
];

const soonItems = [
  { label: "Import", icon: IconUpload },
  { label: "POS", icon: IconScan },
];

const isActive = (item: { to: string; exact?: boolean }) => {
  if (item.exact) return route.path === item.to;
  return route.path === item.to || route.path.startsWith(item.to + "/");
};
</script>
