<template>
  <div class="surface rounded-2xl border p-5" :class="config?.enabled ? 'border-emerald-200 dark:border-emerald-500/25' : 'border-black/[0.06] dark:border-white/[0.08]'">
    <div class="flex items-start justify-between gap-3 flex-wrap">
      <div class="min-w-0">
        <h2 class="text-sm font-bold flex items-center gap-2">
          Automatic payouts
          <span
            class="px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide"
            :class="
              config?.enabled
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                : 'bg-black/[0.05] text-ink-muted dark:bg-white/[0.08] dark:text-zinc-400'
            "
            >{{ config?.enabled ? "On" : "Off" }}</span
          >
        </h2>
        <p class="text-[12px] leading-relaxed text-ink-muted dark:text-zinc-400 mt-1.5 max-w-md">
          Sends queued payouts that sit inside every limit below. Anything
          larger, newer, or from a seller with an open report is left for a
          person. Nothing is ever part-paid.
        </p>
      </div>

      <div v-if="canEdit" class="flex gap-1.5 shrink-0">
        <button class="btn-ghost" :disabled="busy" @click="dryRun">Preview</button>
        <button
          class="px-3 py-2 rounded-lg text-sm font-semibold"
          :class="
            config?.enabled
              ? 'border border-black/[0.08] dark:border-white/[0.10] text-ink-muted dark:text-zinc-300'
              : 'bg-ink text-white dark:bg-white dark:text-ink'
          "
          :disabled="busy"
          @click="toggle"
        >
          {{ config?.enabled ? "Turn off" : "Turn on" }}
        </button>
      </div>
    </div>

    <div v-if="config" class="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
      <label v-for="f in fields" :key="f.key" class="min-w-0">
        <span class="block text-[11px] font-semibold text-ink-soft dark:text-zinc-500 mb-1">
          {{ f.label }}
        </span>
        <input
          v-model.number="(config as any)[f.key]"
          type="number"
          :step="f.step || 1"
          min="0"
          :disabled="!canEdit"
          class="w-full px-2.5 py-1.5 rounded-lg border border-black/[0.08] dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-sm disabled:opacity-60"
        />
      </label>

      <label class="flex items-end gap-2 pb-1.5 col-span-2 sm:col-span-1">
        <input v-model="config.skipReportedSellers" type="checkbox" :disabled="!canEdit" />
        <span class="text-[12px] text-ink-muted dark:text-zinc-400 leading-snug">
          Hold sellers with an open report
        </span>
      </label>
    </div>

    <div v-if="canEdit && config" class="flex items-center gap-2 mt-4 flex-wrap">
      <button
        class="px-3.5 py-2 rounded-lg text-sm font-semibold bg-ink text-white dark:bg-white dark:text-ink disabled:opacity-50"
        :disabled="busy"
        @click="save"
      >
        Save limits
      </button>
      <button class="btn-ghost" :disabled="busy || !config.enabled" @click="runNow">
        Run now
      </button>
      <span class="text-[11px] text-ink-soft dark:text-zinc-500">
        RM{{ spentLast24h.toFixed(2) }} sent automatically in the last 24h
      </span>
    </div>

    <p v-if="error" class="mt-3 text-[13px] text-red-600 dark:text-red-400">{{ error }}</p>

    <!-- Preview / result -->
    <div
      v-if="preview"
      class="mt-4 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] p-3.5 text-[12px]"
    >
      <p class="font-semibold mb-2">
        {{ preview.dryRun ? "Would send" : "Sent" }}
        {{ preview.dryRun ? preview.wouldSend?.length : preview.sent }} payout(s)
        · RM{{ (preview.total ?? preview.totalSent ?? 0).toFixed(2) }}
      </p>
      <ul v-if="skipList.length" class="space-y-1">
        <li v-for="s in skipList" :key="s.payoutId" class="flex justify-between gap-3 text-ink-muted dark:text-zinc-400">
          <span class="font-mono">{{ s.payoutId.slice(0, 8) }}</span>
          <span class="text-right">RM{{ s.amount?.toFixed(2) }} — {{ s.label }}</span>
        </li>
      </ul>
      <p v-else class="text-ink-soft dark:text-zinc-500">Nothing skipped.</p>
    </div>

    <p
      v-if="recentRuns.length"
      class="mt-3 text-[11px] text-ink-soft dark:text-zinc-500"
    >
      Last run {{ fmt(recentRuns[0].at) }} —
      {{ recentRuns[0].sentCount }} sent, {{ recentRuns[0].failedCount }} failed,
      {{ recentRuns[0].skippedCount }} skipped.
    </p>
  </div>
</template>

<script setup lang="ts">
import type { AutoPayoutConfig } from "~/shared/auto-payout";

const { can } = useStaffAuth();
const { mcFetch } = useMcFetch();

const canEdit = computed(() => can("payouts.automate"));

const config = ref<AutoPayoutConfig | null>(null);
const recentRuns = ref<any[]>([]);
const spentLast24h = ref(0);
const preview = ref<any>(null);
const busy = ref(false);
const error = ref("");

const fields = [
  { key: "maxPerPayout", label: "Max per payout (RM)" },
  { key: "maxPerRun", label: "Max per run (RM)" },
  { key: "dailyCap", label: "Daily cap (RM)" },
  { key: "minAmount", label: "Minimum (RM)" },
  { key: "minQueuedAgeMinutes", label: "Queue delay (min)" },
];

const skipList = computed(() =>
  preview.value?.wouldSkip ?? preview.value?.details?.skipped ?? [],
);

const fmt = (ms: number) =>
  new Date(ms).toLocaleString("en-MY", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const load = async () => {
  try {
    const res = await mcFetch<any>("/api/mc/payouts/auto-config");
    config.value = res.config;
    recentRuns.value = res.recentRuns;
    spentLast24h.value = res.spentLast24h;
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || "Couldn't load the settings.";
  }
};
onMounted(load);

const post = async (fn: () => Promise<any>) => {
  busy.value = true;
  error.value = "";
  try {
    return await fn();
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || "That didn't work.";
    return null;
  } finally {
    busy.value = false;
  }
};

const save = () =>
  post(async () => {
    const res = await mcFetch<any>("/api/mc/payouts/auto-config", {
      method: "POST",
      body: config.value,
    });
    config.value = res.config;
  });

const toggle = () =>
  post(async () => {
    const res = await mcFetch<any>("/api/mc/payouts/auto-config", {
      method: "POST",
      body: { ...config.value, enabled: !config.value?.enabled },
    });
    config.value = res.config;
  });

// Deliberately available whether automation is on or off — seeing what it
// would do is how you decide whether to turn it on.
const dryRun = () =>
  post(async () => {
    preview.value = await mcFetch("/api/mc/payouts/auto-run?dry=1", { method: "POST" });
  });

const runNow = () =>
  post(async () => {
    // eslint-disable-next-line no-alert
    if (!confirm("Send every queued payout that fits the limits? This moves real money and can't be undone.")) return;
    preview.value = await mcFetch("/api/mc/payouts/auto-run", { method: "POST" });
    await load();
  });
</script>

<style scoped>
.btn-ghost {
  @apply px-3 py-2 rounded-lg text-sm font-semibold border border-black/[0.08] dark:border-white/[0.10] text-ink-muted dark:text-zinc-300 disabled:opacity-40;
}
</style>
