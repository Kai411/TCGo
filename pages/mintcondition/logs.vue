<template>
  <div class="mc-page">
    <div class="mc-page-head">
      <div>
        <p class="mc-eyebrow mb-1">Admin</p>
        <h1 class="mc-h1">Logs</h1>
        <p class="mc-meta mt-1">What broke, and who did what.</p>
      </div>
      <button class="mc-btn" :disabled="loading" @click="load()">
        {{ loading ? "Loading…" : "Refresh" }}
      </button>
    </div>

    <div class="mc-tabs mb-4" role="tablist" aria-label="Log type">
      <button
        v-for="t in tabs"
        :key="t.key"
        type="button"
        role="tab"
        :aria-selected="kind === t.key"
        @click="switchTab(t.key)"
      >
        {{ t.label }}
      </button>
    </div>

    <div class="flex gap-2 mb-4 flex-wrap items-center">
      <select v-model="area" class="mc-input !w-auto" aria-label="Area" @change="load()">
        <option value="all">All areas</option>
        <option v-for="a in LOG_AREAS" :key="a.key" :value="a.key">{{ a.label }}</option>
      </select>
      <select v-if="kind === 'error'" v-model="severity" class="mc-input !w-auto" aria-label="Severity" @change="load()">
        <option value="all">Any severity</option>
        <option value="critical">Critical</option>
        <option value="error">Error</option>
        <option value="warning">Warning</option>
      </select>
      <label v-if="kind === 'error'" class="flex items-center gap-2 mc-meta ml-1">
        <input v-model="unresolved" type="checkbox" @change="load()" />
        Unresolved only
      </label>
    </div>

    <p v-if="error" class="mc-callout mb-4" data-tone="bad" role="alert">{{ error }}</p>

    <div v-if="loading && !rows.length" class="grid gap-2" aria-busy="true" aria-label="Loading">
      <div class="mc-skel h-[84px]" />
      <div class="mc-skel h-[84px]" />
      <div class="mc-skel h-[84px]" />
    </div>

    <p v-else-if="!rows.length" class="mc-card mc-empty">
      {{
        kind === "error"
          ? "Nothing has failed in this window. That's the good outcome."
          : "No staff actions recorded in this window."
      }}
    </p>

    <!-- ── Errors ──────────────────────────────────────────────── -->
    <ul v-else-if="kind === 'error'" class="mc-card mc-list">
      <li v-for="r in rows" :key="r.id" class="mc-item" :class="r.resolvedAt ? 'opacity-60' : ''">
        <div class="mc-item-head">
          <div>
            <p class="flex items-center gap-2 flex-wrap mc-small">
              <span class="mc-tag">
                <span class="mc-dot" :data-tone="severityTone(r.severity)" aria-hidden="true" />{{ r.severity }}
              </span>
              <span>{{ areaLabel(r.area) }}</span>
              <code class="mc-mono">{{ r.code }}</code>
              <span>{{ fmt(r.at) }}</span>
            </p>
            <p class="mc-list-title mt-2">{{ r.message }}</p>
            <p v-if="r.hint" class="mc-meta mt-1">{{ r.hint }}</p>
            <p v-if="r.context" class="mt-1.5 mc-mono mc-ink-3 break-all">{{ compact(r.context) }}</p>
            <p v-if="r.orderId || r.payoutId" class="mt-1.5 mc-small">
              <NuxtLink v-if="r.orderId" :to="`/orders/${r.orderId}`" class="mc-link">Order {{ r.orderId.slice(0, 8) }}</NuxtLink>
              <span v-if="r.payoutId" class="mc-mono"> Payout {{ r.payoutId.slice(0, 8) }}</span>
            </p>
          </div>
          <button class="mc-btn mc-btn-sm shrink-0" :disabled="busy === r.id" @click="toggleResolved(r)">
            {{ r.resolvedAt ? "Reopen" : "Resolve" }}
          </button>
        </div>
      </li>
    </ul>

    <!-- ── Actions ─────────────────────────────────────────────── -->
    <ul v-else class="mc-card mc-list">
      <li v-for="r in rows" :key="r.id" class="mc-log-row">
        <span class="mc-mono mc-ink-3 mc-num">{{ fmt(r.at) }}</span>
        <!-- Truncated: the legacy marketplace-admin bridge logs a
             28-character Firebase uid where a staff ID is five. -->
        <span
          class="mc-mono font-semibold truncate"
          :title="r.actorName ? `${r.actor} — ${r.actorName}` : r.actor"
        >{{ actorLabel(r.actor) }}</span>
        <span class="text-[13.5px] min-w-0 break-words">{{ r.summary }}</span>
        <code class="mc-log-action mc-mono mc-ink-3 truncate">{{ r.action }}</code>
      </li>
    </ul>

    <button
      v-if="nextBefore"
      class="mc-btn w-full mt-3"
      :disabled="loading"
      @click="load(nextBefore)"
    >
      Load older
    </button>

    <!-- Sign-up codes never say whether mail really went out (that would
         reveal who has an account), so this is where staff find out. -->
    <section class="mt-10" aria-labelledby="mc-mail">
      <h2 id="mc-mail" class="mc-h2">Test email</h2>
      <p class="mc-small mt-0.5 mb-3">Sends one email and shows what Mailtrap answered.</p>
      <form class="mc-card mc-card-pad" @submit.prevent="sendTest">
        <div class="flex gap-2 flex-wrap">
          <input
            v-model="testTo"
            type="email"
            aria-label="Send to"
            placeholder="you@example.com"
            autocapitalize="none"
            class="mc-input flex-1 min-w-[200px]"
          />
          <button class="mc-btn" :disabled="testBusy || !testTo.trim()">
            {{ testBusy ? "Sending…" : "Send test" }}
          </button>
        </div>
        <div v-if="testResult" class="mc-callout mt-3" :data-tone="testResult.ok ? 'good' : 'bad'">
          <p class="font-semibold">{{ testResult.headline }}</p>
          <p v-if="testResult.detail" class="mc-meta mt-0.5">{{ testResult.detail }}</p>
        </div>
      </form>
    </section>
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

