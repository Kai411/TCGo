<template>
  <div class="max-w-5xl mx-auto">
    <div class="flex items-center justify-between gap-3 mb-5 flex-wrap">
      <div>
        <h1 class="text-2xl font-bold">Logs</h1>
        <p class="text-[13px] text-ink-muted dark:text-zinc-400 mt-0.5">
          What broke, and who did what.
        </p>
      </div>
      <button class="btn-ghost" :disabled="loading" @click="load()">Reload</button>
    </div>

    <div class="flex gap-1 mb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
      <button
        v-for="t in tabs"
        :key="t.key"
        class="px-3.5 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors"
        :class="
          kind === t.key
            ? 'border-pokemon-red text-ink dark:text-white'
            : 'border-transparent text-ink-soft dark:text-zinc-500 hover:text-ink dark:hover:text-zinc-300'
        "
        @click="switchTab(t.key)"
      >
        {{ t.label }}
      </button>
    </div>

    <div class="flex gap-2 mb-4 flex-wrap items-center">
      <select v-model="area" class="sel" @change="load()">
        <option value="all">All areas</option>
        <option v-for="a in LOG_AREAS" :key="a.key" :value="a.key">{{ a.label }}</option>
      </select>
      <select v-if="kind === 'error'" v-model="severity" class="sel" @change="load()">
        <option value="all">Any severity</option>
        <option value="critical">Critical</option>
        <option value="error">Error</option>
        <option value="warning">Warning</option>
      </select>
      <label
        v-if="kind === 'error'"
        class="flex items-center gap-1.5 text-[13px] text-ink-muted dark:text-zinc-400"
      >
        <input v-model="unresolved" type="checkbox" @change="load()" />
        Unresolved only
      </label>
    </div>

    <p v-if="error" class="text-[13px] text-red-600 dark:text-red-400 mb-3">{{ error }}</p>
    <p v-if="loading" class="text-[13px] text-ink-soft dark:text-zinc-500">Loading…</p>

    <p
      v-else-if="!rows.length"
      class="text-[13px] text-ink-soft dark:text-zinc-500 py-8 text-center"
    >
      {{
        kind === "error"
          ? "Nothing has failed in this window. That's the good outcome."
          : "No staff actions recorded in this window."
      }}
    </p>

    <!-- ── Errors ──────────────────────────────────────────────── -->
    <div v-else-if="kind === 'error'" class="space-y-2.5">
      <div
        v-for="r in rows"
        :key="r.id"
        class="surface rounded-xl border p-3.5"
        :class="r.resolvedAt ? 'border-black/[0.06] dark:border-white/[0.08] opacity-60' : severityBorder(r.severity)"
      >
        <div class="flex items-start justify-between gap-3 flex-wrap">
          <div class="min-w-0 flex-1">
            <p class="flex items-center gap-2 flex-wrap">
              <span
                class="px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide"
                :class="severityBadge(r.severity)"
                >{{ r.severity }}</span
              >
              <span class="text-[10px] font-bold uppercase tracking-wide text-ink-soft dark:text-zinc-500">
                {{ areaLabel(r.area) }}
              </span>
              <code class="text-[11px] text-ink-soft dark:text-zinc-600">{{ r.code }}</code>
              <span class="text-[11px] text-ink-soft dark:text-zinc-600">{{ fmt(r.at) }}</span>
            </p>
            <p class="text-[13px] font-semibold mt-1.5 break-words">{{ r.message }}</p>
            <p
              v-if="r.hint"
              class="text-[12px] leading-relaxed text-ink-muted dark:text-zinc-400 mt-1"
            >
              {{ r.hint }}
            </p>
            <p v-if="r.context" class="mt-1.5 text-[11px] font-mono text-ink-soft dark:text-zinc-600 break-all">
              {{ compact(r.context) }}
            </p>
            <p v-if="r.orderId || r.payoutId" class="mt-1.5 text-[11px]">
              <NuxtLink
                v-if="r.orderId"
                :to="`/orders/${r.orderId}`"
                class="text-pokemon-red font-semibold"
                >Order {{ r.orderId.slice(0, 8) }}</NuxtLink
              >
              <span v-if="r.payoutId" class="text-ink-soft dark:text-zinc-600"
                >Payout {{ r.payoutId.slice(0, 8) }}</span
              >
            </p>
          </div>
          <button class="btn-ghost shrink-0" :disabled="busy === r.id" @click="toggleResolved(r)">
            {{ r.resolvedAt ? "Reopen" : "Resolve" }}
          </button>
        </div>
      </div>
    </div>

    <!-- ── Actions ─────────────────────────────────────────────── -->
    <div v-else class="space-y-1.5">
      <div
        v-for="r in rows"
        :key="r.id"
        class="surface rounded-lg border border-black/[0.06] dark:border-white/[0.08] px-3.5 py-2.5 flex items-start gap-3 flex-wrap"
      >
        <span class="text-[11px] font-mono text-ink-soft dark:text-zinc-600 shrink-0 w-32">
          {{ fmt(r.at) }}
        </span>
        <span class="font-mono text-[11px] font-bold shrink-0 w-16">{{ r.actor }}</span>
        <span class="text-[13px] flex-1 min-w-0 break-words">{{ r.summary }}</span>
        <code class="text-[10px] text-ink-soft dark:text-zinc-600 shrink-0">{{ r.action }}</code>
      </div>
    </div>

    <button
      v-if="nextBefore"
      class="mt-4 w-full py-2.5 rounded-xl border border-black/[0.08] dark:border-white/[0.10] text-sm font-semibold"
      :disabled="loading"
      @click="load(nextBefore)"
    >
      Load older
    </button>
  </div>
