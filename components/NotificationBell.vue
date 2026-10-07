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

    <!-- On a phone the list is its own full-height screen, like the open
         chat: moved to <body> (out of the navbar's stacking context) and
         covering the header and tab bar, with a back arrow to close it.
         Desktop keeps the dropdown. -->
    <Teleport to="body" :disabled="!isPhone">
    <Transition
      :enter-active-class="isPhone ? 'notif-slide-enter' : 'transition duration-150 ease-out'"
      :leave-active-class="isPhone ? 'notif-slide-leave' : 'transition duration-100 ease-in'"
      :enter-from-class="isPhone ? 'translate-x-full' : 'opacity-0 -translate-y-1'"
      :leave-to-class="isPhone ? 'translate-x-full' : 'opacity-0 -translate-y-1'"
    >
      <div
        v-if="open"
        ref="panel"
        role="dialog"
        aria-label="Notifications"
        :class="isPhone
          ? 'notif-screen flex flex-col bg-canvas dark:bg-canvas-inverse'
          : 'absolute right-0 mt-2 w-[min(20rem,calc(100vw-2rem))] z-50 rounded-xl border border-black/[0.08] dark:border-white/[0.10] bg-white dark:bg-[#1b1b21] shadow-xl overflow-hidden'"
      >
        <div
          class="flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.08]"
          :class="isPhone ? 'notif-header gap-2 px-2 py-2' : 'px-4 py-2.5'"
        >
          <button
            v-if="isPhone"
            type="button"
            @click="open = false"
            class="w-11 h-11 shrink-0 grid place-items-center rounded-full text-ink dark:text-white active:bg-black/[0.06] dark:active:bg-white/[0.08]"
            aria-label="Close notifications"
          >
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <p class="font-bold text-ink dark:text-white" :class="isPhone ? 'flex-1 text-base' : 'text-sm'">Notifications</p>
          <button
            v-if="hasUnread"
            type="button"
            @click="markAllRead"
            class="font-semibold text-pokemon-red"
            :class="isPhone ? 'min-h-[44px] px-3 rounded-full text-[13px] active:bg-pokemon-red/10' : 'text-[11px] hover:underline'"
          >
            Mark all read
          </button>
        </div>

        <div class="overflow-y-auto overscroll-contain" :class="isPhone ? 'flex-1 min-h-0' : 'max-h-[22rem]'">
          <p v-if="loading" class="px-4 py-8 text-center text-[13px] text-ink-soft">Loading…</p>
          <p v-else-if="!notifications.length" class="px-4 py-8 text-center text-[13px] text-ink-soft dark:text-zinc-500">
            Nothing yet. Orders you buy and sell will show up here.
          </p>
          <component
            v-for="n in notifications"
            :key="n.id"
            :is="n.href ? NuxtLink : 'div'"
            :to="n.href || undefined"
            @click="open = false; markRead(n.id)"
            class="block px-4 border-b border-black/[0.04] dark:border-white/[0.05] last:border-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.04] transition-colors"
            :class="[n.href ? 'cursor-pointer active:bg-black/[0.04] dark:active:bg-white/[0.06]' : '', isPhone ? 'py-3.5' : 'py-3']"
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
                <p class="flex items-center gap-1.5 text-[11px] text-ink-soft dark:text-zinc-500 mt-1">
                  <span
                    v-if="n.audience"
                    class="rounded px-1.5 py-px text-[10px] font-semibold"
                    :class="n.audience === 'seller'
                      ? 'bg-pokemon-red/10 text-pokemon-red'
                      : 'bg-black/[0.06] text-ink-muted dark:bg-white/[0.08] dark:text-zinc-300'"
                  >{{ AUDIENCE_LABEL[n.audience] }}</span>
                  <span>{{ ago(n.createdAt) }}</span>
                </p>
              </div>
            </div>
          </component>
        </div>

        <!-- Offer push where it can actually work on this device. -->
        <div
          v-if="pushState === 'off' || pushState === 'needs-install'"
          class="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.03]"
        >
          <p class="text-[12px] text-ink-muted dark:text-zinc-400">Get these on your phone too.</p>
          <button
            v-if="pushState === 'off'"
            type="button"
            :disabled="pushBusy"
            @click="enablePush"
            :class="isPhone ? 'min-h-[44px]' : 'min-h-[36px]'"
            class="shrink-0 px-3 rounded-lg text-[12px] font-semibold text-pokemon-red hover:bg-pokemon-red/10 disabled:opacity-60"
          >
            {{ pushBusy ? "Turning on…" : "Turn on" }}
          </button>
          <NuxtLink
            v-else
            to="/account/notifications"
            @click="open = false"
            :class="isPhone ? 'min-h-[44px]' : 'min-h-[36px]'"
            class="shrink-0 inline-flex items-center px-3 rounded-lg text-[12px] font-semibold text-pokemon-red hover:bg-pokemon-red/10"
          >
            How
          </NuxtLink>
        </div>
      </div>
    </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, resolveComponent, watch } from "vue";
