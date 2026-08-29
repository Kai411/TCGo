<template>
  <div class="max-w-2xl mx-auto">
    <div
      v-if="phase === 'loading'"
      class="flex justify-center py-24"
      role="status"
      aria-label="Loading"
    >
      <div class="animate-spin rounded-full h-6 w-6 border-2 border-ink/10 border-t-pokemon-red" />
    </div>

    <section v-else-if="phase === 'signed-out'" class="surface rounded-2xl px-6 py-14 text-center">
      <p class="eyebrow">Payment</p>
      <h1 class="mt-2 text-2xl font-extrabold tracking-tight text-ink dark:text-white">
        Sign in to see your order
      </h1>
      <p class="mt-2 text-sm text-gray-500 dark:text-zinc-400 max-w-sm mx-auto">
        Payment results are only shown to the account that placed the order.
      </p>
      <button type="button" :class="[BTN, BTN_DARK]" class="mt-6" @click="signInWithGoogle">
        Sign in with Google
      </button>
    </section>

    <section v-else-if="phase === 'not-found'" class="surface rounded-2xl px-6 py-14 text-center">
      <p class="eyebrow">Payment</p>
      <h1 class="mt-2 text-2xl font-extrabold tracking-tight text-ink dark:text-white">
        We couldn't find this order
      </h1>
      <p class="mt-2 text-sm text-gray-500 dark:text-zinc-400 max-w-sm mx-auto">
        The link may be incomplete, or the order was placed from a different account.
      </p>
      <NuxtLink to="/activity?tab=purchases" :class="[BTN, BTN_SECONDARY]" class="mt-6">
        All purchases
      </NuxtLink>
    </section>

    <template v-else-if="order && copy">
      <section class="text-center pt-2 pb-8">
        <PaymentCardFan :items="order.items" :badge="copy.badge" />

        <p class="eyebrow mt-7">{{ copy.eyebrow }}</p>
        <h1 class="mt-2 text-display font-extrabold text-ink dark:text-white">
          {{ copy.headline }}
        </h1>

        <p class="mt-3 text-sm text-gray-500 dark:text-zinc-400">
          <span class="font-semibold tabular-nums text-ink dark:text-white">RM {{ order.total.toFixed(2) }}</span>
          <span class="mx-1.5 text-gray-400 dark:text-zinc-500" aria-hidden="true">·</span>
          <NuxtLink :to="`/profile/${order.sellerUid}`" class="font-medium text-ink dark:text-white hover:underline">
            {{ order.sellerName }}
          </NuxtLink>
          <span class="mx-1.5 text-gray-400 dark:text-zinc-500" aria-hidden="true">·</span>
          <span class="font-mono">#{{ order.id.slice(0, 8) }}</span>
        </p>

        <p class="mt-3 text-sm sm:text-base text-gray-500 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
          {{ copy.body }}
        </p>

        <slot name="notice" />

        <div class="mt-7 flex flex-col sm:flex-row gap-2 justify-center">
          <template v-if="copy.primary">
            <button
              v-if="copy.primary.action === 'pay'"
              type="button"
              :class="[BTN, BTN_PRIMARY]"
              :disabled="paying"
              @click="emit('pay')"
            >
              <span v-if="paying" class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              {{ paying ? "Starting payment…" : copy.primary.label }}
            </button>
            <NuxtLink v-else-if="copy.primary.to" :to="copy.primary.to" :class="[BTN, BTN_PRIMARY]">
              {{ copy.primary.label }}
            </NuxtLink>
          </template>
          <NuxtLink v-if="copy.secondary?.to" :to="copy.secondary.to" :class="[BTN, BTN_SECONDARY]">
            {{ copy.secondary.label }}
          </NuxtLink>
        </div>
      </section>

      <div class="space-y-4">
        <slot />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
// Shared skeleton of the payment-return pages: the gates (loading, signed
// out, no such order), then the hero — card fan, outcome copy, calls to
// action — with the page's own details in the default slot.
import type { CompiledOrder } from "~/composables/useCompiledOrders";
import type {
  PaymentResultCopy,
  PaymentResultPhase,
} from "~/composables/usePaymentResult";

defineProps<{
  phase: PaymentResultPhase;
  order: CompiledOrder | null;
  copy: PaymentResultCopy | null;
  paying?: boolean;
}>();

const emit = defineEmits<{ pay: [] }>();

const { signInWithGoogle } = useAuth();

const BTN =
  "inline-flex items-center justify-center px-6 py-3 rounded-xl text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pokemon-red/40 disabled:opacity-60";
const BTN_PRIMARY = "bg-pokemon-red text-white hover:bg-red-700";
const BTN_SECONDARY =
  "border border-gray-200 dark:border-white/[0.10] text-gray-700 dark:text-zinc-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]";
const BTN_DARK =
  "bg-gray-900 dark:bg-white text-white dark:text-ink hover:bg-gray-700 dark:hover:bg-zinc-200";
</script>
