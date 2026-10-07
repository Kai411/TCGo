<template>
  <div
    id="notifications"
    class="bg-white dark:bg-white/[0.04] rounded-xl p-6 border border-gray-200 dark:border-white/[0.08] space-y-5 mt-4 scroll-mt-20"
  >
    <div>
      <p class="text-xl font-bold">Notifications</p>
      <p class="text-xs text-gray-400 dark:text-zinc-500 mt-1">
        Get messages, order updates and auction alerts on this device, even when TCGo is closed.
      </p>
    </div>

    <!-- This device -->
    <div class="flex items-center justify-between gap-4">
      <div class="min-w-0">
        <p class="text-sm font-medium text-gray-700 dark:text-zinc-200">Push notifications on this device</p>
        <p class="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">{{ stateHint }}</p>
      </div>
      <button
        v-if="state === 'off'"
        type="button"
        :disabled="busy"
        @click="enable"
        class="shrink-0 min-h-[44px] px-4 rounded-lg bg-pokemon-red text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60 transition-colors"
      >
        {{ busy ? "Turning on…" : "Turn on" }}
      </button>
      <button
        v-else-if="state === 'on'"
        type="button"
        :disabled="busy"
        @click="disable"
        class="shrink-0 min-h-[44px] px-4 rounded-lg border border-gray-200 dark:border-white/[0.12] text-sm font-semibold text-gray-700 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-white/[0.06] disabled:opacity-60 transition-colors"
      >
        {{ busy ? "Turning off…" : "Turn off" }}
      </button>
    </div>

    <p v-if="error" class="text-xs text-red-600 dark:text-red-400">{{ error }}</p>

    <!-- What to send. Applies to every device the member has turned on. -->
    <div v-if="state === 'on'" class="space-y-4 border-t border-gray-100 dark:border-white/[0.06] pt-5">
      <p class="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">Send me</p>
      <label
        v-for="c in PUSH_CATEGORIES"
        :key="c.key"
        class="flex items-center justify-between gap-4 cursor-pointer"
      >
        <div class="min-w-0">
          <p class="text-sm font-medium text-gray-700 dark:text-zinc-200">{{ c.label }}</p>
          <p class="text-xs text-gray-400 dark:text-zinc-500">{{ c.hint }}</p>
        </div>
        <input
          type="checkbox"
          :checked="prefs[c.key]"
          @change="setPref(c.key, ($event.target as HTMLInputElement).checked)"
          class="w-5 h-5 shrink-0 rounded border-gray-300 dark:border-white/[0.20] dark:bg-white/[0.06] text-pokemon-red focus:ring-pokemon-red cursor-pointer"
        />
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import { PUSH_CATEGORIES } from "~/shared/push";

const { state, prefs, busy, error, refresh, enable, disable, setPref } = usePush();
const { user } = useAuth();

onMounted(refresh);
watch(() => user.value?.uid, refresh);

const stateHint = computed(() => {
  switch (state.value) {
    case "loading":
      return "Checking this device…";
    case "on":
      return "On. You'll get the kinds you pick below.";
    case "off":
      return "Off. Your browser will ask you to allow notifications.";
    case "denied":
      return "Blocked in your browser. Allow notifications for tcgo.shop in your browser's site settings, then come back here.";
    case "needs-install":
      return "On iPhone and iPad, add TCGo to your Home Screen first (Share, then Add to Home Screen), then open it from there and turn this on.";
    case "unsupported":
      return "This browser can't receive push notifications. Try Chrome, Edge, Firefox or Safari, or the installed TCGo app.";
    case "unavailable":
    default:
      return "Push notifications aren't available yet. You'll still see everything in the bell.";
  }
});
</script>
