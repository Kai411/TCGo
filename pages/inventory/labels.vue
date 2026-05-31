<template>
  <div class="min-h-screen bg-white text-black">
    <!-- Toolbar (hidden when printing) -->
    <div class="no-print sticky top-0 z-10 bg-white border-b border-gray-200 px-4 h-14 flex items-center justify-between gap-3">
      <NuxtLink to="/inventory/items" class="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-black shrink-0">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        Back
      </NuxtLink>

      <!-- Mode toggle -->
      <div class="inline-flex p-0.5 bg-gray-100 rounded-lg">
        <button
          @click="mode = 'sheet'"
          class="px-3 py-1 text-xs font-semibold rounded-md transition-colors"
          :class="mode === 'sheet' ? 'bg-white shadow-sm text-black' : 'text-gray-500'"
        >A4 sheet</button>
        <button
          @click="mode = 'thermal'"
          class="px-3 py-1 text-xs font-semibold rounded-md transition-colors"
          :class="mode === 'thermal' ? 'bg-white shadow-sm text-black' : 'text-gray-500'"
        >Thermal</button>
      </div>

      <div class="flex items-center gap-3 shrink-0">
        <span class="text-xs text-gray-500 tabular-nums hidden sm:inline">{{ labelCards.length }} label{{ labelCards.length === 1 ? "" : "s" }}</span>
        <button
          v-if="mode === 'sheet'"
          @click="print"
          :disabled="!ready || labelCards.length === 0"
          class="px-4 py-2 rounded-lg text-sm font-semibold bg-pokemon-red text-white hover:bg-red-700 transition-colors disabled:opacity-50"
        >Print / PDF</button>
        <button
          v-else
          @click="downloadAllThermal"
          :disabled="!thermalReady || thermalImages.length === 0 || zipping"
          class="px-4 py-2 rounded-lg text-sm font-semibold bg-pokemon-red text-white hover:bg-red-700 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
        >
          <span v-if="zipping" class="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
          Download ZIP
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

    <!-- A4 SHEET MODE -->
    <div v-else-if="mode === 'sheet'" class="print-sheet p-4 mx-auto" style="max-width: 210mm;">
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

    <!-- THERMAL MODE -->
    <div v-else class="no-print p-4 max-w-3xl mx-auto">
      <!-- Size selector -->
      <div class="flex items-center gap-2 mb-4 flex-wrap">
        <span class="text-xs font-semibold text-gray-500">Label size:</span>
        <button
          v-for="s in THERMAL_SIZES"
          :key="s.id"
          @click="thermalSize = s.id"
          class="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
          :class="thermalSize === s.id ? 'border-pokemon-red text-pokemon-red bg-pokemon-red/5' : 'border-gray-200 text-gray-600'"
        >{{ s.label }}</button>
      </div>

      <p class="text-xs text-gray-500 mb-4">
        Generates one PNG per label, sized for thermal label printers (Niimbot, Brother, Phomemo…).
        Download the ZIP and print the images from your printer's app.
      </p>

      <div v-if="!thermalReady" class="flex justify-center py-16">
        <div class="animate-spin rounded-full h-6 w-6 border-2 border-gray-200 border-t-pokemon-red"/>
      </div>
      <div v-else class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div v-for="img in thermalImages" :key="img.id" class="border border-gray-200 rounded-lg p-2">
          <img :src="img.dataUrl" :alt="img.name" class="w-full border border-gray-100" />
          <a :href="img.dataUrl" :download="img.file" class="mt-1.5 block text-center text-[11px] font-semibold text-pokemon-red hover:underline">Download</a>
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

const mode = ref<"sheet" | "thermal">("sheet");

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
      qr = await QRCode.toDataURL(`tcgo:inv:${item.id}`, { margin: 0, width: 160, errorCorrectionLevel: "M" });
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

watch(targetItems, (list) => generate(list), { immediate: true });

const print = () => window.print();

// ── Thermal label rendering ──────────────────────────────────────────
const THERMAL_SIZES = [
  { id: "40x30", label: "40 × 30 mm", w: 40, h: 30 },
  { id: "50x30", label: "50 × 30 mm", w: 50, h: 30 },
  { id: "50x40", label: "50 × 40 mm", w: 50, h: 40 },
];
const thermalSize = ref("40x30");
const thermalImages = ref<{ id: string; name: string; file: string; dataUrl: string }[]>([]);
const thermalReady = ref(false);
const zipping = ref(false);

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(img);
    img.src = src;
  });

