<template>
  <!-- Terms & Policy as one row of the Account list, styled like the plain
       settings rows. Tapping it opens a sheet listing each policy page, so
       the four pages take one row instead of four. -->
  <button
    type="button"
    class="press w-full text-left flex items-center gap-4 lg:px-4 min-h-[56px]"
    aria-haspopup="dialog"
    @click="open = true"
  >
    <span
      class="w-9 h-9 shrink-0 rounded-xl border border-black/[0.08] dark:border-white/[0.10] text-ink dark:text-zinc-200 flex items-center justify-center"
    >
      <svg class="w-[18px] h-[18px]" v-bind="stroke">
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5M9 13h6M9 17h4" />
      </svg>
    </span>
    <span class="flex-1 text-sm font-medium text-ink dark:text-white">Terms &amp; Policy</span>
    <svg class="w-4 h-4 shrink-0 text-ink-soft dark:text-zinc-500" v-bind="stroke" stroke-width="2.5">
      <path d="m9 18 6-6-6-6" />
    </svg>
  </button>

  <Teleport to="body">
    <Transition name="policy-sheet">
      <div
        v-if="open"
        class="fixed inset-0 z-[60] flex items-end sm:items-center sm:justify-center sm:p-4 bg-black/40"
        @click.self="open = false"
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="policy-sheet-title"
          class="policy-sheet-panel surface w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl border-t sm:border border-black/[0.06] dark:border-white/[0.08] px-5 pt-2 sm:pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        >
          <div class="sm:hidden mx-auto mb-4 h-1 w-9 rounded-full bg-gray-300 dark:bg-white/20" aria-hidden="true" />

          <p id="policy-sheet-title" class="text-lg font-bold text-ink dark:text-white">Terms &amp; Policy</p>

          <nav class="mt-2 divide-y divide-black/[0.05] dark:divide-white/[0.06]">
            <NuxtLink
              v-for="link in LEGAL_LINKS"
              :key="link.to"
              :to="link.to"
              class="press flex items-center justify-between gap-4 min-h-[52px] text-sm font-medium text-ink dark:text-white"
              @click="open = false"
            >
              {{ link.label }}
              <svg class="w-4 h-4 shrink-0 text-ink-soft dark:text-zinc-500" v-bind="stroke" stroke-width="2.5">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </NuxtLink>
          </nav>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { LEGAL_LINKS } from "~/shared/legal";

const stroke = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  "stroke-width": "1.8",
  "stroke-linecap": "round",
  "stroke-linejoin": "round",
  "aria-hidden": "true",
};

const open = ref(false);

// Close on Escape for keyboard users; the backdrop handles taps.
const onKey = (e: KeyboardEvent) => {
  if (e.key === "Escape") open.value = false;
};
watch(open, (v) => {
  if (v) window.addEventListener("keydown", onKey);
  else window.removeEventListener("keydown", onKey);
});
onBeforeUnmount(() => window.removeEventListener("keydown", onKey));
</script>

<style scoped>
.press {
  transition: transform 160ms cubic-bezier(0.22, 1, 0.36, 1);
  -webkit-tap-highlight-color: transparent;
}
.press:active {
  transform: scale(0.97);
}
.policy-sheet-enter-active,
.policy-sheet-leave-active {
  transition: background-color 240ms cubic-bezier(0.32, 0.72, 0, 1);
}
.policy-sheet-enter-active .policy-sheet-panel,
.policy-sheet-leave-active .policy-sheet-panel {
  transition: transform 240ms cubic-bezier(0.32, 0.72, 0, 1), opacity 240ms ease;
}
.policy-sheet-enter-from,
.policy-sheet-leave-to {
  background-color: transparent;
}
.policy-sheet-enter-from .policy-sheet-panel,
.policy-sheet-leave-to .policy-sheet-panel {
  transform: translateY(100%);
}
@media (min-width: 640px) {
  .policy-sheet-enter-from .policy-sheet-panel,
  .policy-sheet-leave-to .policy-sheet-panel {
    transform: scale(0.96);
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .policy-sheet-enter-active .policy-sheet-panel,
  .policy-sheet-leave-active .policy-sheet-panel {
    transition: none;
  }
}
</style>
