<template>
  <div class="min-h-screen bg-white text-black">
    <!-- Toolbar (hidden when printing) -->
    <div class="no-print sticky top-0 z-10 bg-white border-b border-gray-200 px-4 h-14 flex items-center justify-between gap-3">
      <NuxtLink to="/seller/items" class="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-black shrink-0">
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

      <div class="flex items-center gap-2 shrink-0">
        <span class="text-xs text-gray-500 tabular-nums hidden md:inline">{{ labelCards.length }} label{{ labelCards.length === 1 ? "" : "s" }}</span>
        <button
          v-if="mode === 'sheet'"
          @click="sheetFit = !sheetFit"
          class="px-2.5 py-2 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600"
        >{{ sheetFit ? "Actual size" : "Fit width" }}</button>
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
      <p class="text-sm">
        <template v-if="skippedCount">
          Nothing to print — {{ skippedCount }} selected
          {{ skippedCount === 1 ? "item has" : "items have" }} already sold.
        </template>
        <template v-else>No items to print.</template>
      </p>
      <NuxtLink to="/seller/items" class="text-pokemon-red hover:underline text-sm">Back to items</NuxtLink>
    </div>

    <p
      v-if="ready && labelCards.length && skippedCount"
      class="no-print text-center text-xs text-amber-600 pt-3"
    >
      {{ skippedCount }} sold {{ skippedCount === 1 ? "item was" : "items were" }} skipped.
    </p>

    <!-- A4 SHEET MODE -->
    <div v-else-if="mode === 'sheet'" class="sheet-scroll overflow-auto">
      <div
        class="print-sheet p-4 mx-auto"
        :style="sheetFit ? 'width:100%;max-width:210mm' : 'width:210mm'"
      >
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
  // On phones the A4 sheet is unreadable shrunk to fit — default to actual
  // size (scrollable). Desktop is wide enough, so keep fit-width there.
  if (import.meta.client && window.innerWidth < 1024) sheetFit.value = false;
});
watch(user, (u) => {
  if (u) listenMyInventory();
});

const mode = ref<"sheet" | "thermal">("sheet");
// On-screen sizing for the A4 preview: fit the device width by default, or
// show it at actual size (scrollable) for close inspection. Print is forced
// to full page width regardless (see print CSS).
const sheetFit = ref(true);

// Anything the seller still physically holds can be labelled. That includes
// `listed` items — being on the shop doesn't mean the card has left the
// drawer, and a listed card is exactly the one you want a price/QR label on.
// Only `sold` is genuinely gone.
const isLabelable = (i: InventoryItem) => i.status !== "sold";

// Narrowed further by the queue set from the Items page, if any.
const targetItems = computed<InventoryItem[]>(() => {
  let base = items.value.filter(isLabelable);
  if (labelQueue.value.length) {
    const set = new Set(labelQueue.value);
    base = base.filter((i) => set.has(i.id));
  }
  return base;
});

// The Items page lets you select any row, so a queue can contain sold items.
// They used to be dropped silently, which looked like the label feature was
// broken rather than the selection being ineligible.
const skippedCount = computed(() => {
  if (!labelQueue.value.length) return 0;
  const set = new Set(labelQueue.value);
  return items.value.filter((i) => set.has(i.id) && !isLabelable(i)).length;
});

interface LabelCard {
  id: string;
  cardName: string;
  sub: string;
  setName: string;
  number: string;
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
      setName: item.setName || "",
      number: item.number || "",
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
// Portrait labels (taller than wide) — applied vertically on the card to
// maximise the QR and give name/price the full width.
const THERMAL_SIZES = [
  { id: "30x40", label: "30 × 40 mm", w: 30, h: 40 },
  { id: "40x50", label: "40 × 50 mm", w: 40, h: 50 },
  { id: "30x50", label: "30 × 50 mm", w: 30, h: 50 },
];
const thermalSize = ref("30x40");
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

// Shrink a font until the text fits maxW (down to a floor).
const fitFont = (ctx: CanvasRenderingContext2D, text: string, maxW: number, startPx: number, weight = "bold"): number => {
  let px = startPx;
  ctx.font = `${weight} ${px}px sans-serif`;
  while (px > 9 && ctx.measureText(text).width > maxW) {
    px -= 1;
    ctx.font = `${weight} ${px}px sans-serif`;
  }
  return px;
};

// Strip TCGPlayer's " - 222/193" style suffix from product names — the
// number is shown on its own line, and the suffix wastes a whole name line
// on small labels.
const stripNumberSuffix = (name: string): string =>
  name.replace(/\s+-\s+\S*\d\S*$/, "").trim() || name;

// Condensed condition for labels: "Near Mint (NM)" → "NM".
const condShort = (condition: string): string => {
  const m = condition.match(/\(([^)]+)\)/);
  return m ? m[1] : condition;
};

