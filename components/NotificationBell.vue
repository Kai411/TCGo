<template>
  <div class="relative">
    <button
      type="button"
      @click="toggle"
      :aria-expanded="open"
      :aria-label="hasUnread ? `Notifications, ${unread} unread` : 'Notifications'"
      class="relative inline-flex items-center justify-center w-9 h-9 rounded-lg text-ink-muted dark:text-zinc-400 hover:text-ink dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
    >
      <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      <!-- A dot, not a number, on the icon itself: the count is in the panel
           and a badge over a 20px bell is unreadable anyway. -->
      <span
        v-if="hasUnread"
        class="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-pokemon-red ring-2 ring-white dark:ring-[#17171c]"
        aria-hidden="true"
      />
    </button>

    <Transition
      enter-active-class="transition duration-150 ease-out"
      leave-active-class="transition duration-100 ease-in"
      enter-from-class="opacity-0 -translate-y-1"
      leave-to-class="opacity-0 -translate-y-1"
    >
      <div
        v-if="open"
        ref="panel"
        class="absolute right-0 mt-2 w-[min(20rem,calc(100vw-2rem))] z-50 rounded-xl border border-black/[0.08] dark:border-white/[0.10] bg-white dark:bg-[#1b1b21] shadow-xl overflow-hidden"
      >
        <div class="flex items-center justify-between px-4 py-2.5 border-b border-black/[0.06] dark:border-white/[0.08]">
          <p class="text-sm font-bold text-ink dark:text-white">Notifications</p>
          <button
            v-if="hasUnread"
            type="button"
            @click="markAllRead"
            class="text-[11px] font-semibold text-pokemon-red hover:underline"
          >
            Mark all read
          </button>
        </div>

        <div class="max-h-[22rem] overflow-y-auto">
          <p v-if="loading" class="px-4 py-8 text-center text-[13px] text-ink-soft">Loading…</p>
          <p v-else-if="!notifications.length" class="px-4 py-8 text-center text-[13px] text-ink-soft dark:text-zinc-500">
            Nothing yet. Orders and follows will show up here.
          </p>
          <component
            v-for="n in notifications"
            :key="n.id"
            :is="n.href ? 'NuxtLink' : 'div'"
            :to="n.href || undefined"
            @click="open = false; markRead(n.id)"
            class="block px-4 py-3 border-b border-black/[0.04] dark:border-white/[0.05] last:border-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.04] transition-colors"
            :class="n.href ? 'cursor-pointer' : ''"
          >
            <div class="flex items-start gap-2.5">
              <span
                class="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                :class="!n.readAt ? 'bg-pokemon-red' : 'bg-transparent'"
                aria-hidden="true"
              />
              <div class="min-w-0">
                <p class="text-[13px] font-semibold text-ink dark:text-white leading-snug">
                  {{ n.title }}
                </p>
                <p class="text-[12px] text-ink-muted dark:text-zinc-400 leading-relaxed mt-0.5">
                  {{ n.body }}
                </p>
                <p class="text-[11px] text-ink-soft dark:text-zinc-500 mt-1">
                  {{ ago(n.createdAt) }}
                </p>
              </div>
            </div>
          </component>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";

const { notifications, loading, unread, hasUnread, listen, markRead, markAllRead } =
  useNotifications();
const { user } = useAuth();
const route = useRoute();

const open = ref(false);
const panel = ref<HTMLElement | null>(null);

const toggle = () => (open.value = !open.value);

// Follow the signed-in user: on a shared shop device, leaving the previous
// seller's notifications on screen would be showing someone else's order
// values to whoever signed in next.
watch(user, listen, { immediate: true });
watch(() => route.fullPath, () => (open.value = false));

const onDocClick = (e: MouseEvent) => {
  if (!open.value) return;
  const el = e.target as Node;
  if (panel.value && !panel.value.contains(el) && !(e.target as HTMLElement).closest("button")) {
    open.value = false;
  }
};
const onEsc = (e: KeyboardEvent) => {
  if (e.key === "Escape") open.value = false;
};

onMounted(() => {
  document.addEventListener("click", onDocClick);
  document.addEventListener("keydown", onEsc);
});
onBeforeUnmount(() => {
  document.removeEventListener("click", onDocClick);
  document.removeEventListener("keydown", onEsc);
});

/** Relative time, to the coarsest unit that's still true. */
const ago = (ts?: number): string => {
  if (!ts) return "";
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return "Just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString("en-MY", { day: "numeric", month: "short" });
};
</script>
