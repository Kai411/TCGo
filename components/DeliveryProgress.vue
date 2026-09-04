<template>
  <div class="surface rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-5">
    <h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
      Delivery
    </h2>

    <!-- Cancelled orders have no position on a forward-only timeline. -->
    <p v-if="cancelled" class="text-sm text-gray-500 dark:text-zinc-400">
      This order was cancelled.
    </p>

    <ol v-else class="relative">
      <li
        v-for="(step, i) in BUYER_TIMELINE"
        :key="step.id"
        class="relative flex gap-3 pb-5 last:pb-0"
      >
        <!-- Connector, drawn behind the dots and stopping at the last one. -->
        <span
          v-if="i < BUYER_TIMELINE.length - 1"
          class="absolute left-[7px] top-4 bottom-0 w-px"
          :class="i < current ? 'bg-emerald-500' : 'bg-black/[0.10] dark:bg-white/[0.14]'"
          aria-hidden="true"
        />

        <span
          class="relative mt-0.5 flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full"
          :class="
            i < current
              ? 'bg-emerald-500'
              : i === current
                ? 'bg-pokemon-red ring-4 ring-pokemon-red/15'
                : 'bg-black/[0.12] dark:bg-white/[0.16]'
          "
        >
          <svg
            v-if="i < current"
            class="h-2.5 w-2.5 text-white"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="4"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>

        <div class="min-w-0 flex-1">
          <p
            class="text-[13.5px] font-semibold leading-tight"
            :class="
              i <= current
                ? 'text-ink dark:text-white'
                : 'text-gray-400 dark:text-zinc-500'
            "
          >
            {{ step.label }}
          </p>

          <!-- Only the current step explains itself. Every step carrying a
               sentence turns a glanceable timeline into a wall of text. -->
          <p v-if="i === current" class="mt-0.5 text-[12px] leading-relaxed text-gray-500 dark:text-zinc-400">
            {{ courierNote || step.blurb }}
          </p>
        </div>
      </li>
    </ol>

    <!-- The tracking number, once there is one. A buyer wants it to follow the
         parcel on the courier's own site — which is the one waybill detail
         that is genuinely theirs. -->
    <div
      v-if="order.trackingNumber && !cancelled"
      class="mt-4 border-t border-black/[0.05] pt-4 dark:border-white/[0.06]"
    >
      <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">
        Tracking number
      </p>
      <div class="mt-1 flex items-center gap-2">
        <p class="min-w-0 flex-1 break-all font-mono text-[13px] font-semibold text-ink dark:text-white">
          {{ order.trackingNumber }}
        </p>
        <button
          type="button"
          @click="copy"
          class="shrink-0 rounded-lg border border-black/[0.10] px-2.5 py-1 text-[11px] font-semibold text-ink transition-colors hover:bg-black/[0.03] dark:border-white/[0.12] dark:text-white dark:hover:bg-white/[0.05]"
        >
          {{ copied ? "Copied" : "Copy" }}
        </button>
      </div>
      <p v-if="order.shippingCarrier" class="mt-1 text-[12px] text-gray-500 dark:text-zinc-400">
        via {{ order.shippingCarrier }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { BUYER_TIMELINE, deliveryStage, timelineIndex } from "~/shared/delivery-stage";

const props = defineProps<{
  order: {
    status?: string | null;
    shipmentOrderNo?: string | null;
    shipmentStatus?: string | null;
    shipmentStatusCode?: number | null;
    trackingNumber?: string | null;
    shippingCarrier?: string | null;
  };
}>();

const cancelled = computed(() => deliveryStage(props.order) === "cancelled");
const current = computed(() => timelineIndex(props.order));

/**
 * The courier's own wording, preferred over ours.
 *
 * Our stage buckets summarise a numeric code, and the boundary between
 * collected and in transit is a guess. Showing what the courier actually said
 * means a mis-bucketed code is a slightly wrong heading over a right sentence.
 */
const courierNote = computed(() => props.order.shipmentStatus || "");

const copied = ref(false);
const copy = async () => {
  if (!props.order.trackingNumber) return;
  try {
    await navigator.clipboard.writeText(props.order.trackingNumber);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1600);
  } catch {
    // Clipboard blocked (insecure context, or denied). The number is on
    // screen and selectable, so this is a convenience that failed, not a
    // feature that broke.
  }
};
</script>
