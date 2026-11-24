<template>
  <div class="sl-page sl-page--narrow">
    <SellerPageHead title="Counter sale" back="/seller/sales" back-label="Sales" />

    <div v-if="loading" class="mc-skel h-[240px]" aria-busy="true" aria-label="Loading sale" />

    <p v-else-if="error" class="mc-card mc-empty">{{ error }}</p>

    <template v-else-if="sale">
      <section class="mc-card overflow-hidden">
        <div class="mc-card-pad">
          <p class="mc-label flex items-center gap-2">
            <span class="mc-dot" :data-tone="statusTone" aria-hidden="true" />
            {{ STATUS_LABELS[sale.status] ?? sale.status }}
          </p>
          <p class="mc-hero-value mc-num mt-1">{{ myr(sale.total) }}</p>
          <p class="mc-small mt-1.5">
            {{ METHOD_LABELS[sale.method] ?? sale.method }} ·
            {{ fullWhen(sale.paidAt ?? sale.createdAt) }}
          </p>
          <p v-if="sale.failedReason" class="mc-callout mt-3" data-tone="bad">{{ sale.failedReason }}</p>
          <p v-else-if="sale.status === 'awaiting_payment'" class="mc-callout mt-3">
            These cards are held for this sale and won't show as available until
            it's paid or cancelled.
          </p>
        </div>

        <div class="mc-divider">
          <div v-for="(l, i) in sale.lines" :key="i" class="mc-row">
            <img v-if="l.image" :src="l.image" alt="" class="mc-thumb !w-9" />
            <span v-else class="mc-thumb !w-9" aria-hidden="true" />
            <div class="min-w-0">
              <component
                :is="l.cardId ? 'NuxtLink' : 'p'"
                :to="l.cardId ? `/cards/${l.cardId}` : undefined"
                class="mc-row-title block"
                :class="l.cardId ? 'hover:underline underline-offset-2' : ''"
              >
                {{ l.cardName }}
              </component>
              <p v-if="l.sub" class="mc-meta truncate">{{ l.sub }}</p>
            </div>
            <div class="text-right">
              <p class="mc-num font-semibold">{{ myr(l.soldPrice) }}</p>
              <p v-if="discount(l) > 0" class="mc-small mc-num">
                label {{ myr(l.listPrice) }} · −{{ myr(discount(l)) }}
              </p>
            </div>
          </div>
        </div>

        <dl class="mc-divider mc-card-pad flex flex-col gap-1.5">
          <AdminRow label="Label prices" :value="sale.subtotal" />
          <AdminRow v-if="sale.discountTotal > 0" label="Discount given" :value="-sale.discountTotal" />
          <AdminRow label="Taken" :value="sale.total" strong divider />
        </dl>
      </section>

      <p class="mc-small mt-4 text-center">
        Counter sales settle straight to you. They don't go through the
        marketplace payout queue.
      </p>
      <p class="mc-small mt-1 text-center font-mono">{{ sale.id }}</p>
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

const statusTone = computed(() => {
  const s = sale.value?.status;
  if (s === "paid") return "good";
  if (s === "awaiting_payment") return "warn";
  if (s === "failed") return "bad";
  return undefined;
});
</script>
