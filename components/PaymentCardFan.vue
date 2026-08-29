<template>
  <div class="relative mx-auto w-64 h-44 sm:w-80 sm:h-52 select-none">
    <!-- Stage light behind the fan, tinted by the outcome -->
    <div
      aria-hidden="true"
      class="absolute inset-x-8 top-6 bottom-2 rounded-full blur-2xl transition-colors duration-700"
      :class="GLOW[badge]"
    />

    <div
      v-for="card in cards"
      :key="card.item.cardId"
      class="fan-card absolute left-1/2 top-2 w-24 sm:w-28 aspect-[63/88] origin-bottom rounded-xl overflow-hidden bg-white dark:bg-[#1B1B20] ring-1 ring-black/[0.08] dark:ring-white/[0.10] shadow-card-hover"
      :style="card.style"
    >
      <CardImage :src="card.item.imageUrl" :alt="card.item.cardName" />
    </div>

    <!-- Keyed on the badge so a change of outcome (confirming → paid) pops in
         fresh instead of swapping the icon in place. -->
    <div
      :key="badge"
      role="img"
      :aria-label="LABEL[badge]"
      class="fan-badge absolute z-10 right-2 bottom-0 sm:right-5 w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center ring-4 ring-canvas dark:ring-canvas-inverse shadow-card"
      :class="TONE[badge]"
    >
      <svg v-if="badge === 'check'" class="w-7 h-7 sm:w-8 sm:h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      <span v-else-if="badge === 'spinner'" class="animate-spin rounded-full w-6 h-6 sm:w-7 sm:h-7 border-2 border-ink/10 dark:border-white/10 border-t-pokemon-red" />
      <svg v-else-if="badge === 'cross'" class="w-6 h-6 sm:w-7 sm:h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      <svg v-else-if="badge === 'alert'" class="w-6 h-6 sm:w-7 sm:h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="14"/><circle cx="12" cy="18.5" r="0.6" fill="currentColor"/></svg>
      <svg v-else-if="badge === 'arrow'" class="w-6 h-6 sm:w-7 sm:h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
      <svg v-else class="w-6 h-6 sm:w-7 sm:h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>
    </div>
  </div>
</template>

<script setup lang="ts">
// The cards the buyer just paid for, held like a hand — the moment this page
// exists for. Up to three are shown; the summary below lists the rest.
import type { CompiledOrderItem } from "~/composables/useCompiledOrders";
import type { PaymentBadge } from "~/composables/usePaymentResult";

const props = defineProps<{
  items: CompiledOrderItem[];
  badge: PaymentBadge;
}>();

// [rotate °, x px, y px] per slot, pivoting at the bottom edge like a real fan.
const LAYOUT: Record<number, [number, number, number][]> = {
  1: [[0, 0, 0]],
  2: [[-9, -30, 4], [9, 30, 4]],
  3: [[-14, -50, 12], [0, 0, 0], [14, 50, 12]],
};

// The priciest card takes the centre of the fan and the top of the stack —
// it is the one the buyer wants to see first.
const cards = computed(() => {
  const byPrice = [...props.items]
    .sort((a, b) => (b.price ?? 0) - (a.price ?? 0))
    .slice(0, 3);
  const n = byPrice.length;
  if (!n) return [];
  const slots =
    n === 3 ? [byPrice[1], byPrice[0], byPrice[2]] : n === 2 ? [byPrice[1], byPrice[0]] : byPrice;
  const stack = n === 3 ? [1, 3, 2] : n === 2 ? [1, 2] : [1];
  return slots.map((item, i) => {
    const [r, x, y] = LAYOUT[n][i];
    return {
      item,
      style: {
        "--r": `${r}deg`,
        "--x": `${x}px`,
        "--y": `${y}px`,
        "--i": String(i),
        zIndex: stack[i],
      },
    };
  });
});

const TONE: Record<PaymentBadge, string> = {
  check: "bg-emerald-500 text-white",
  spinner: "bg-white dark:bg-[#1B1B20] text-pokemon-red",
  cross: "bg-pokemon-red text-white",
  alert: "bg-amber-500 text-white",
  clock: "bg-gray-200 dark:bg-white/[0.12] text-gray-600 dark:text-zinc-200",
  arrow: "bg-gray-200 dark:bg-white/[0.12] text-gray-600 dark:text-zinc-200",
};

const GLOW: Record<PaymentBadge, string> = {
  check: "bg-emerald-400/30 dark:bg-emerald-400/15",
  spinner: "bg-pokemon-red/10 dark:bg-pokemon-red/15",
  cross: "bg-pokemon-red/15 dark:bg-pokemon-red/20",
  alert: "bg-amber-400/25 dark:bg-amber-400/15",
  clock: "bg-black/[0.06] dark:bg-white/[0.06]",
  arrow: "bg-black/[0.06] dark:bg-white/[0.06]",
};

const LABEL: Record<PaymentBadge, string> = {
  check: "Payment received",
  spinner: "Confirming payment",
  cross: "Payment not completed",
  alert: "Payment on hold",
  clock: "Awaiting payment",
  arrow: "Combined into another order",
};
</script>

<style scoped>
/* Resting pose. The animation below starts from a stacked deck and deals
   into it; reduced-motion visitors land here straight away. */
.fan-card {
  transform: translateX(-50%) translate(var(--x), var(--y)) rotate(var(--r));
  animation: fan-in 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: calc(var(--i) * 90ms);
}

@keyframes fan-in {
  from {
    opacity: 0;
    transform: translateX(-50%) translate(0, 16px) rotate(0deg) scale(0.94);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translate(var(--x), var(--y)) rotate(var(--r)) scale(1);
  }
}

.fan-badge {
  animation: badge-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.45s both;
}

@keyframes badge-in {
  from {
    opacity: 0;
    transform: scale(0.4);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .fan-card,
  .fan-badge {
    animation: none;
  }
}
</style>
