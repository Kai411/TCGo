<template>
  <div>
    <div
      v-for="(line, i) in lines"
      :key="i"
      :class="[
        'flex items-baseline justify-between gap-3',
        line.kind === 'sub' ? 'py-1 pl-4' : 'py-2',
        line.kind === 'total'
          ? 'mt-1 pt-3 border-t border-black/[0.10] dark:border-white/[0.14]'
          : line.kind === 'sub'
            ? ''
            : 'border-b border-black/[0.04] dark:border-white/[0.05]',
      ]"
    >
      <div class="min-w-0">
        <p
          :class="[
            'truncate',
            line.kind === 'total'
              ? 'text-sm font-bold text-ink dark:text-white'
              : line.kind === 'gross'
                ? 'text-sm font-semibold text-ink dark:text-white'
                : line.kind === 'sub'
                  ? 'text-xs text-gray-500 dark:text-zinc-400'
                  : 'text-sm text-gray-600 dark:text-zinc-300',
          ]"
        >
          {{ line.label }}
        </p>
        <p
          v-if="line.note && showNotes && line.kind !== 'sub'"
          class="text-[11px] text-gray-400 dark:text-zinc-500 mt-0.5"
        >
          {{ line.note }}
        </p>
      </div>
      <span
        :class="[
          'shrink-0 tabular-nums',
          line.kind === 'total'
            ? 'text-lg font-extrabold text-ink dark:text-white'
            : line.kind === 'sub'
              ? 'text-xs text-gray-500 dark:text-zinc-400'
            : line.kind === 'credit'
              ? 'text-sm font-semibold text-emerald-600 dark:text-emerald-400'
              : line.amount < 0
                ? 'text-sm font-semibold text-rose-600 dark:text-rose-400'
                : 'text-sm font-semibold text-ink dark:text-white',
        ]"
      >
        {{ line.amount < 0 ? "−" : line.kind === "credit" ? "+" : "" }}RM
        {{ fmt(Math.abs(line.amount)) }}
      </span>
    </div>

    <!-- Postage the buyer paid straight to the courier. An aside, not a line
         in the statement — it was never the seller's money to lose. -->
    <p
      v-if="postage"
      class="text-[11px] leading-relaxed text-gray-500 dark:text-zinc-400 mt-3 pt-3 border-t border-black/[0.05] dark:border-white/[0.06]"
    >
      {{ postage }}
    </p>

    <p v-if="hint" class="text-[11px] text-gray-400 dark:text-zinc-500 mt-2.5">
      {{ hint }}
    </p>
  </div>
</template>

<script setup lang="ts">
import {
  settlementLines,
  shippingNote,
  type SettlementOrder,
} from "~/shared/settlement";

const props = withDefaults(
  defineProps<{
    order: SettlementOrder;
    /** Per-line explanations. Off in dense lists, on where there's room. */
    showNotes?: boolean;
    /** Trailing line, e.g. when the money unlocks. */
    hint?: string;
  }>(),
  { showNotes: true, hint: "" },
);

const lines = computed(() => settlementLines(props.order));
const postage = computed(() => shippingNote(props.order));
const fmt = (n: number) => n.toFixed(2);
</script>
