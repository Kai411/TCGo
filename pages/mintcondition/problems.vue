<template>
  <div class="mc-page">
    <div class="mc-page-head">
      <div>
        <p class="mc-eyebrow mb-1">Trust and safety</p>
        <h1 class="mc-h1">Order problems</h1>
        <p class="mc-meta mt-1">
          <template v-if="!loading && problems.length">
            {{ escalated.length }} waiting for a decision, {{ open.length }} being sorted out by buyer and seller.
          </template>
          <template v-else>Problems buyers reported on an order.</template>
        </p>
      </div>
      <button type="button" :disabled="loading" class="mc-btn" @click="load">
        {{ loading ? "Loading…" : "Refresh" }}
      </button>
    </div>

    <p v-if="error" class="mc-callout mb-6" data-tone="bad" role="alert">{{ error }}</p>

    <div v-if="loading && !problems.length" class="grid gap-3" aria-busy="true" aria-label="Loading">
      <div class="mc-skel h-[160px]" />
      <div class="mc-skel h-[120px]" />
    </div>

    <div v-else class="grid gap-8">
      <section v-for="g in groups" :key="g.key" :aria-labelledby="`mc-${g.key}`">
        <div class="mc-section-head">
          <div>
            <h2 :id="`mc-${g.key}`" class="mc-h2">
              {{ g.title }}<span class="mc-tab-count">{{ g.items.length }}</span>
            </h2>
            <p class="mc-small mt-0.5">{{ g.hint }}</p>
          </div>
        </div>

        <p v-if="!g.items.length" class="mc-card mc-empty">{{ g.empty }}</p>

        <ul v-else class="mc-card mc-list">
          <li v-for="p in g.items" :key="p.orderId" class="mc-item">
            <div class="mc-item-head">
              <div>
                <p class="mc-list-title">{{ p.reason }}</p>
                <p class="mc-small mt-0.5">
                  <NuxtLink :to="`/orders/${p.orderId}`" target="_blank" class="mc-link mc-mono">
                    #{{ p.orderId.slice(0, 8).toUpperCase() }}
                  </NuxtLink>
                  · {{ p.buyerName || "Buyer" }} bought from {{ p.sellerName || "Seller" }}
                  · order {{ p.orderStatus }}
                  <template v-if="p.trackingNumber"> · tracking <span class="mc-mono">{{ p.trackingNumber }}</span></template>
                  · opened {{ fmt(p.openedAt) }}
                </p>
              </div>
              <div class="text-right">
                <p class="mc-amount">RM {{ Number(p.total).toFixed(2) }}</p>
                <p v-if="p.status === 'escalated'" class="mc-small">Escalated by {{ p.escalatedBy }}</p>
              </div>
            </div>

            <ul v-if="p.messages.length" class="mc-thread">
              <li v-for="(m, i) in p.messages" :key="i">
                <span class="mc-thread-by">{{ who(m.by) }}</span>{{ m.text }}<span class="mc-thread-at">{{ fmt(m.at) }}</span>
              </li>
            </ul>

            <div v-if="p.status === 'escalated'" class="mc-divider mt-4 pt-4 grid gap-3">
              <label class="mc-field">
                <span>Decision, shown to both sides</span>
                <input
                  v-model="notes[p.orderId]"
                  class="mc-input"
                  placeholder="For example: tracking shows delivered to the wrong address, so the buyer is refunded."
                />
              </label>
              <div class="flex flex-wrap gap-2">
                <button
                  type="button"
                  class="mc-btn mc-btn-sm mc-btn-primary"
                  :disabled="busy === p.orderId"
                  @click="decide(p, 'refund')"
                >
                  Refund buyer
                </button>
                <button
                  type="button"
                  class="mc-btn mc-btn-sm"
                  :disabled="busy === p.orderId"
                  @click="decide(p, 'release')"
                >
                  Release to seller
                </button>
                <p class="mc-small self-center">A refund goes to the refund queue.</p>
              </div>
            </div>
          </li>
        </ul>
      </section>
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

const escalated = computed(() => problems.value.filter((p) => p.status === "escalated"));
const open = computed(() => problems.value.filter((p) => p.status !== "escalated"));
const groups = computed(() => [
  {
    key: "escalated",
    title: "Needs your decision",
    hint: "Buyer or seller asked TCGo to step in.",
    empty: "Nothing is escalated.",
    items: escalated.value,
  },
  {
    key: "open",
    title: "Being sorted out",
    hint: "Buyer and seller are talking it through. No action unless one of them escalates.",
    empty: "No open problems.",
    items: open.value,
  },
]);
const who = (by: string) => (by === "tcgo" ? "TCGo" : by.charAt(0).toUpperCase() + by.slice(1));

const fmt = (ms?: number) =>
  ms ? new Date(ms).toLocaleString("en-MY", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";

onMounted(load);
</script>
