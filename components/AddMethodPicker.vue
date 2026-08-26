<template>
  <div>
    <p v-if="label" class="eyebrow mb-2.5">{{ label }}</p>

    <div
      class="grid gap-2.5 items-stretch"
      :class="visible.length === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'"
      role="tablist"
    >
      <button
        v-for="m in visible"
        :key="m.id"
        type="button"
        role="tab"
        :aria-selected="modelValue === m.id"
        :disabled="m.id === 'scan' && scanBlocked"
        @click="$emit('update:modelValue', m.id)"
        class="group flex h-full items-start gap-3 rounded-2xl border p-3.5 text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        :class="
          modelValue === m.id
            ? 'border-pokemon-red bg-pokemon-red/[0.04] ring-1 ring-pokemon-red/20'
            : 'border-black/[0.08] dark:border-white/[0.10] hover:border-black/20 dark:hover:border-white/25'
        "
      >
        <span
          class="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
          :class="
            modelValue === m.id
              ? 'bg-pokemon-red/10 text-pokemon-red'
              : 'bg-black/[0.04] dark:bg-white/[0.06] text-ink-muted dark:text-zinc-400'
          "
        >
          <svg
            class="w-[18px] h-[18px]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            v-html="m.icon"
          />
        </span>

        <span class="min-w-0">
          <!-- Quota sits inline with the label, not on its own line: as a third
               line it made the Scan tile taller than the other two and the row
               stopped aligning. -->
          <span class="flex items-center gap-1.5">
            <span class="text-[13px] font-bold text-ink dark:text-white">{{ m.label }}</span>
            <span
              v-if="m.id === 'scan' && showQuota"
              class="shrink-0 rounded px-1 py-px text-[10px] font-bold tabular-price"
              :class="
                isPremium
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : scanRemaining === 0
                    ? 'bg-pokemon-red/10 text-pokemon-red'
                    : 'bg-ink/[0.06] text-ink-subtle dark:bg-white/[0.08] dark:text-zinc-300'
              "
            >
              {{ isPremium ? "∞" : `${scanRemaining}/${scanLimit}` }}
            </span>
          </span>
          <span class="block text-[11px] text-ink-muted dark:text-zinc-400 leading-snug mt-0.5">
            {{ m.hint }}
          </span>
        </span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The single "how do you want to add this card?" control.
 *
 * Listings, Auctions and Inventory each had their own version of this — a pill
 * tab strip in two of them and card buttons in the third, with different
 * labels ("Scan cards" / "Scan card", "Enter manually" / "Manual input") and a
 * different method set. Same decision, three UIs. This is that decision, once.
 *
 * Flows opt into the methods that make sense for them via `methods`; what they
 * do *after* the choice is still their own business.
 */
export type AddMethod = "scan" | "manual";

const props = withDefaults(
  defineProps<{
    modelValue: AddMethod;
    /** Which methods this flow offers, in display order. */
    methods?: AddMethod[];
    label?: string;
    /** Scan quota — omit to hide the counter entirely. */
    scanRemaining?: number;
    scanLimit?: number;
    isPremium?: boolean;
  }>(),
  {
    methods: () => ["scan", "manual"],
    label: "How do you want to add it?",
    isPremium: false,
  },
);

defineEmits<{ (e: "update:modelValue", v: AddMethod): void }>();

const ALL: Record<AddMethod, { id: AddMethod; label: string; hint: string; icon: string }> = {
  scan: {
    id: "scan",
    label: "Scan",
    hint: "Point your phone at the card",
    icon: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="3"/>',
  },
  manual: {
    id: "manual",
    label: "Enter manually",
    hint: "Search the catalogue or type it in",
    icon: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  },
};

const visible = computed(() => props.methods.map((m) => ALL[m]));

const showQuota = computed(() => props.scanLimit != null && props.scanRemaining != null);
const scanBlocked = computed(
  () => !props.isPremium && showQuota.value && props.scanRemaining === 0,
);
</script>
