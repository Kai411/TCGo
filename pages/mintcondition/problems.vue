<template>
  <div class="max-w-5xl">
    <div class="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div>
        <h1 class="text-xl font-bold text-ink dark:text-white">Order problems</h1>
        <p class="text-sm text-ink-muted dark:text-zinc-400">
          Problems buyers reported. Buyer and seller sort out open ones themselves; decide only the escalated ones.
          A refund goes to the refund queue.
        </p>
      </div>
      <button
        type="button"
        @click="load"
        :disabled="loading"
        class="px-3 py-2 rounded-lg text-sm font-semibold border border-black/[0.10] dark:border-white/[0.12] text-ink dark:text-white disabled:opacity-50"
      >
        {{ loading ? "Loading…" : "Refresh" }}
      </button>
    </div>

    <p v-if="error" class="mb-4 text-sm text-red-600 dark:text-red-400">{{ error }}</p>

    <div v-if="!loading && !problems.length" class="py-16 text-center text-sm text-ink-muted dark:text-zinc-400">
      No open problems.
    </div>

    <div class="space-y-3">
      <div
        v-for="p in problems"
        :key="p.orderId"
        class="rounded-xl border border-black/[0.08] dark:border-white/[0.10] bg-white dark:bg-white/[0.04] p-4"
      >
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div>
            <NuxtLink :to="`/orders/${p.orderId}`" target="_blank" class="font-mono text-xs font-semibold text-pokemon-red hover:underline">
              #{{ p.orderId.slice(0, 8).toUpperCase() }}
            </NuxtLink>
            <p class="text-sm font-semibold text-ink dark:text-white">{{ p.reason }}</p>
            <p class="text-xs text-ink-muted dark:text-zinc-400">
              {{ p.buyerName || "Buyer" }} → {{ p.sellerName || "Seller" }} · RM {{ Number(p.total).toFixed(2) }} ·
              order {{ p.orderStatus }}<span v-if="p.trackingNumber"> · {{ p.trackingNumber }}</span>
            </p>
          </div>
          <span
            class="px-2 py-0.5 rounded-full text-[11px] font-semibold"
            :class="p.status === 'escalated' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400' : 'bg-black/[0.05] dark:bg-white/[0.08] text-ink-muted dark:text-zinc-300'"
          >
            {{ p.status === "escalated" ? `Escalated by ${p.escalatedBy}` : "Open" }}
          </span>
        </div>

        <ul class="mt-3 space-y-1.5 text-sm">
          <li v-for="(m, i) in p.messages" :key="i" class="text-ink dark:text-zinc-200">
            <span class="font-semibold capitalize">{{ m.by === "tcgo" ? "TCGo" : m.by }}:</span>
            {{ m.text }}
            <span class="text-[11px] text-ink-soft dark:text-zinc-500">{{ fmt(m.at) }}</span>
          </li>
        </ul>

        <div v-if="p.status === 'escalated'" class="mt-3 flex flex-wrap items-center gap-2">
          <input
            v-model="notes[p.orderId]"
            placeholder="Decision, shown to both sides"
            class="flex-1 min-w-[16rem] px-3 py-2 rounded-lg border border-black/[0.10] dark:border-white/[0.12] bg-transparent text-sm"
          />
          <button
            type="button"
            :disabled="busy === p.orderId"
            @click="decide(p, 'refund')"
            class="px-3 py-2 rounded-lg text-sm font-semibold bg-pokemon-red text-white disabled:opacity-50"
          >
            Refund buyer
          </button>
          <button
            type="button"
            :disabled="busy === p.orderId"
            @click="decide(p, 'release')"
            class="px-3 py-2 rounded-lg text-sm font-semibold border border-black/[0.10] dark:border-white/[0.12] text-ink dark:text-white disabled:opacity-50"
          >
            Release to seller
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: "admin", middleware: "mintcondition" });
useHead({ title: "Order problems — TCGo Admin" });

interface ProblemRow {
  orderId: string;
  status: string;
  reason: string;
  openedAt: number;
  escalatedBy: string | null;
  messages: { by: string; text: string; at: number }[];
  buyerName: string | null;
  sellerName: string | null;
  orderStatus: string;
  total: number;
  trackingNumber: string | null;
}

const { mcFetch } = useMcFetch();
const problems = ref<ProblemRow[]>([]);
const notes = reactive<Record<string, string>>({});
const loading = ref(false);
const error = ref("");
const busy = ref<string | null>(null);

const load = async () => {
  loading.value = true;
  error.value = "";
  try {
    const res = await mcFetch<{ problems: ProblemRow[] }>("/api/mc/problems");
    problems.value = res.problems;
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || "Couldn't load problems.";
  } finally {
    loading.value = false;
  }
};

const decide = async (p: ProblemRow, decision: "refund" | "release") => {
  const note = (notes[p.orderId] || "").trim();
  if (!note) {
    error.value = "Write the decision first; both sides will see it.";
    return;
  }
  const verb = decision === "refund" ? `refund RM ${p.total.toFixed(2)} to the buyer` : "release the payment to the seller";
  if (!confirm(`Decide to ${verb}?`)) return;
  busy.value = p.orderId;
  error.value = "";
  try {
    await mcFetch("/api/mc/problems/decide", { method: "POST", body: { orderId: p.orderId, decision, note } });
    await load();
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || "Couldn't save the decision.";
  } finally {
    busy.value = null;
  }
};

const fmt = (ms?: number) =>
  ms ? new Date(ms).toLocaleString("en-MY", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";

onMounted(load);
</script>
