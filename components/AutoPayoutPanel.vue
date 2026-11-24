<template>
  <div class="mc-card mc-card-pad">
    <div class="mc-item-head">
      <div>
        <p class="flex items-center gap-2">
          <span class="mc-tag">
            <span class="mc-dot" :data-tone="config?.enabled ? 'good' : undefined" aria-hidden="true" />
            {{ config?.enabled ? "On" : "Off" }}
          </span>
          <span v-if="recentRuns.length" class="mc-small">
            Last run {{ fmt(recentRuns[0].at) }}: {{ recentRuns[0].sentCount }} sent,
            {{ recentRuns[0].failedCount }} failed, {{ recentRuns[0].skippedCount }} skipped.
          </span>
        </p>
        <p class="mc-meta mt-2 max-w-[34rem]">
          Sends queued payouts that sit inside every limit below. Anything
          larger, newer, or from a seller with an open report is left for a
          person. Nothing is ever part-paid.
        </p>
      </div>
      <div v-if="canEdit" class="flex gap-2 shrink-0">
        <button class="mc-btn mc-btn-sm" :disabled="busy" @click="dryRun">Preview</button>
        <button
          class="mc-btn mc-btn-sm"
          :class="config?.enabled ? '' : 'mc-btn-primary'"
          :disabled="busy"
          @click="toggle"
        >
          {{ config?.enabled ? "Turn off" : "Turn on" }}
        </button>
      </div>
    </div>

    <div v-if="config" class="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5">
      <label v-for="f in fields" :key="f.key" class="mc-field">
        <span>{{ f.label }}</span>
        <input
          v-model.number="(config as any)[f.key]"
          type="number"
          :step="f.step || 1"
          min="0"
          :disabled="!canEdit"
          class="mc-input mc-num"
        />
      </label>
      <label class="flex items-center gap-2 self-end min-h-[var(--control-h)] col-span-2 sm:col-span-1">
        <input v-model="config.skipReportedSellers" type="checkbox" :disabled="!canEdit" />
        <span class="mc-meta">Hold sellers with an open report</span>
      </label>
    </div>

    <div v-if="canEdit && config" class="mc-divider flex items-center gap-2 mt-5 pt-4 flex-wrap">
      <button class="mc-btn mc-btn-sm mc-btn-primary" :disabled="busy" @click="save">
        Save limits
      </button>
      <button class="mc-btn mc-btn-sm mc-btn-ghost" :disabled="busy || !config.enabled" @click="runNow">
        Run now
      </button>
      <span class="mc-small ml-auto mc-num">
        RM {{ spentLast24h.toFixed(2) }} sent automatically in the last 24h
      </span>
    </div>

    <p v-if="error" class="mc-callout mt-4" data-tone="bad" role="alert">{{ error }}</p>

    <!-- Preview / result -->
    <div v-if="preview" class="mc-quote mt-4 !whitespace-normal">
      <p class="font-semibold mb-2">
        {{ preview.dryRun ? "Would send" : "Sent" }}
        {{ preview.dryRun ? preview.wouldSend?.length : preview.sent }}
        {{ (preview.dryRun ? preview.wouldSend?.length : preview.sent) === 1 ? "payout" : "payouts" }}
        · <span class="mc-num">RM {{ (preview.total ?? preview.totalSent ?? 0).toFixed(2) }}</span>
      </p>
      <ul v-if="skipList.length" class="grid gap-1">
        <li v-for="s in skipList" :key="s.payoutId" class="flex justify-between gap-3 mc-meta">
          <span class="mc-mono">{{ s.payoutId.slice(0, 8) }}</span>
          <span class="text-right mc-num">RM {{ s.amount?.toFixed(2) }}: {{ s.label }}</span>
        </li>
      </ul>
      <p v-else class="mc-small">Nothing skipped.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AutoPayoutConfig } from "~/shared/auto-payout";

const emit = defineEmits<{ ran: [] }>();
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
    // The queue on the page underneath just changed; let it reload.
    emit("ran");
  });
</script>
