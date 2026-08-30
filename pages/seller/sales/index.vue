<template>
  <div class="max-w-4xl mx-auto">
    <div v-if="!user" class="text-center py-16">
      <p class="text-gray-500 dark:text-zinc-400 text-lg">Sign in to see your sales.</p>
    </div>

    <template v-else>
      <div class="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 class="text-2xl font-bold text-ink dark:text-white">Sales</h1>
          <p class="text-sm text-gray-500 dark:text-zinc-400 mt-1">
            Money you've concluded, at the counter and online. Shipping and
            tracking live in <NuxtLink to="/seller/orders" class="text-pokemon-red font-semibold hover:underline">Orders</NuxtLink>.
          </p>
        </div>
        <NuxtLink
          to="/seller/pos"
          class="px-3.5 py-2 rounded-lg text-sm font-semibold bg-pokemon-red text-white hover:bg-red-700 transition-colors"
        >
          Open POS
        </NuxtLink>
      </div>

      <div v-if="loading" class="flex justify-center py-16">
        <div class="animate-spin rounded-full h-6 w-6 border-2 border-ink/10 border-t-pokemon-red" />
      </div>

      <p v-else-if="error" class="text-sm text-red-600 dark:text-red-400 py-3">{{ error }}</p>

      <div v-else-if="!data?.periods.allTime.saleCount" class="surface rounded-2xl py-16 text-center">
        <p class="text-lg font-semibold text-ink dark:text-white">No sales yet</p>
        <p class="mt-1 text-sm text-gray-500 dark:text-zinc-400">
          Counter sales and completed marketplace orders both show here, with
          what each card actually went for.
        </p>
        <NuxtLink
          to="/seller/pos"
          class="inline-block mt-5 px-4 py-2 rounded-lg text-sm font-semibold bg-pokemon-red text-white"
        >
          Open POS
        </NuxtLink>
      </div>

      <template v-else>
        <!-- Takings over time -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <button
            v-for="p in periodCards"
            :key="p.key"
            type="button"
            class="surface rounded-2xl p-4 text-left transition-shadow hover:shadow-card-hover"
            :class="period === p.key ? 'ring-2 ring-pokemon-red' : ''"
            @click="period = p.key"
          >
            <p class="text-xs font-semibold text-ink-muted dark:text-zinc-400">{{ p.label }}</p>
            <p class="mt-1.5 text-xl font-bold text-ink dark:text-white tabular-price">
              {{ myr(p.totals.total) }}
            </p>
            <p class="mt-0.5 text-[11px] text-ink-soft dark:text-zinc-500">
              {{ p.totals.saleCount }} {{ p.totals.saleCount === 1 ? "sale" : "sales" }} ·
              {{ p.totals.itemCount }} {{ p.totals.itemCount === 1 ? "card" : "cards" }}
            </p>
          </button>
        </div>

        <!-- Breakdown for the selected window -->
        <div class="grid sm:grid-cols-3 gap-3 mb-6">
          <div class="surface rounded-2xl p-4">
            <p class="text-xs font-semibold text-ink-muted dark:text-zinc-400">Average sale</p>
            <p class="mt-1.5 text-xl font-bold text-ink dark:text-white tabular-price">
              {{ myr(selected.averageSale) }}
            </p>
          </div>
          <div class="surface rounded-2xl p-4">
            <p class="text-xs font-semibold text-ink-muted dark:text-zinc-400">
              Discount given
            </p>
            <p
              class="mt-1.5 text-xl font-bold tabular-price"
              :class="selected.discountTotal > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-ink dark:text-white'"
            >
              {{ myr(selected.discountTotal) }}
            </p>
            <p class="mt-0.5 text-[11px] text-ink-soft dark:text-zinc-500">
              <!-- The gap between the printed label and what was taken. Worth
                   its own figure: it's the easiest margin to give away and the
                   hardest to notice going. -->
              {{ selected.discountedLines }} of {{ selected.itemCount }} cards below label
            </p>
          </div>
          <div class="surface rounded-2xl p-4">
            <p class="text-xs font-semibold text-ink-muted dark:text-zinc-400">Asked vs taken</p>
            <p class="mt-1.5 text-xl font-bold text-ink dark:text-white tabular-price">
              {{ myr(selected.subtotal) }}
            </p>
            <p class="mt-0.5 text-[11px] text-ink-soft dark:text-zinc-500">
              took {{ myr(selected.total) }}
            </p>
          </div>
        </div>

        <!-- How people paid -->
        <div v-if="data.byMethod.length" class="surface rounded-2xl p-4 mb-6">
          <p class="eyebrow mb-3">How they paid</p>
          <div class="space-y-2">
            <div
              v-for="m in data.byMethod"
              :key="m.method"
              class="flex items-center gap-3"
            >
              <span class="text-[13px] font-semibold text-ink dark:text-zinc-200 w-28 shrink-0">
                {{ m.label }}
              </span>
              <div class="flex-1 h-2 rounded-full bg-black/[0.06] dark:bg-white/[0.08] overflow-hidden">
                <div class="h-full rounded-full bg-pokemon-red" :style="{ width: methodPct(m.total) }" />
              </div>
              <span class="text-[13px] tabular-price text-ink dark:text-zinc-200 w-24 text-right shrink-0">
                {{ myr(m.total) }}
              </span>
              <span class="text-[11px] text-ink-soft dark:text-zinc-500 w-8 text-right shrink-0">
                {{ m.count }}
              </span>
            </div>
          </div>
        </div>

        <!-- Best sellers -->
        <div v-if="data.topCards.length > 1" class="surface rounded-2xl p-4 mb-6">
          <p class="eyebrow mb-3">Moves fastest</p>
          <div class="space-y-2">
            <div v-for="c in data.topCards" :key="c.cardName" class="flex items-center gap-3">
              <img
                v-if="c.image"
                :src="c.image"
                alt=""
                class="w-8 h-11 object-cover rounded shrink-0 bg-black/[0.04]"
              />
              <span class="flex-1 min-w-0 text-[13px] font-semibold text-ink dark:text-zinc-200 truncate">
                {{ c.cardName }}
              </span>
              <span class="text-[11px] text-ink-soft dark:text-zinc-500 shrink-0">×{{ c.count }}</span>
              <span class="text-[13px] tabular-price text-ink dark:text-zinc-200 w-24 text-right shrink-0">
                {{ myr(c.total) }}
              </span>
            </div>
          </div>
        </div>

        <!-- Receipts -->
        <div class="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <p class="eyebrow">Sales</p>
          <div class="flex items-center gap-2">
            <select v-model="channel" class="sel">
              <option value="all">Both channels</option>
              <option value="in_person">In person</option>
              <option value="online">Online</option>
            </select>
            <select v-model="status" class="sel" @change="load()">
            <option value="all">All</option>
            <option value="paid">Paid</option>
            <option value="awaiting_payment">Awaiting payment</option>
            <option value="cancelled">Cancelled</option>
            <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        <p v-if="!visibleSales.length" class="text-sm text-ink-soft dark:text-zinc-500 py-3">
          Nothing matches that filter.
        </p>

        <div v-else class="surface rounded-2xl divide-y divide-black/[0.06] dark:divide-white/[0.08] overflow-hidden">
          <NuxtLink
            v-for="s in visibleSales"
            :key="s.id"
            :to="s.channel === 'online' && s.orderId ? `/orders/${s.orderId}` : `/seller/sales/${s.id}`"
            class="flex items-center gap-3 p-3.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors"
          >
            <div class="flex -space-x-3 shrink-0">
              <img
                v-for="(l, i) in s.lines.slice(0, 3)"
                :key="i"
                :src="l.image || FALLBACK"
                alt=""
                class="w-9 h-12 object-cover rounded border-2 border-white dark:border-zinc-900 bg-black/[0.04]"
              />
            </div>

            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold text-ink dark:text-white truncate">
                {{ saleTitle(s) }}
              </p>
              <p class="text-[12px] text-gray-500 dark:text-zinc-400">
                <span
                  class="inline-block px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide mr-1"
                  :class="s.channel === 'online'
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'"
                >{{ s.channel === "online" ? "Online" : "In person" }}</span>
                {{ s.lines.length }} {{ s.lines.length === 1 ? "card" : "cards" }} ·
                {{ METHOD_LABELS[s.method] ?? s.method }} ·
                {{ when(s.paidAt ?? s.createdAt) }}
              </p>
              <p
                v-if="s.discountTotal > 0"
                class="text-[11px] text-amber-600 dark:text-amber-400"
              >
                {{ myr(s.discountTotal) }} off label
              </p>
            </div>

            <div class="text-right shrink-0">
              <p class="text-sm font-bold text-ink dark:text-white tabular-price">
                {{ myr(s.total) }}
              </p>
              <span
                v-if="s.status !== 'paid'"
                class="inline-block mt-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide"
                :class="statusClass(s.status)"
              >
                {{ STATUS_LABELS[s.status] ?? s.status }}
              </span>
            </div>
          </NuxtLink>
        </div>

        <p
          v-if="data.truncated"
          class="mt-3 text-[11px] text-ink-soft dark:text-zinc-500 text-center"
        >
          Showing your most recent sales. Older ones aren't listed here yet.
        </p>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { METHOD_LABELS, STATUS_LABELS } from "~/shared/sales-summary";
