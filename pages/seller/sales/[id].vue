<template>
  <div class="max-w-2xl mx-auto">
    <NuxtLink
      to="/seller/sales"
      class="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-zinc-400 hover:text-ink dark:hover:text-white mb-4"
    >
      ← Back to counter sales
    </NuxtLink>

    <div v-if="loading" class="flex justify-center py-16">
      <div class="animate-spin rounded-full h-6 w-6 border-2 border-ink/10 border-t-pokemon-red" />
    </div>

    <div v-else-if="error" class="surface rounded-2xl py-16 text-center">
      <p class="text-gray-500 dark:text-zinc-400">{{ error }}</p>
    </div>

    <template v-else-if="sale">
      <div class="surface rounded-2xl overflow-hidden">
        <!-- Header -->
        <div class="p-5 border-b border-black/[0.06] dark:border-white/[0.08]">
          <div class="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p class="text-2xl font-bold text-ink dark:text-white tabular-price">
                {{ myr(sale.total) }}
              </p>
              <p class="text-[13px] text-gray-500 dark:text-zinc-400 mt-0.5">
                {{ METHOD_LABELS[sale.method] ?? sale.method }} ·
                {{ fullWhen(sale.paidAt ?? sale.createdAt) }}
              </p>
            </div>
            <span
              class="px-2 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wide"
              :class="statusClass"
            >
              {{ STATUS_LABELS[sale.status] ?? sale.status }}
            </span>
          </div>

          <p
            v-if="sale.failedReason"
            class="mt-3 rounded-lg bg-red-50 dark:bg-red-500/10 px-3 py-2 text-[12px] text-red-700 dark:text-red-300"
          >
            {{ sale.failedReason }}
          </p>
          <p
            v-else-if="sale.status === 'awaiting_payment'"
            class="mt-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-[12px] leading-relaxed text-amber-800 dark:text-amber-300"
          >
            These cards are held for this sale and won't show as available until
            it's paid or cancelled.
          </p>
        </div>

        <!-- Lines -->
        <div class="divide-y divide-black/[0.06] dark:divide-white/[0.08]">
          <div v-for="(l, i) in sale.lines" :key="i" class="flex items-center gap-3 p-4">
            <img
              v-if="l.image"
              :src="l.image"
              alt=""
              class="w-11 h-15 object-cover rounded shrink-0 bg-black/[0.04]"
            />
            <div class="min-w-0 flex-1">
              <component
                :is="l.cardId ? 'NuxtLink' : 'p'"
                :to="l.cardId ? `/cards/${l.cardId}` : undefined"
                class="block text-sm font-semibold text-ink dark:text-white truncate"
                :class="l.cardId ? 'hover:underline' : ''"
              >
                {{ l.cardName }}
              </component>
              <p v-if="l.sub" class="text-[12px] text-gray-500 dark:text-zinc-400 truncate">
                {{ l.sub }}
              </p>
            </div>
            <div class="text-right shrink-0">
              <p class="text-sm font-semibold text-ink dark:text-white tabular-price">
                {{ myr(l.soldPrice) }}
              </p>
              <!-- Only shown when they differ. A struck-through price that
                   matches the one beside it is noise. -->
              <p
                v-if="discount(l) > 0"
                class="text-[11px] text-amber-600 dark:text-amber-400 tabular-price"
              >
                <s class="text-ink-soft dark:text-zinc-600">{{ myr(l.listPrice) }}</s>
                −{{ myr(discount(l)) }}
              </p>
            </div>
          </div>
        </div>

        <!-- Totals -->
        <div class="p-5 border-t border-black/[0.06] dark:border-white/[0.08] space-y-1.5">
          <div class="flex justify-between text-[13px] text-gray-500 dark:text-zinc-400">
            <span>Labels asked</span>
            <span class="tabular-price">{{ myr(sale.subtotal) }}</span>
          </div>
          <div
            v-if="sale.discountTotal > 0"
            class="flex justify-between text-[13px] text-amber-600 dark:text-amber-400"
          >
            <span>Discount given</span>
            <span class="tabular-price">−{{ myr(sale.discountTotal) }}</span>
          </div>
          <div
            class="flex justify-between text-base font-bold text-ink dark:text-white pt-1.5 border-t border-black/[0.06] dark:border-white/[0.08]"
          >
            <span>Taken</span>
            <span class="tabular-price">{{ myr(sale.total) }}</span>
          </div>
        </div>
      </div>

      <p class="mt-4 text-[11px] text-ink-soft dark:text-zinc-500 text-center">
        Counter sales settle straight to you — they don't go through the
        marketplace payout queue.
      </p>
      <p class="mt-1 text-[11px] text-ink-soft dark:text-zinc-600 text-center font-mono">
        {{ sale.id }}
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { METHOD_LABELS, STATUS_LABELS } from "~/shared/sales-summary";

definePageMeta({ layout: "seller" });

const route = useRoute();
const { user } = useAuth();
const { authedFetch } = useAuthedFetch();

const sale = ref<any>(null);
const loading = ref(true);
const error = ref("");

const load = async () => {
  if (!user.value) return;
  loading.value = true;
  error.value = "";
  try {
    sale.value = await authedFetch(`/api/pos/sales/${route.params.id}`);
  } catch (e: any) {
    error.value =
      e?.statusCode === 404 || e?.status === 404
        ? "Sale not found."
        : e?.data?.message || e?.message || "Couldn't load this sale.";
  } finally {
    loading.value = false;
  }
};
watch(user, load, { immediate: true });

useHead({
  title: computed(() => (sale.value ? `Sale ${myr(sale.value.total)} | TCGo` : "Sale | TCGo")),
});

function myr(n: number) {
  return `RM ${(n ?? 0).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const discount = (l: { listPrice: number; soldPrice: number }) =>
  Math.max(0, Math.round((l.listPrice - l.soldPrice) * 100) / 100);

const fullWhen = (ms: number) =>
  new Date(ms).toLocaleString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const statusClass = computed(() => {
  const s = sale.value?.status;
  if (s === "paid") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";
  if (s === "awaiting_payment") return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300";
  if (s === "failed") return "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300";
  return "bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-zinc-300";
});
</script>
