<template>
  <!-- Change password as one settings row; the form opens in a sheet so the
       page stays a list. Only shown for email and password accounts. -->
  <button
    type="button"
    class="press w-full text-left flex items-center gap-4 lg:px-4 min-h-[56px]"
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
    <span v-if="done" class="text-xs font-medium text-emerald-600 dark:text-emerald-400">Updated</span>
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
        <form
          role="dialog"
          aria-modal="true"
          aria-labelledby="pw-sheet-title"
          class="pw-sheet-panel surface w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl border-t sm:border border-black/[0.06] dark:border-white/[0.08] px-5 pt-2 sm:pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
          @submit.prevent="submit"
        >
          <div class="sm:hidden mx-auto mb-4 h-1 w-9 rounded-full bg-gray-300 dark:bg-white/20" aria-hidden="true" />

          <p id="pw-sheet-title" class="text-lg font-bold text-ink dark:text-white">Change password</p>
          <p class="text-sm text-ink-muted dark:text-zinc-400 mt-1">
            Enter your current password, then a new one of at least 8 characters.
          </p>

          <label class="block mt-5 text-xs font-medium text-ink-muted dark:text-zinc-400" for="pw-current">
            Current password
          </label>
          <input
            id="pw-current"
            v-model="current"
            :type="show ? 'text' : 'password'"
            autocomplete="current-password"
            class="mt-1.5 w-full h-11 rounded-xl border border-black/[0.10] dark:border-white/[0.10] bg-transparent dark:bg-white/[0.04] px-3.5 text-base text-ink dark:text-white focus:border-ink dark:focus:border-white focus:outline-none"
          />

          <label class="block mt-4 text-xs font-medium text-ink-muted dark:text-zinc-400" for="pw-next">
            New password
          </label>
          <input
            id="pw-next"
            v-model="next"
            :type="show ? 'text' : 'password'"
            autocomplete="new-password"
            minlength="8"
            class="mt-1.5 w-full h-11 rounded-xl border border-black/[0.10] dark:border-white/[0.10] bg-transparent dark:bg-white/[0.04] px-3.5 text-base text-ink dark:text-white focus:border-ink dark:focus:border-white focus:outline-none"
          />

          <label class="mt-3 inline-flex items-center gap-2 min-h-[44px] text-sm text-ink-muted dark:text-zinc-400 cursor-pointer">
            <input
              v-model="show"
              type="checkbox"
              class="w-4 h-4 rounded border-gray-300 dark:border-white/[0.20] dark:bg-white/[0.06] text-ink focus:ring-ink"
            />
            Show passwords
          </label>

          <p v-if="error" class="text-xs text-pokemon-red" role="alert">{{ error }}</p>

          <button
            type="submit"
            :disabled="busy || !current || next.length < 8"
            class="press mt-3 w-full min-h-[48px] rounded-full text-sm font-semibold bg-ink text-white dark:bg-white dark:text-ink disabled:opacity-40"
          >
            {{ busy ? "Saving…" : "Save new password" }}
          </button>
        </form>
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

const { changePassword } = useAuth();

const open = ref(false);
const current = ref("");
const next = ref("");
const show = ref(false);
const busy = ref(false);
const error = ref("");
const done = ref(false);

const openSheet = () => {
  current.value = "";
  next.value = "";
  error.value = "";
  open.value = true;
};
const close = () => {
  if (!busy.value) open.value = false;
};

const submit = async () => {
  if (next.value === current.value) {
    error.value = "Pick a password you haven't used here.";
    return;
  }
  busy.value = true;
  error.value = "";
  try {
    await changePassword(current.value, next.value);
    done.value = true;
    open.value = false;
  } catch (e) {
    const code = (e as { code?: string })?.code ?? "";
    // The shared message talks about "email and password"; here only the
    // current password can be wrong.
    error.value = ["auth/invalid-credential", "auth/wrong-password"].includes(code)
      ? "Your current password isn't right."
      : authMessage(e);
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
onBeforeUnmount(() => window.removeEventListener("keydown", onKey));
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