import type { SalesTotals } from "~/shared/sales-summary";

definePageMeta({ layout: "seller" });
useHead({ title: "Counter sales | TCGo" });

const FALLBACK =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='36' height='48'%3E%3C/svg%3E";

const { user } = useAuth();
const { authedFetch } = useAuthedFetch();

const data = ref<any>(null);
const loading = ref(true);
const error = ref("");
const status = ref("all");
const channel = ref<"all" | "in_person" | "online">("all");
const period = ref<"today" | "last7" | "last30" | "allTime">("last7");

const load = async () => {
  if (!user.value) {
    loading.value = false;
    return;
  }
  loading.value = true;
  error.value = "";
  try {
    data.value = await authedFetch(`/api/pos/sales?status=${status.value}`);
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || "Couldn't load your sales.";
  } finally {
    loading.value = false;
  }
};
watch(user, load, { immediate: true });

// Filtered client-side: the channel split is a view of the page already
// loaded, and round-tripping for it would blank the list on every toggle.
const visibleSales = computed(() =>
  !data.value
    ? []
    : channel.value === "all"
      ? data.value.sales
      : data.value.sales.filter((s: any) => s.channel === channel.value),
);

const periodCards = computed(() =>
  !data.value
    ? []
    : ([
        { key: "today", label: "Today" },
        { key: "last7", label: "7 days" },
        { key: "last30", label: "30 days" },
        { key: "allTime", label: "All time" },
      ] as const).map((p) => ({ ...p, totals: data.value.periods[p.key] as SalesTotals })),
);