import { AUDIENCE_LABEL } from "~/shared/notifications";

// Resolved here: a "NuxtLink" string in :is renders an unknown element, so
// tapping a notification went nowhere.
const NuxtLink = resolveComponent("NuxtLink");

const { notifications, loading, unread, hasUnread, listen, markRead, markAllRead } =
  useNotifications();
const { user } = useAuth();
const route = useRoute();

const { state: pushState, busy: pushBusy, refresh: refreshPush, enable: enablePush } = usePush();

const open = ref(false);
const panel = ref<HTMLElement | null>(null);

const toggle = () => (open.value = !open.value);

// Follow the signed-in user: on a shared shop device, leaving the previous
// seller's notifications on screen would be showing someone else's order
// values to whoever signed in next.
watch(user, listen, { immediate: true });
watch(() => route.fullPath, () => (open.value = false));
// Checked when the panel opens, not on every page: it touches the service
// worker, and the answer only matters when someone is looking at the offer.
watch(open, (v) => {
  if (v) refreshPush().catch(() => {});
  lockPage();
});

// ── Phone: full-height screen ─────────────────────────────────────────

/** Below the lg breakpoint the list covers the app chrome, as the open chat
 *  does. Set on mount so the server render matches the desktop markup. */
const isPhone = ref(false);
let phoneQuery: MediaQueryList | null = null;
/** The page behind stays still while the list is on top of it. */
const lockPage = () => {
  document.documentElement.style.overflow = isPhone.value && open.value ? "hidden" : "";
};
const syncPhone = () => {
  isPhone.value = !!phoneQuery?.matches;
  lockPage();
};

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
  phoneQuery = window.matchMedia("(max-width: 1023.98px)");
  phoneQuery.addEventListener("change", syncPhone);
  syncPhone();
  document.addEventListener("click", onDocClick);
  document.addEventListener("keydown", onEsc);
});
onBeforeUnmount(() => {
  phoneQuery?.removeEventListener("change", syncPhone);
  if (open.value) document.documentElement.style.overflow = "";
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

<style scoped>
/* Phone: the list is its own screen, at the same layer as the open chat:
   above the nav and tab bar (z-40) and the install banner (z-50), below the
   cart drawer (z-60). */
.notif-screen {
  position: fixed;
  inset: 0;
  height: 100dvh;
  z-index: 55;
}
.notif-header {
  padding-top: max(0.5rem, env(safe-area-inset-top));
}
/* The list's last row (or the push offer) clears the home bar. */
.notif-screen > :last-child {
  padding-bottom: max(0.625rem, env(safe-area-inset-bottom));
}
.notif-slide-enter {
  transition: transform 280ms cubic-bezier(0.32, 0.72, 0, 1);
}
.notif-slide-leave {
  transition: transform 200ms cubic-bezier(0.32, 0.72, 0, 1);
}
@media (prefers-reduced-motion: reduce) {
  .notif-slide-enter,
  .notif-slide-leave {
    transition: none;
  }
}
</style>
