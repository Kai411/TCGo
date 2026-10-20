<template>
  <!-- Account shortcut that opens a small menu: manage Shop listings or
       Auctions. Members who haven't finished seller setup are sent to it
       from either option, like the Start selling card. The menu is anchored
       to the button's right edge, so it stays inside the screen in the last
       column. -->
  <div ref="root" class="relative">
    <button
      ref="trigger"
      type="button"
      class="press w-full flex flex-col items-center justify-center gap-1.5 min-h-[64px] text-xs font-medium text-ink-muted dark:text-zinc-300"
      :class="open && 'text-ink dark:text-white'"
      aria-haspopup="menu"
      :aria-expanded="open"
      aria-controls="manage-listings-menu"
      @click="open = !open"
    >
      <svg class="w-6 h-6" v-bind="stroke">
        <path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3H4a1 1 0 0 0-1 1v5.59A2 2 0 0 0 3.83 11l9.58 9.59a2 2 0 0 0 2.83 0l4.35-4.35a2 2 0 0 0 0-2.83z" />
        <circle cx="7.5" cy="7.5" r="1.5" fill="currentColor" />
      </svg>
      <span class="whitespace-nowrap">Manage Listings</span>
    </button>

    <Transition name="ml-menu">
      <div
        v-if="open"
        id="manage-listings-menu"
        role="menu"
        aria-label="Manage listings"
        class="absolute right-0 top-full mt-1 z-30 w-56 p-1.5 rounded-2xl surface border border-black/[0.06] dark:border-white/[0.08] shadow-lg origin-top-right"
        @keydown="onMenuKey"
      >
        <NuxtLink
          v-for="item in items"
          :key="item.label"
          :to="isSeller ? item.to : '/seller/onboarding'"
          role="menuitem"
          class="flex items-center gap-3 min-h-[52px] px-2.5 rounded-xl text-left hover:bg-black/[0.04] dark:hover:bg-white/[0.06] focus:bg-black/[0.04] dark:focus:bg-white/[0.06] focus:outline-none"
          @click="open = false"
        >
          <span
            class="w-9 h-9 shrink-0 rounded-xl border border-black/[0.08] dark:border-white/[0.10] text-ink dark:text-zinc-200 flex items-center justify-center"
          >
            <svg class="w-[18px] h-[18px]" v-bind="stroke" v-html="item.svg" />
          </span>
          <span class="min-w-0">
            <span class="block text-sm font-semibold text-ink dark:text-white">{{ item.label }}</span>
            <span class="block text-xs text-ink-soft dark:text-zinc-500">{{ item.hint }}</span>
          </span>
        </NuxtLink>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
const stroke = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  "stroke-width": "1.8",
  "stroke-linecap": "round",
  "stroke-linejoin": "round",
  "aria-hidden": "true",
};

const { sellerReady: isSeller } = useSellerKyc();

const items = [
  {
    label: "Shop",
    hint: "Fixed-price listings",
    to: "/seller/listings",
    svg: '<path d="M3 9h18M3 9l1.5-4.5A2 2 0 0 1 6.4 3h11.2a2 2 0 0 1 1.9 1.5L21 9M3 9v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9"/><path d="M9 21v-6h6v6"/>',
  },
  {
    label: "Auctions",
    hint: "Live and ended auctions",
    to: "/seller/auctions",
    // The app's gavel, as in the bottom nav.
    svg: '<g transform="translate(21 0.5) scale(-1 1) rotate(-45 10 10)"><path d="M7 4.5h6M7 7.5h6"/><rect x="4" y="2.5" width="3" height="7" rx="1"/><rect x="13" y="2.5" width="3" height="7" rx="1"/><path d="M10 7.5v10"/></g><path d="M12.5 21h8"/>',
  },
];

const open = ref(false);
const root = ref<HTMLElement | null>(null);
const trigger = ref<HTMLElement | null>(null);

// Close on a tap outside or Escape; Escape hands focus back to the button.
const onDocPointer = (e: PointerEvent) => {
  if (root.value && !root.value.contains(e.target as Node)) open.value = false;
};
const onDocKey = (e: KeyboardEvent) => {
  if (e.key === "Escape") {
    open.value = false;
    trigger.value?.focus();
  }
};
// Arrow keys move between the two options, as a menu should.
const onMenuKey = (e: KeyboardEvent) => {
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
  e.preventDefault();
  const links = Array.from(root.value?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
  const i = links.indexOf(document.activeElement as HTMLElement);
  const next = e.key === "ArrowDown" ? (i + 1) % links.length : (i - 1 + links.length) % links.length;
  links[next]?.focus();
};

watch(open, (v) => {
  if (v) {
    document.addEventListener("pointerdown", onDocPointer);
    document.addEventListener("keydown", onDocKey);
  } else {
    document.removeEventListener("pointerdown", onDocPointer);
    document.removeEventListener("keydown", onDocKey);
  }
});
onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", onDocPointer);
  document.removeEventListener("keydown", onDocKey);
});
</script>

<style scoped>
.press {
  transition: transform 160ms cubic-bezier(0.22, 1, 0.36, 1);
  -webkit-tap-highlight-color: transparent;
}
.press:active {
  transform: scale(0.97);
}
.ml-menu-enter-active,
.ml-menu-leave-active {
  transition: opacity 160ms ease, transform 180ms cubic-bezier(0.22, 1, 0.36, 1);
}
.ml-menu-enter-from,
.ml-menu-leave-to {
  opacity: 0;
  transform: scale(0.96) translateY(-4px);
}
@media (prefers-reduced-motion: reduce) {
  .ml-menu-enter-active,
  .ml-menu-leave-active {
    transition: opacity 120ms ease;
  }
  .ml-menu-enter-from,
  .ml-menu-leave-to {
    transform: none;
  }
}
</style>
