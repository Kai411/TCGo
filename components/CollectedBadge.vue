<template>
  <span
    class="inline-flex items-center gap-1.5"
    :title="`${quantity > 1 ? quantity + ' copies' : 'This card'} is in your collection`"
  >
    <svg
      :class="sizeClass"
      viewBox="0 0 24 24"
      role="img"
      :aria-label="quantity > 1 ? `${quantity} copies in your collection` : 'In your collection'"
    >
      <!-- Scalloped rosette, generated on a 12-lobe polar sweep rather than
           hand-tweaked, so every lobe is identical and it stays centred at any
           size. Filled emerald = owned; the tick carries the meaning for
           anyone who can't rely on the colour. -->
      <path
        d="M12.00 0.80Q13.49 0.67 14.38 3.11Q16.37 1.45 17.60 2.30Q18.95 2.94 18.51 5.49Q21.06 5.05 21.70 6.40Q22.55 7.63 20.89 9.62Q23.33 10.51 23.20 12.00Q23.33 13.49 20.89 14.38Q22.55 16.37 21.70 17.60Q21.06 18.95 18.51 18.51Q18.95 21.06 17.60 21.70Q16.37 22.55 14.38 20.89Q13.49 23.33 12.00 23.20Q10.51 23.33 9.62 20.89Q7.63 22.55 6.40 21.70Q5.05 21.06 5.49 18.51Q2.94 18.95 2.30 17.60Q1.45 16.37 3.11 14.38Q0.67 13.49 0.80 12.00Q0.67 10.51 3.11 9.62Q1.45 7.63 2.30 6.40Q2.94 5.05 5.49 5.49Q5.05 2.94 6.40 2.30Q7.63 1.45 9.62 3.11Q10.51 0.67 12.00 0.80Z"
        class="fill-emerald-500"
      />
      <path
        d="m8.2 12.3 2.6 2.6 5-5.4"
        fill="none"
        stroke="#fff"
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
    <span v-if="label" class="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
      In my collection
    </span>
  </span>
</template>

<script setup lang="ts">
/**
 * "This card is in your collection" — a status mark, not a control.
 *
 * It replaced a button that read "In my collection": a button implies an
 * action, and the only action here (adjusting copies) now lives on the
 * quantity stepper beside the price.
 */
const props = withDefaults(
  defineProps<{
    quantity?: number;
    /** Show the wordmark next to the rosette. */
    label?: boolean;
    size?: "sm" | "md";
  }>(),
  { quantity: 1, label: false, size: "md" },
);

const sizeClass = computed(() => (props.size === "sm" ? "w-5 h-5" : "w-7 h-7"));
</script>
