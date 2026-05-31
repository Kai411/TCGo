<template>
  <div class="min-h-screen bg-white text-black">
    <!-- Toolbar (hidden when printing) -->
    <div class="no-print sticky top-0 z-10 bg-white border-b border-gray-200 px-4 h-14 flex items-center justify-between gap-3">
      <NuxtLink to="/inventory/items" class="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-black">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        Back to items
      </NuxtLink>
      <div class="flex items-center gap-3">
        <span class="text-xs text-gray-500 tabular-nums">{{ labelCards.length }} label{{ labelCards.length === 1 ? "" : "s" }}</span>
        <button
          @click="print"
          :disabled="!ready || labelCards.length === 0"
          class="px-4 py-2 rounded-lg text-sm font-semibold bg-pokemon-red text-white hover:bg-red-700 transition-colors disabled:opacity-50"
        >
          Print / Save as PDF
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="!ready" class="flex flex-col items-center justify-center py-24 text-gray-500">
      <div class="animate-spin rounded-full h-6 w-6 border-2 border-gray-200 border-t-pokemon-red mb-3"/>
      <p class="text-sm">Generating QR codes…</p>
    </div>

    <div v-else-if="labelCards.length === 0" class="text-center py-24 text-gray-500">
      <p class="text-sm">No items to print.</p>
      <NuxtLink to="/inventory/items" class="text-pokemon-red hover:underline text-sm">Back to items</NuxtLink>
    </div>

    <!-- Label sheet -->
    <div v-else class="print-sheet p-4 mx-auto" style="max-width: 210mm;">
      <div class="grid grid-cols-3 gap-2">
        <div
          v-for="l in labelCards"
          :key="l.id"
          class="label flex gap-2 items-center border border-gray-300 rounded p-2 break-inside-avoid"
        >
          <img :src="l.qr" :alt="`QR ${l.id}`" class="w-[64px] h-[64px] shrink-0" />
          <div class="min-w-0 flex-1">
            <p class="text-[11px] font-bold leading-tight line-clamp-2 break-words">{{ l.cardName }}</p>
            <p class="text-[9px] text-gray-600 truncate">{{ l.sub }}</p>
            <div class="flex items-center justify-between mt-0.5">
              <span class="text-[9px] text-gray-500">{{ l.condition || "—" }}</span>
              <span class="text-[11px] font-extrabold tabular-nums">RM {{ l.price }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { InventoryItem } from "~/composables/useInventory";

definePageMeta({ layout: false });
useHead({ title: "Print labels | TCGo" });

const { user } = useAuth();
const { items, listenMyInventory, labelQueue } = useInventory();

onMounted(() => {
  if (user.value) listenMyInventory();
});
watch(user, (u) => {
  if (u) listenMyInventory();
});

// Items to print: the queue set from the Items page, else everything.
const targetItems = computed<InventoryItem[]>(() => {
  if (labelQueue.value.length) {
    const set = new Set(labelQueue.value);
    return items.value.filter((i) => set.has(i.id));
  }
  return items.value;
});

interface LabelCard {
  id: string;
  cardName: string;
  sub: string;
  condition: string;
  price: string;
  qr: string;
}

const labelCards = ref<LabelCard[]>([]);
const ready = ref(false);

// Generate QR data URLs (lazy-load the qrcode lib). QR encodes the inventory
// item id so the POS scanner can resolve it offline against cached stock.
const generate = async (list: InventoryItem[]) => {
  ready.value = false;
  if (!list.length) {
    labelCards.value = [];
    ready.value = true;
    return;
  }
  const mod: any = await import("qrcode");
  const QRCode = mod.default ?? mod;
  const out: LabelCard[] = [];
  for (const item of list) {
    let qr = "";
    try {
      qr = await QRCode.toDataURL(`tcgo:inv:${item.id}`, {
        margin: 0,
        width: 128,
        errorCorrectionLevel: "M",
      });
    } catch {}
    out.push({
      id: item.id,
      cardName: item.cardName,
      sub: [item.setName, item.number].filter(Boolean).join(" · "),
      condition: item.condition,
      price: (item.listPrice || 0).toFixed(2),
      qr,
    });
  }
  labelCards.value = out;
  ready.value = true;
};

// Regenerate when the target set resolves/changes (e.g. inventory loads).
watch(
  targetItems,
  (list) => {
    generate(list);
  },
  { immediate: true },
);

const print = () => window.print();
</script>

<style>
@media print {
  .no-print {
    display: none !important;
  }
  @page {
    size: A4;
    margin: 10mm;
  }
  html,
  body {
    background: #fff !important;
  }
  .print-sheet {
    padding: 0 !important;
  }
  .label {
    break-inside: avoid;
  }
}
</style>