// ── Test email ──────────────────────────────────────────────────────────
const testTo = ref("");
const testBusy = ref(false);
const testResult = ref<{ ok: boolean; headline: string; detail?: string } | null>(null);

const sendTest = async () => {
  testBusy.value = true;
  testResult.value = null;
  try {
    const r = await mcFetch<any>("/api/mc/email/test", { method: "POST", body: { to: testTo.value } });
    if (!r.tokenSet) {
      testResult.value = { ok: false, headline: "No Mailtrap token on this site.", detail: "Set NUXT_MAILTRAP_API_TOKEN and redeploy." };
    } else if (r.sent && r.sandbox) {
      testResult.value = { ok: false, headline: "Captured in the Mailtrap test inbox, not delivered.", detail: "NUXT_MAILTRAP_INBOX_ID is still set on this site. Delete it and redeploy." };
    } else if (r.sent) {
      testResult.value = { ok: true, headline: `Sent from ${r.from}. Check the inbox (and spam).`, detail: "It also shows in Mailtrap > Sending > Email Logs." };
    } else {
      testResult.value = { ok: false, headline: `Mailtrap refused it: ${r.reason || "unknown"}`, detail: `Sender ${r.from}. "Unauthorized" means the token is wrong: use the API token from Sending Domains > tcgo.shop > Integration.` };
    }
  } catch (e: any) {
    testResult.value = { ok: false, headline: e?.data?.message || e?.message || "Couldn't send." };
  } finally {
    testBusy.value = false;
  }
};

const areaLabel = (a: string) => LOG_AREAS.find((x) => x.key === a)?.label ?? a;

// Staff IDs are short and meant to be read. A Firebase uid isn't — it only
// appears for actions taken through the legacy admin bridge, where all the
// reader needs is "not a staff account"; the full value is on hover.
const actorLabel = (actor: string) =>
  !actor ? "—" : actor.length <= 8 ? actor : `${actor.slice(0, 6)}…`;

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

const severityTone = (s: string) =>
  s === "critical" || s === "error" ? "bad" : s === "warning" ? "warn" : undefined;

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

<style>
.mc-log-row {
  display: grid;
  grid-template-columns: 7rem 4.5rem minmax(0, 1fr) minmax(0, 10rem);
  align-items: baseline;
  gap: 12px;
  padding: 10px 14px;
}
@media (max-width: 640px) {
  .mc-log-row {
    grid-template-columns: 4.5rem minmax(0, 1fr);
    gap: 2px 10px;
  }
  .mc-log-row > :first-child {
    grid-column: 1 / -1;
  }
  .mc-log-action {
    display: none;
  }
}
</style>