const fitText = (ctx: CanvasRenderingContext2D, text: string, maxW: number): string => {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
  return t + "…";
};
const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] => {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? cur + " " + w : w;
    if (ctx.measureText(test).width <= maxW) cur = test;
    else {
      if (cur) lines.push(cur);
      cur = w;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (lines.length) lines[lines.length - 1] = fitText(ctx, lines[lines.length - 1], maxW);
  return lines.slice(0, maxLines);
};

const renderThermal = async (card: LabelCard, mmW: number, mmH: number): Promise<string> => {
  const DPMM = 8; // ~203 dpi (thermal native)
  const W = Math.round(mmW * DPMM);
  const H = Math.round(mmH * DPMM);
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d");
  if (!ctx) return "";
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#000";
  ctx.textBaseline = "top";

  const pad = Math.round(H * 0.07);
  const qrSize = H - pad * 2;
  if (card.qr) {
    const img = await loadImage(card.qr);
    ctx.drawImage(img, pad, pad, qrSize, qrSize);
  }
  const tx = pad + qrSize + pad;
  const tw = W - tx - pad;

  // Name (up to 2 lines)
  const nameFont = Math.round(H * 0.13);
  ctx.font = `bold ${nameFont}px sans-serif`;
  ctx.fillStyle = "#000";
  const lines = wrapText(ctx, card.cardName, tw, 2);
  let y = pad;
  for (const ln of lines) {
    ctx.fillText(ln, tx, y);
    y += Math.round(nameFont * 1.1);
  }
  // Sub
  const subFont = Math.round(H * 0.085);
  ctx.font = `${subFont}px sans-serif`;
  ctx.fillStyle = "#555";
  if (card.sub) {
    ctx.fillText(fitText(ctx, card.sub, tw), tx, y);
    y += Math.round(subFont * 1.3);
  }
  if (card.condition) {
    ctx.fillText(fitText(ctx, card.condition, tw), tx, y);
  }
  // Price (bottom-right)
  const priceFont = Math.round(H * 0.17);
  ctx.font = `bold ${priceFont}px sans-serif`;
  ctx.fillStyle = "#000";
  const priceStr = `RM ${card.price}`;
  const pw = ctx.measureText(priceStr).width;
  ctx.fillText(priceStr, Math.max(tx, W - pad - pw), H - pad - priceFont);

  return cv.toDataURL("image/png");
};

const safeName = (s: string) => s.replace(/[^a-z0-9]+/gi, "_").slice(0, 40) || "label";

const buildThermal = async () => {
  if (!labelCards.value.length) {
    thermalImages.value = [];
    thermalReady.value = true;
    return;
  }
  thermalReady.value = false;
  const size = THERMAL_SIZES.find((s) => s.id === thermalSize.value) || THERMAL_SIZES[0];
  const out: { id: string; name: string; file: string; dataUrl: string }[] = [];
  for (let i = 0; i < labelCards.value.length; i++) {
    const card = labelCards.value[i];
    const dataUrl = await renderThermal(card, size.w, size.h);
    out.push({
      id: card.id,
      name: card.cardName,
      file: `${String(i + 1).padStart(3, "0")}_${safeName(card.cardName)}.png`,
      dataUrl,
    });
  }
  thermalImages.value = out;
  thermalReady.value = true;
};

// Rebuild thermal images when entering thermal mode, changing size, or when
// the underlying labels (re)generate.
watch([mode, thermalSize, labelCards], () => {
  if (mode.value === "thermal" && ready.value) buildThermal();
});

const downloadAllThermal = async () => {
  if (!thermalImages.value.length || zipping.value) return;
  zipping.value = true;
  try {
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    for (const img of thermalImages.value) {
      const b64 = img.dataUrl.split(",")[1];
      if (b64) zip.file(img.file, b64, { base64: true });
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tcgo-labels-${thermalSize.value}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e: any) {
    alert(e?.message || "Couldn't build the ZIP.");
  } finally {
    zipping.value = false;
  }
};
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
