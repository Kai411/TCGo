<template>
  <!-- One cell of the owned-collection grid: flat, no card chrome. The grid
       draws the hairlines between cells. Layout follows the reference kai
       picked: photo, name + number, set, rarity, then value · qty with the
       manage menu beside it. -->
  <div class="relative flex flex-col p-2.5 sm:p-3">
    <NuxtLink
      :to="`/collection/${card.productId}`"
      class="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-pokemon-blue rounded-[6px]"
      :aria-label="`View ${card.name} price details`"
    >
      <div class="mx-auto w-[86%] aspect-[2.5/3.5] overflow-hidden rounded-[6px] bg-canvas-sunken dark:bg-white/[0.04]">
        <CardImage :src="card.imageUrl" :alt="card.name" />
      </div>

      <p
        class="mt-2.5 sm:mt-3 truncate font-semibold leading-tight text-[12px] sm:text-sm text-ink dark:text-white"
        :title="title"
      >
        {{ title }}
      </p>
      <p class="mt-0.5 truncate leading-tight text-[8px] sm:text-[11px] text-gray-500 dark:text-zinc-400">
        <span
          v-if="card.language === 'JP'"
          class="mr-1 inline-block rounded px-0.5 sm:px-1 py-px align-[1px] text-[7px] sm:text-[9px] font-bold leading-none bg-black/[0.06] text-gray-600 dark:bg-white/[0.10] dark:text-zinc-300"
          title="Japanese printing"
          >JP</span
        >{{ card.setName }}
      </p>
      <p
        v-if="card.rarity"
        class="mt-0.5 truncate leading-tight text-[8px] sm:text-[11px] font-medium text-pokemon-blue dark:text-sky-400"
      >
        {{ card.rarity }}
      </p>
    </NuxtLink>

    <!-- Value on the left; on the right, the copies owned sit above the ⋮
         (kai's layout), as a cards icon and the number. -->
    <div class="mt-auto pt-1.5 flex items-start gap-1 tabular-nums">
      <div class="min-w-0 flex-1">
        <p class="flex flex-wrap items-baseline gap-x-[3px] leading-tight text-[10px] sm:text-[13px] text-ink dark:text-white">
          <!-- A second-source price (TCGPlayer had none) reads the same as the
               card's page; its week's move is left off, as that history is
               TCGPlayer's. -->
          <span
            v-if="card.price"
            class="font-bold"
            :title="card.price.secondary ? `Second source, ${card.price.subtype} converted to RM` : undefined"
          >RM {{ formatPrice(card.price.market) }}</span>
          <span v-else class="text-gray-400 dark:text-zinc-500">No price</span>
          <!-- Arrow shape and colour both carry the direction, and a screen
               reader gets it in words. -->
          <span
            v-if="card.price && !card.price.secondary && change"
            class="inline-flex items-baseline gap-[0.5px] whitespace-nowrap font-semibold text-[8px] sm:text-[11px]"
            :class="
              change.direction === 'up'
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            "
            :title="changeTitle"
          >
            <span aria-hidden="true" class="text-[0.8em]">{{ change.direction === "up" ? "▲" : "▼" }}</span>
            <span aria-hidden="true">{{ change.label }}</span>
            <span class="sr-only">{{ changeTitle }}</span>
          </span>
        </p>
      </div>
      <div class="flex shrink-0 flex-col items-end">
        <span
          v-if="quantity > 0"
          class="inline-flex items-center gap-[3px] leading-tight text-[9px] sm:text-[11px] font-semibold text-gray-500 dark:text-zinc-400"
          :title="`${quantity} ${quantity === 1 ? 'copy' : 'copies'} owned`"
        >
          <svg class="w-2.5 h-2.5 sm:w-3 sm:h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true">
            <rect x="7" y="3" width="13" height="17" rx="2" />
            <path d="M4 7v12a2 2 0 0 0 2 2h9" />
          </svg>
          <span class="sr-only">Quantity</span>{{ quantity }}
        </span>
        <!-- Search results: a card not owned yet gets an add button where an
             owned card has its ⋮, so both read as the same tile. -->
        <button
          v-if="addable && quantity === 0"
          type="button"
          :disabled="busy"
          @click="$emit('add')"
          class="-mr-1.5 -mb-1.5 shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pokemon-blue disabled:cursor-wait"
          :aria-label="`Add ${card.name} to Dex`"
        >
          <span
            class="inline-flex items-center justify-center w-6 h-6 rounded-full text-white transition-[background-color,transform] duration-150 ease-out active:scale-90"
            :class="busy ? 'bg-gray-400' : 'bg-pokemon-blue hover:bg-blue-700'"
          >
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
        </button>
        <!-- 32px hit area on a 16px glyph: the tile is too narrow for 44px
             without eating the value line. -->
        <button
          v-else-if="!readonly"
          type="button"
          :disabled="busy"
          @click="$emit('menu', $event)"
          class="-mr-1.5 -mb-1.5 shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full text-gray-500 dark:text-zinc-400 active:bg-black/[0.05] dark:active:bg-white/[0.08] hover:text-ink dark:hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pokemon-blue disabled:opacity-50 disabled:cursor-wait"
          :aria-label="`Manage ${card.name}`"
          aria-haspopup="dialog"
        >
          <svg
            v-if="busy"
            class="h-3.5 w-3.5 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle class="opacity-30" cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3" />
            <path class="opacity-90" d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
          </svg>
          <svg v-else class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="12" cy="5" r="1.8" />
            <circle cx="12" cy="12" r="1.8" />
            <circle cx="12" cy="19" r="1.8" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CatalogMatch } from "~/composables/useCardCatalog";
import { PRICE_CHANGE_DAYS, type PriceChange } from "~/shared/price-change";

const props = defineProps<{
  card: CatalogMatch;
  quantity: number;
  busy?: boolean;
  /** No ⋮ menu: someone else's collection, shown on their profile. */
  readonly?: boolean;
  /** Show an add button instead of the ⋮ while the card isn't owned. */
  addable?: boolean;
  /** Market move over PRICE_CHANGE_DAYS; nothing shows when absent. */
  change?: PriceChange | null;
}>();

defineEmits<{ (e: "menu", ev: MouseEvent): void; (e: "add"): void }>();

// "Reshiram RC22/RC25": the number is how collectors tell printings apart.
// Skip it when the name already carries it ("Charizard ex - 199/165").
const title = computed(() => {
  const { name, number } = props.card;
  if (!number || name.includes(number)) return name;
  return `${name} ${number}`;
});

const changeTitle = computed(() =>
  props.change
    ? `${props.change.direction === "up" ? "Up" : "Down"} ${props.change.label} in ${PRICE_CHANGE_DAYS} days`
    : "",
);

// Same phone price format as the listing tiles: no ".00" on whole amounts.
const formatPrice = (value: number) =>
  value.toLocaleString("en-MY", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  });
</script>