</template>

<script setup lang="ts">
import { LOG_AREAS } from "~/shared/oplog";

definePageMeta({ layout: "admin", middleware: "mintcondition" });
useHead({ title: "Logs — Mint Condition" });

const { mcFetch } = useMcFetch();

const tabs = [
  { key: "error" as const, label: "Errors" },
  { key: "action" as const, label: "Staff actions" },
];
const kind = ref<"error" | "action">("error");
const area = ref("all");
const severity = ref("all");
const unresolved = ref(true);

const rows = ref<any[]>([]);
const nextBefore = ref<number | null>(null);
const loading = ref(true);
const error = ref("");
const busy = ref("");

const areaLabel = (a: string) => LOG_AREAS.find((x) => x.key === a)?.label ?? a;

const fmt = (ms: number) =>
  new Date(ms).toLocaleString("en-MY", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

// Context is shown inline rather than behind a toggle — an error you have to
// click to understand is one people stop clicking.
const compact = (c: Record<string, unknown>) =>
  Object.entries(c)
    .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : v}`)
    .join("  ");

const severityBadge = (s: string) =>
  s === "critical"
    ? "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"
    : s === "warning"
      ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
      : "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300";

const severityBorder = (s: string) =>
  s === "critical"
    ? "border-red-200 dark:border-red-500/25"
    : "border-black/[0.06] dark:border-white/[0.08]";

const load = async (before?: number) => {
  loading.value = true;
  error.value = "";
  try {
    const q = new URLSearchParams({ kind: kind.value, area: area.value });
    if (kind.value === "error") {
      q.set("severity", severity.value);
      if (unresolved.value) q.set("unresolved", "1");
    }
    if (before) q.set("before", String(before));
    const res = await mcFetch<any>(`/api/mc/logs?${q}`);
    rows.value = before ? [...rows.value, ...res.rows] : res.rows;
    nextBefore.value = res.nextBefore;
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || "Couldn't load the logs.";
  } finally {
    loading.value = false;
  }
};

const switchTab = (k: "error" | "action") => {
  kind.value = k;
  rows.value = [];
  nextBefore.value = null;
  load();
};

const toggleResolved = async (r: any) => {
  busy.value = r.id;
  try {
    await mcFetch("/api/mc/logs/resolve", {
      method: "POST",
      body: { id: r.id, resolved: !r.resolvedAt },
    });
    r.resolvedAt = r.resolvedAt ? null : Date.now();
    if (unresolved.value && r.resolvedAt) {
      rows.value = rows.value.filter((x) => x.id !== r.id);
    }
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || "Couldn't update that.";
  } finally {
    busy.value = "";
  }
};

onMounted(() => load());
</script>

<style scoped>
.sel {
  @apply px-2.5 py-1.5 rounded-lg border border-black/[0.08] dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-[13px];
}
.btn-ghost {
  @apply px-3 py-2 rounded-lg text-sm font-semibold border border-black/[0.08] dark:border-white/[0.10] text-ink-muted dark:text-zinc-300 disabled:opacity-40;
}
</style>