// Portrait label, strict top-to-bottom flow so nothing can overlap:
// the text block (name / number·set / condition / price) is measured first,
// then the QR flexes to fill whatever height remains above it.
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
  ctx.textBaseline = "top";
  ctx.textAlign = "center";

  const pad = Math.round(Math.min(W, H) * 0.06);
  const innerW = W - pad * 2;
  const cx = Math.round(W / 2);
  const gap = Math.round(H * 0.012);

  // ── Measure the text block ──────────────────────────────────────────
  const name = stripNumberSuffix(card.cardName);
  const nameFont = Math.round(H * 0.07);
  ctx.font = `bold ${nameFont}px sans-serif`;
  const nameLines = wrapText(ctx, name, innerW, 2);
  const nameLineH = Math.round(nameFont * 1.15);

  // Number leads so end-truncation eats the set name, never the number.
  const infoStr = [card.number, card.setName].filter(Boolean).join(" · ");
  const infoFont = Math.round(H * 0.048);
  const condStr = card.condition ? condShort(card.condition) : "";
  const condFont = infoFont;

  const priceStr = `RM ${card.price}`;
  const priceFont = fitFont(ctx, priceStr, innerW, Math.round(H * 0.115));

  let textH = nameLines.length * nameLineH;
  if (infoStr) textH += gap + Math.round(infoFont * 1.15);
  if (condStr) textH += gap + Math.round(condFont * 1.15);
  textH += gap * 2 + Math.round(priceFont * 1.1);

  // ── QR flexes into the remaining height ─────────────────────────────
  const qrAvail = H - pad * 2 - textH - gap * 2;
  const qrSize = Math.max(48, Math.min(innerW, qrAvail));
  const qrX = Math.round((W - qrSize) / 2);
  // Center the QR within its available band.
  const qrY = pad + Math.max(0, Math.round((qrAvail - qrSize) / 2));
  if (card.qr) {
    const img = await loadImage(card.qr);
    ctx.drawImage(img, qrX, qrY, qrSize, qrSize);
  }

  // ── Text flow, top-down from below the QR band ──────────────────────
  let y = pad + Math.max(qrAvail, qrSize) + gap * 2;

  ctx.fillStyle = "#000";
  ctx.font = `bold ${nameFont}px sans-serif`;
  for (const ln of nameLines) {
    ctx.fillText(ln, cx, y);
    y += nameLineH;
  }

  if (infoStr) {
    y += gap;
    ctx.font = `${infoFont}px sans-serif`;
    ctx.fillStyle = "#555";
    ctx.fillText(fitText(ctx, infoStr, innerW), cx, y);
    y += Math.round(infoFont * 1.15);
  }

  if (condStr) {
    y += gap;
    ctx.font = `${condFont}px sans-serif`;
    ctx.fillStyle = "#777";
    ctx.fillText(fitText(ctx, condStr, innerW), cx, y);
    y += Math.round(condFont * 1.15);
  }

  y += gap * 2;
  ctx.font = `bold ${priceFont}px sans-serif`;
  ctx.fillStyle = "#000";
  ctx.fillText(priceStr, cx, y);

  ctx.textAlign = "left";
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
  .sheet-scroll {
    overflow: visible !important;
  }
  .print-sheet {
    padding: 0 !important;
    width: 100% !important;
    max-width: none !important;
  }
  .label {
    break-inside: avoid;
  }
}
</style>