const selected = computed<SalesTotals>(
  () => data.value?.periods[period.value] ?? ({} as SalesTotals),
);

const myr = (n: number) =>
  `RM ${(n ?? 0).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Bars are relative to the biggest method, not to the total — with one method
// a share-of-total bar would always read 100% and say nothing.
const methodPct = (total: number) => {
  const max = Math.max(...(data.value?.byMethod ?? []).map((m: any) => m.total), 0);
  return max > 0 ? `${Math.max(4, (total / max) * 100)}%` : "0%";
};

const saleTitle = (s: any) => {
  const first = s.lines[0]?.cardName ?? "Sale";
  return s.lines.length > 1 ? `${first} + ${s.lines.length - 1} more` : first;
};

const when = (ms: number) => {
  const d = new Date(ms);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const time = d.toLocaleTimeString("en-MY", { hour: "numeric", minute: "2-digit" });
  // Today's sales are the ones being reconciled right now, so they get the
  // time; anything older gets the date, which is what you'd search by.
  return d.getTime() >= today.getTime()
    ? time
    : `${d.toLocaleDateString("en-MY", { day: "numeric", month: "short" })}, ${time}`;
};

const statusClass = (s: string) =>
  s === "awaiting_payment"
    ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
    : s === "failed"
      ? "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"
      : "bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-zinc-300";
</script>

<style scoped>
.sel {
  @apply px-2.5 py-1.5 rounded-lg border border-black/[0.08] dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-[13px];
}
</style>
