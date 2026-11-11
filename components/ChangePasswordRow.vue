<template>
  <!-- Change password as one settings row; the sheet sends a reset link to
       the account's email, so the new password is set from the mailbox.
       Only shown for email and password accounts. -->
  <button
    type="button"
    class="press w-full text-left flex items-center gap-4 px-4 min-h-[56px]"
    aria-haspopup="dialog"
    @click="openSheet"
  >
    <span
      class="w-9 h-9 shrink-0 rounded-xl border border-black/[0.08] dark:border-white/[0.10] text-ink dark:text-zinc-200 flex items-center justify-center"
    >
      <svg class="w-[18px] h-[18px]" v-bind="stroke">
        <rect x="4" y="11" width="16" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
    </span>
    <span class="flex-1 text-sm font-medium text-ink dark:text-white">Change password</span>
    <span v-if="sentTo" class="text-xs font-medium text-emerald-600 dark:text-emerald-400">Link sent</span>
    <svg class="w-4 h-4 shrink-0 text-ink-soft dark:text-zinc-500" v-bind="stroke" stroke-width="2.5">
      <path d="m9 18 6-6-6-6" />
    </svg>
  </button>

  <Teleport to="body">
    <Transition name="pw-sheet">
      <div
        v-if="open"
        class="fixed inset-0 z-[60] flex items-end sm:items-center sm:justify-center sm:p-4 bg-black/40"
        @click.self="close"
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pw-sheet-title"
          class="pw-sheet-panel surface w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl border-t sm:border border-black/[0.06] dark:border-white/[0.08] px-5 pt-2 sm:pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        >
          <div class="sm:hidden mx-auto mb-4 h-1 w-9 rounded-full bg-gray-300 dark:bg-white/20" aria-hidden="true" />

          <template v-if="!sentTo">
            <p id="pw-sheet-title" class="text-lg font-bold text-ink dark:text-white">Change password</p>
            <p class="text-sm text-ink-muted dark:text-zinc-400 mt-1">
              We'll email a link to
              <span class="font-medium text-ink dark:text-white break-all">{{ email }}</span>.
              Open it to choose a new password.
            </p>
          </template>
          <template v-else>
            <span
              class="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-400/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center"
              aria-hidden="true"
            >
              <svg class="w-[22px] h-[22px]" v-bind="stroke">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m3 7 9 6 9-6" />
              </svg>
            </span>
            <p id="pw-sheet-title" class="mt-3 text-lg font-bold text-ink dark:text-white">Check your email</p>
            <p class="text-sm text-ink-muted dark:text-zinc-400 mt-1" role="status">
              We sent a link to
              <span class="font-medium text-ink dark:text-white break-all">{{ sentTo }}</span>.
              It works for one hour. If it isn't in your inbox, check spam.
            </p>
          </template>

          <div class="mt-4 flex gap-3 rounded-2xl bg-black/[0.03] dark:bg-white/[0.05] px-3.5 py-3">
            <svg class="w-4 h-4 mt-0.5 shrink-0 text-ink-muted dark:text-zinc-400" v-bind="stroke">
              <path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6z" />
            </svg>
            <p class="text-[13px] leading-snug text-ink-muted dark:text-zinc-400">
              For your safety, payouts and bank detail changes pause for 24 hours after your password changes.
              You'll be asked to sign in again on your devices.
            </p>
          </div>

          <p v-if="error" class="mt-3 text-xs text-pokemon-red" role="alert">{{ error }}</p>

          <button
            v-if="!sentTo"
            type="button"
            :disabled="busy"
            class="press mt-4 w-full min-h-[48px] rounded-full text-sm font-semibold bg-ink text-white dark:bg-white dark:text-ink disabled:opacity-40"
            @click="send"
          >
            {{ busy ? "Sending…" : "Email me a link" }}
          </button>
          <template v-else>
            <button
              type="button"
              class="press mt-4 w-full min-h-[48px] rounded-full text-sm font-semibold bg-ink text-white dark:bg-white dark:text-ink"
              @click="close"
            >
              Done
            </button>
            <button
              type="button"
              :disabled="busy || cooldown > 0"
              class="press mt-1 w-full min-h-[44px] text-sm font-medium text-ink-muted dark:text-zinc-400 disabled:opacity-50"
              @click="send"
            >
              {{ busy ? "Sending…" : cooldown > 0 ? `Resend in ${cooldown}s` : "Resend link" }}
            </button>
          </template>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { authMessage } from "~/composables/useAuth";

const stroke = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  "stroke-width": "1.8",
  "stroke-linecap": "round",
  "stroke-linejoin": "round",
  "aria-hidden": "true",
};

const { user, sendPasswordLink } = useAuth();
const email = computed(() => user.value?.email ?? "");

const open = ref(false);
const busy = ref(false);
const error = ref("");
const sentTo = ref("");
const cooldown = ref(0);
let timer: ReturnType<typeof setInterval> | undefined;

const openSheet = () => {
  error.value = "";
  open.value = true;
};
const close = () => {
  if (!busy.value) open.value = false;
};

// A short wait before resending, so a double tap doesn't send two emails
// and trip Firebase's own limit.
const startCooldown = () => {
  cooldown.value = 30;
  clearInterval(timer);
  timer = setInterval(() => {
    cooldown.value -= 1;
    if (cooldown.value <= 0) clearInterval(timer);
  }, 1000);
};

const send = async () => {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  try {
    sentTo.value = await sendPasswordLink();
    startCooldown();
  } catch (e) {
    error.value = authMessage(e);
  } finally {
    busy.value = false;
  }
};

// Close on Escape for keyboard users; the backdrop handles taps.
const onKey = (e: KeyboardEvent) => {
  if (e.key === "Escape") close();
};
watch(open, (v) => {
  if (v) window.addEventListener("keydown", onKey);
  else window.removeEventListener("keydown", onKey);
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKey);
  clearInterval(timer);
});
</script>

<style scoped>
.press {
  transition: transform 160ms cubic-bezier(0.22, 1, 0.36, 1);
  -webkit-tap-highlight-color: transparent;
}
.press:active:not(:disabled) {
  transform: scale(0.97);
}
.pw-sheet-enter-active,
.pw-sheet-leave-active {
  transition: background-color 240ms cubic-bezier(0.32, 0.72, 0, 1);
}
.pw-sheet-enter-active .pw-sheet-panel,
.pw-sheet-leave-active .pw-sheet-panel {
  transition: transform 240ms cubic-bezier(0.32, 0.72, 0, 1), opacity 240ms ease;
}
.pw-sheet-enter-from,
.pw-sheet-leave-to {
  background-color: transparent;
}
.pw-sheet-enter-from .pw-sheet-panel,
.pw-sheet-leave-to .pw-sheet-panel {
  transform: translateY(100%);
}
@media (min-width: 640px) {
  .pw-sheet-enter-from .pw-sheet-panel,
  .pw-sheet-leave-to .pw-sheet-panel {
    transform: scale(0.96);
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .pw-sheet-enter-active .pw-sheet-panel,
  .pw-sheet-leave-active .pw-sheet-panel {
    transition: none;
  }
}
</style>
