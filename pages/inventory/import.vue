<template>
  <div class="max-w-3xl mx-auto">
    <div v-if="!user" class="text-center py-16">
      <p class="text-gray-500 dark:text-zinc-400 text-lg mb-4">Sign in to import inventory.</p>
      <button @click="signInWithGoogle" class="bg-gray-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-700 transition-colors">Sign in with Google</button>
    </div>

    <template v-else>
      <div class="flex items-center gap-2 mb-1">
        <NuxtLink to="/inventory/items" class="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-zinc-400 hover:text-ink dark:hover:text-white">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Items
        </NuxtLink>
      </div>
      <h1 class="text-2xl font-bold text-ink dark:text-white mb-1">Bulk add</h1>
      <p class="text-sm text-gray-500 dark:text-zinc-400 mb-6">
        Upload a file or paste rows — we'll match each card to the catalog and attach images automatically.
      </p>

      <!-- Step 1: choose a method -->
      <div v-if="step === 'upload'" class="space-y-4">
        <TabStrip v-model="uploadMethod" :tabs="methodTabs" />

        <!-- Method: file -->
        <div v-if="uploadMethod === 'file'" class="surface rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-6">
          <label class="block">
            <div class="border-2 border-dashed border-gray-300 dark:border-white/[0.12] rounded-xl py-10 text-center cursor-pointer hover:border-pokemon-blue transition-colors">
              <svg class="w-10 h-10 mx-auto text-gray-400 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <p class="text-sm font-semibold text-ink dark:text-white">Choose a file</p>
              <p class="text-xs text-gray-400 dark:text-zinc-500 mt-1">CSV, Excel (.xlsx / .xls) or .ods — any column layout, you'll map them next</p>
            </div>
            <input
              type="file"
              accept=".csv,.xlsx,.xls,.ods,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.oasis.opendocument.spreadsheet"
              class="hidden"
              @change="handleFile"
            />
          </label>
          <p v-if="parseError" class="mt-3 text-sm text-red-500">{{ parseError }}</p>

          <!-- Template helper -->
          <div class="mt-5 pt-4 border-t border-black/[0.06] dark:border-white/[0.08]">
            <div class="flex items-start justify-between gap-3 flex-wrap">
              <div class="min-w-0">
                <p class="text-sm font-semibold text-ink dark:text-white">Not sure what to include?</p>
                <p class="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                  Download our template — columns:
                  <span class="font-medium text-ink dark:text-zinc-200">Name</span> (required),
                  Set, Number, Condition, Quantity, Price.
                </p>
              </div>
              <button
                type="button"
                @click="downloadTemplate"
                class="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold border border-gray-200 dark:border-white/[0.10] text-gray-700 dark:text-zinc-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
              >
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download template
              </button>
            </div>
          </div>
        </div>

        <!-- Method: paste -->
        <div v-else-if="uploadMethod === 'paste'" class="surface rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-5 space-y-3">
          <div>
            <p class="text-sm font-semibold text-ink dark:text-white">Paste your rows</p>
            <p class="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
              One card per line. Separate columns with a <span class="font-semibold">pipe (|)</span>, tab, or comma in this order:
            </p>
          </div>
          <div class="rounded-lg bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] px-3 py-2 text-xs font-mono text-ink dark:text-zinc-200 overflow-x-auto">
            Name | Set Number | Set Name | Price | Qty
          </div>
          <p class="text-[11px] text-gray-400 dark:text-zinc-500">
            e.g. <span class="font-mono">Chansey IR | 209/198 | Scarlet &amp; Violet 151 | 240.67 | 2</span>
          </p>
          <textarea
            v-model="pasteText"
            rows="8"
            spellcheck="false"
            placeholder="Charizard ex | 125/197 | Obsidian Flames | 180.00 | 1&#10;Pikachu | 025/165 | Scarlet & Violet 151 | 12.50 | 2"
            class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-sm font-mono text-ink dark:text-white focus:border-pokemon-blue focus:outline-none resize-y"
          />
          <p v-if="parseError" class="text-sm text-red-500">{{ parseError }}</p>
          <div class="flex items-center justify-between gap-3">
            <p class="text-[11px] text-gray-400 dark:text-zinc-500">
              Tip: use <span class="font-semibold">|</span> or tab if a name or set has spaces.
            </p>
            <button
              type="button"
              @click="handlePaste"
              :disabled="!pasteText.trim()"
              class="shrink-0 px-4 py-2 rounded-lg text-sm font-semibold bg-pokemon-red text-white hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        </div>

        <!-- Method: scan photos -->
        <div v-else class="surface rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-5 space-y-3">
          <div>
            <p class="text-sm font-semibold text-ink dark:text-white">Scan card photos</p>
            <p class="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
              Upload photos of your cards (one card per photo). The AI identifies each card and matches it to the catalog —
              your photo is kept as the item's image.
            </p>
          </div>

          <label class="block">
            <div class="border-2 border-dashed border-gray-300 dark:border-white/[0.12] rounded-xl py-8 text-center cursor-pointer hover:border-pokemon-blue transition-colors">
              <svg class="w-9 h-9 mx-auto text-gray-400 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              <p class="text-sm font-semibold text-ink dark:text-white">Choose photos</p>
              <p class="text-xs text-gray-400 dark:text-zinc-500 mt-1">JPG / PNG · select multiple at once</p>
            </div>
            <input type="file" accept="image/*" multiple class="hidden" @change="handlePhotoSelect" />
          </label>

          <div v-if="photoFiles.length" class="grid grid-cols-4 sm:grid-cols-6 gap-2">
            <div v-for="(p, i) in photoFiles" :key="i" class="relative group aspect-[2.5/3.5]">
              <img :src="p.preview" class="w-full h-full object-cover rounded-lg border border-gray-200 dark:border-white/[0.08]" />
              <button
                type="button"
                @click="removePhoto(i)"
                class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-pokemon-red text-white text-[10px] flex items-center justify-center"
                aria-label="Remove photo"
              >✕</button>
            </div>
          </div>

          <p v-if="parseError" class="text-sm text-red-500">{{ parseError }}</p>
          <div class="flex items-center justify-between gap-3">
            <p class="text-[11px] text-gray-400 dark:text-zinc-500">
              Identification takes a few seconds per card.
            </p>
            <button
              type="button"
              @click="identifyPhotos"
              :disabled="!photoFiles.length"
              class="shrink-0 px-4 py-2 rounded-lg text-sm font-semibold bg-pokemon-red text-white hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              Identify {{ photoFiles.length }} card{{ photoFiles.length === 1 ? "" : "s" }}
            </button>
          </div>
        </div>
      </div>

      <!-- Step 2: map columns -->
      <div v-else-if="step === 'map'" class="space-y-4">
        <div class="surface rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-5">
          <p class="text-sm font-semibold text-ink dark:text-white mb-1">Map your columns</p>
          <p class="text-xs text-gray-500 dark:text-zinc-400 mb-4">
            {{ parsedRows.length }} rows found. We guessed the mapping — adjust if needed. Only <span class="font-semibold">Name</span> is required.
          </p>
          <div class="space-y-2.5">
            <div v-for="field in mapFields" :key="field.key" class="flex items-center gap-3">
              <label class="w-28 shrink-0 text-sm font-medium text-gray-700 dark:text-zinc-200">
                {{ field.label }}<span v-if="field.required" class="text-pokemon-red">*</span>
              </label>
              <select
                v-model="mapping[field.key]"
                class="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-sm text-ink dark:text-white"
              >
                <option :value="-1">— none —</option>
                <option v-for="(h, i) in headers" :key="i" :value="i">{{ h || `Column ${i + 1}` }}</option>
              </select>
            </div>
          </div>

          <!-- Default condition for rows with no condition column -->
          <div class="flex items-center gap-3 mt-4 pt-4 border-t border-black/[0.06] dark:border-white/[0.08]">
            <label class="w-28 shrink-0 text-sm font-medium text-gray-700 dark:text-zinc-200">Default condition</label>
            <select v-model="defaultCondition" class="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-sm text-ink dark:text-white">
              <option v-for="c in CONDITIONS" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>

          <!-- Preview first rows -->
          <div class="mt-4 overflow-x-auto">
            <table class="text-xs w-full">
              <thead>
                <tr class="text-left text-gray-400 dark:text-zinc-500">
                  <th v-for="(h, i) in headers" :key="i" class="px-2 py-1 font-semibold whitespace-nowrap">{{ h || `Col ${i+1}` }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, r) in parsedRows.slice(0, 3)" :key="r" class="text-gray-600 dark:text-zinc-300">
                  <td v-for="(h, i) in headers" :key="i" class="px-2 py-1 whitespace-nowrap truncate max-w-[140px]">{{ row[i] }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="flex gap-2">
          <button @click="resetUpload" class="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 dark:border-white/[0.08] text-gray-700 dark:text-zinc-200">Back</button>
          <button
            @click="reconcile"
            :disabled="mapping.name === -1"
            class="flex-1 px-4 py-2 rounded-lg text-sm font-semibold bg-pokemon-red text-white hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            Match {{ parsedRows.length }} rows to catalog
          </button>
        </div>
      </div>

      <!-- Reconciling progress -->
      <div v-else-if="step === 'reviewing'" class="surface rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-8 text-center">
        <div class="animate-spin rounded-full h-7 w-7 border-2 border-ink/10 border-t-pokemon-red mx-auto mb-4"/>
        <p class="text-sm font-semibold text-ink dark:text-white">
          {{ flow === "photos" ? "Identifying cards…" : "Matching to catalog…" }}
        </p>
        <p class="text-xs text-gray-500 dark:text-zinc-400 mt-1 tabular-nums">{{ progress }} / {{ reviewTotal }}</p>
        <div class="w-full h-1.5 rounded-full bg-gray-100 dark:bg-white/[0.06] overflow-hidden mt-3 max-w-xs mx-auto">
          <div class="h-full bg-pokemon-red transition-all" :style="{ width: `${reviewTotal ? (progress / reviewTotal) * 100 : 0}%` }"/>
        </div>
      </div>

      <!-- Step 3: review -->
      <div v-else-if="step === 'review'" class="space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="text-sm text-gray-600 dark:text-zinc-300">
            <span class="font-semibold text-emerald-600 dark:text-emerald-400">{{ matchedCount }} matched</span>
            <span v-if="unmatchedCount"> · <span class="font-semibold text-amber-600 dark:text-amber-400">{{ unmatchedCount }} unmatched</span></span>
            · {{ includedCount }} selected
          </p>
          <label class="text-xs text-gray-500 dark:text-zinc-400 inline-flex items-center gap-1.5">
            <input type="checkbox" v-model="hideUnmatched" class="rounded"/>
            Hide unmatched
          </label>
        </div>

        <div class="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          <div
            v-for="(row, i) in visibleRows"
            :key="i"
            class="surface rounded-xl border p-2.5 flex items-center gap-3"
            :class="row.match ? 'border-black/[0.06] dark:border-white/[0.08]' : 'border-amber-300/60 dark:border-amber-500/30'"
          >
            <input type="checkbox" v-model="row.include" class="shrink-0 rounded"/>
            <div class="w-9 h-12 shrink-0 rounded overflow-hidden">
              <CardImage :src="row.match?.imageUrl || row.photoPreview" :alt="row.match?.name || row.rawName" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-ink dark:text-white truncate">
                {{ row.match?.name || row.rawName }}
              </p>
              <p class="text-[11px] text-gray-500 dark:text-zinc-400 truncate">
                <template v-if="row.match">{{ [row.match.setName, row.match.number].filter(Boolean).join(" · ") }}</template>
                <span v-else class="text-amber-600 dark:text-amber-400">No catalog match — imported as “{{ row.rawName }}”</span>
              </p>
            </div>
            <div class="shrink-0 flex items-center gap-1.5">
              <div class="flex items-center gap-0.5">
                <span class="text-[10px] text-gray-400">RM</span>
                <input type="number" min="0" step="0.01" v-model.number="row.price" class="w-16 text-xs text-right px-1.5 py-1 rounded border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-ink dark:text-white tabular-nums"/>
              </div>
              <input type="number" min="1" step="1" v-model.number="row.quantity" title="Quantity" class="w-11 text-xs text-right px-1.5 py-1 rounded border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-ink dark:text-white tabular-nums"/>
            </div>
          </div>
        </div>

        <div class="flex gap-2">
          <button @click="step = flow === 'photos' ? 'upload' : 'map'" class="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 dark:border-white/[0.08] text-gray-700 dark:text-zinc-200">Back</button>
          <button
            @click="doImport"
            :disabled="importing || includedCount === 0"
            class="flex-1 px-4 py-2 rounded-lg text-sm font-semibold bg-pokemon-red text-white hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <span v-if="importing" class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"/>
            {{ importing ? "Importing…" : `Import ${includedCount} items` }}
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { CatalogMatch } from "~/composables/useCardCatalog";

definePageMeta({ layout: "inventory" });
useHead({ title: "Inventory · Bulk add | TCGo" });

const CONDITIONS = [
  "Near Mint (NM)",
  "Lightly Played (LP)",
  "Moderately Played (MP)",
  "Heavily Played (HP)",
  "Damaged (DMG)",
];

const router = useRouter();
const { user, signInWithGoogle } = useAuth();
const { matchRow } = useCardCatalog();
const { addMany } = useInventory();
const { uploadImage } = useStorage();

type Step = "upload" | "map" | "reviewing" | "review";
const step = ref<Step>("upload");

// Upload method: a file (CSV/Excel/ODS), pasted rows, or card photos.
const uploadMethod = ref<"file" | "paste" | "photos">("file");
const methodTabs = [
  { id: "file", label: "Upload file" },
  { id: "paste", label: "Paste rows" },
  { id: "photos", label: "Scan photos" },
];
const pasteText = ref("");

// Which pipeline produced the review rows — "rows" (file/paste, has a map
// step to go Back to) or "photos" (no map step; Back returns to upload).
const flow = ref<"rows" | "photos">("rows");
// Total for the progress bar (parsedRows for rows flow, photo count for photos).
const reviewTotal = ref(0);

// ── CSV parsing ───────────────────────────────────────────────────────
const headers = ref<string[]>([]);
const parsedRows = ref<string[][]>([]);
const parseError = ref("");

// Minimal RFC-4180-ish CSV parser (handles quoted fields, escaped quotes,
// CRLF). Good enough for seller spreadsheets without pulling a dependency.
const parseCsv = (text: string): { headers: string[]; rows: string[][] } => {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cur.push(field); field = "";
    } else if (ch === "\n") {
      cur.push(field); rows.push(cur); cur = []; field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); rows.push(cur); }
  const cleaned = rows.filter((r) => r.some((c) => c.trim() !== ""));
  const head = (cleaned.shift() ?? []).map((h) => h.trim());
  return { headers: head, rows: cleaned };
};

// Excel / OpenDocument and other spreadsheet formats go through SheetJS,
// which is lazy-loaded only when a non-CSV file is chosen so CSV imports stay
// lightweight. Returns the same { headers, rows } shape as the CSV parser.
const parseSpreadsheet = async (
  file: File,
): Promise<{ headers: string[]; rows: string[][] }> => {
  const mod: any = await import("xlsx");
  const XLSX = mod.default ?? mod;
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const aoa: any[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    blankrows: false,
    defval: "",
  });
  const cleaned = aoa.filter((r) => r.some((c) => String(c ?? "").trim() !== ""));
  const head = (cleaned.shift() ?? []).map((h) => String(h ?? "").trim());
  const rows = cleaned.map((r) => r.map((c) => String(c ?? "")));
  return { headers: head, rows };
};

// Pasted rows use a fixed column order (Name, Set Number, Set Name, Price,
// Qty), delimited by pipe / tab / comma (auto-detected). Routed through the
// same map → reconcile → review flow as file imports.
const DEFAULT_PASTE_HEADERS = ["Name", "Set Number", "Set Name", "Price", "Qty"];

const detectDelim = (line: string): "pipe" | "tab" | "comma" | "space" => {
  if (line.includes("|")) return "pipe";
  if (line.includes("\t")) return "tab";
  if (line.includes(",")) return "comma";
  return "space";
};
const splitByMode = (l: string, mode: string): string[] => {
  switch (mode) {
    case "pipe": return l.split("|");
    case "tab": return l.split("\t");
    case "comma": return l.split(",");
    default: return l.split(/\s+/);
  }
};
const parsePasted = (text: string): { headers: string[]; rows: string[][] } => {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return { headers: [], rows: [] };
  const mode = detectDelim(lines[0]);
  const rows = lines.map((l) => splitByMode(l, mode).map((s) => s.trim()));
  const maxCols = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const headers = Array.from(
    { length: maxCols },
    (_, i) => DEFAULT_PASTE_HEADERS[i] ?? `Column ${i + 1}`,
  );
  return { headers, rows };
};

const handlePaste = () => {
  parseError.value = "";
  const { headers: h, rows } = parsePasted(pasteText.value);
  if (!rows.length) {
    parseError.value = "Paste at least one row first.";
    return;
  }
  headers.value = h;
  parsedRows.value = rows;
  const max = h.length - 1;
  const clamp = (i: number) => (i <= max ? i : -1);
  mapping.value = {
    name: clamp(0),
    number: clamp(1),
    set: clamp(2),
    price: clamp(3),
    quantity: clamp(4),
    condition: -1,
  };
  step.value = "map";
};

// Downloadable starter template matching the inventory data structure, so
// sellers know exactly what to put. Two sample rows show the expected format.
const downloadTemplate = () => {
  const rows = [
    ["Name", "Set", "Number", "Condition", "Quantity", "Price"],
    ["Charizard ex", "Obsidian Flames", "125/197", "Near Mint (NM)", "1", "180.00"],
    ["Pikachu", "Scarlet & Violet 151", "025/165", "Lightly Played (LP)", "2", "12.50"],
  ];
  const esc = (c: string) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c);
  const csv = rows.map((r) => r.map(esc).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "tcgo-inventory-template.csv";
  a.click();
  URL.revokeObjectURL(url);
};

const handleFile = async (e: Event) => {
  parseError.value = "";
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const name = file.name.toLowerCase();
    const isCsv = name.endsWith(".csv") || file.type === "text/csv";
    const { headers: h, rows } = isCsv
      ? parseCsv(await file.text())
      : await parseSpreadsheet(file);
    if (!h.length || !rows.length) {
      parseError.value = "Couldn't find any rows in that file.";
      return;
    }
    headers.value = h;
    parsedRows.value = rows;
    autoMap();
    step.value = "map";
  } catch {
    parseError.value = "Couldn't read that file. Try CSV, Excel (.xlsx/.xls) or .ods.";
  }
};

// ── Photo scan (AI identify → TCGo DB match) ─────────────────────────
interface PhotoEntry {
  file: File;
  preview: string;
}
const photoFiles = ref<PhotoEntry[]>([]);

const handlePhotoSelect = (e: Event) => {
  parseError.value = "";
  const input = e.target as HTMLInputElement;
  for (const file of Array.from(input.files ?? [])) {
    if (!file.type.startsWith("image/")) continue;
    photoFiles.value.push({ file, preview: URL.createObjectURL(file) });
  }
  input.value = "";
};

const removePhoto = (i: number) => {
  const p = photoFiles.value[i];
  if (p) URL.revokeObjectURL(p.preview);
  photoFiles.value.splice(i, 1);
};

// Same downscale the listing scanner uses — keeps the Gemini payload small.
const MAX_DIM = 1600;
const resizeImage = (file: File): Promise<Blob> =>
  new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width <= MAX_DIM && height <= MAX_DIM) {
        resolve(file);
        return;
      }
      const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
      const cv = document.createElement("canvas");
      cv.width = width;
      cv.height = height;
      const ctx = cv.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, width, height);
      cv.toBlob((out) => resolve(out || file), "image/jpeg", 0.85);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(blob);
  });

// Each photo: Gemini identify (same /api/identify-card the listing scanner
// uses) → TCGo DB match by name+number (EN only; the catalog is EN-first).
// Failures still produce a row (photo attached, deselected) so the seller
// can decide rather than lose the card silently.
const identifyPhotos = async () => {
  if (!photoFiles.value.length) return;
  flow.value = "photos";
  step.value = "reviewing";
  progress.value = 0;
  reviewTotal.value = photoFiles.value.length;
  const entries = [...photoFiles.value];
  const out: ReviewRow[] = new Array(entries.length);

  let idx = 0;
  const CONCURRENCY = 2; // gentle on the Gemini endpoint (429s)
  const worker = async () => {
    while (idx < entries.length) {
      const myIdx = idx++;
      const entry = entries[myIdx];
      let name = "";
      let number = "";
      let language = "EN";
      try {
        const resized = await resizeImage(entry.file);
        const imageBase64 = await blobToBase64(resized);
        const res = await $fetch<{ name: string; number: string; language: string }>(
          "/api/identify-card",
          { method: "POST", body: { imageBase64, mimeType: "image/jpeg" } },
        );
        name = res.name || "";
        number = res.number || "";
        language = res.language || "EN";
      } catch {
        // identify failed — fall through with empty name
      }

      let match: CatalogMatch | null = null;
      // EN and JP both have catalog coverage (JP product names are English,
      // so the translated name + printed number match directly).
      if (name && (language === "EN" || language === "JP")) {
        try {
          match = await matchRow(name, number, null, language as "EN" | "JP");
        } catch {
          match = null;
        }
      }

      out[myIdx] = {
        rawName: name || "Unidentified card",
        number,
        setHint: "",
        condition: defaultCondition.value,
        quantity: 1,
        price: match?.price?.market || 0,
        match,
        include: !!name, // deselect identify-failures by default
        photoFile: entry.file,
        photoPreview: entry.preview,
      };
      progress.value++;
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  reviewRows.value = out.filter(Boolean);
  step.value = "review";
};

// ── Column mapping ────────────────────────────────────────────────────
type FieldKey = "name" | "set" | "number" | "condition" | "quantity" | "price";
const mapFields: { key: FieldKey; label: string; required?: boolean }[] = [
  { key: "name", label: "Name", required: true },
  { key: "set", label: "Set" },
  { key: "number", label: "Number" },
  { key: "condition", label: "Condition" },
  { key: "quantity", label: "Quantity" },
  { key: "price", label: "Price" },
];
const mapping = ref<Record<FieldKey, number>>({
  name: -1, set: -1, number: -1, condition: -1, quantity: -1, price: -1,
});
const defaultCondition = ref(CONDITIONS[0]);

const HINTS: Record<FieldKey, string[]> = {
  name: ["name", "product", "card", "title"],
  set: ["set", "edition", "expansion", "group", "series"],
  number: ["number", "no.", "collector", "card no", "num"],
  condition: ["condition", "cond", "grade"],
  quantity: ["quantity", "qty", "count", "amount", "stock"],
  price: ["price", "market", "value", "cost", "mkt", "rm", "myr"],
};
const autoMap = () => {
  const lower = headers.value.map((h) => h.toLowerCase());
  for (const field of mapFields) {
    const hints = HINTS[field.key];
    const idx = lower.findIndex((h) => hints.some((k) => h.includes(k)));
    mapping.value[field.key] = idx;
  }
};

// ── Reconciliation ────────────────────────────────────────────────────
interface ReviewRow {
  rawName: string;
  number: string;
  setHint: string;
  condition: string;
  quantity: number;
  price: number;
  match: CatalogMatch | null;
  include: boolean;
  // Photos flow only — the seller's own shot, uploaded to Cloudinary at
  // import time and kept as the item's primary image.
  photoFile?: File;
  photoPreview?: string;
}
const reviewRows = ref<ReviewRow[]>([]);
const progress = ref(0);

const cell = (row: string[], idx: number) => (idx >= 0 ? (row[idx] ?? "").trim() : "");
const toNumber = (s: string) => {
  const n = parseFloat((s || "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const reconcile = async () => {
  if (mapping.value.name === -1) return;
  flow.value = "rows";
  step.value = "reviewing";
  progress.value = 0;
  reviewTotal.value = parsedRows.value.length;
  const out: ReviewRow[] = new Array(parsedRows.value.length);

  let idx = 0;
  const CONCURRENCY = 6;
  const worker = async () => {
    while (idx < parsedRows.value.length) {
      const myIdx = idx++;
      const row = parsedRows.value[myIdx];
      const name = cell(row, mapping.value.name);
      const number = cell(row, mapping.value.number);
      const setHint = cell(row, mapping.value.set);
      const condRaw = cell(row, mapping.value.condition);
      const qty = mapping.value.quantity >= 0 ? Math.max(1, Math.round(toNumber(cell(row, mapping.value.quantity)))) || 1 : 1;
      const csvPrice = mapping.value.price >= 0 ? toNumber(cell(row, mapping.value.price)) : 0;

      let match: CatalogMatch | null = null;
      if (name) {
        try {
          match = await matchRow(name, number, setHint);
        } catch {
          match = null;
        }
      }
      out[myIdx] = {
        rawName: name,
        number,
        setHint,
        condition: condRaw || defaultCondition.value,
        quantity: qty,
        price: csvPrice || match?.price?.market || 0,
        match,
        include: true,
      };
      progress.value++;
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  reviewRows.value = out.filter((r) => r && r.rawName);
  step.value = "review";
};

// ── Review ────────────────────────────────────────────────────────────
const hideUnmatched = ref(false);
const visibleRows = computed(() =>
  hideUnmatched.value ? reviewRows.value.filter((r) => r.match) : reviewRows.value,
);
const matchedCount = computed(() => reviewRows.value.filter((r) => r.match).length);
const unmatchedCount = computed(() => reviewRows.value.filter((r) => !r.match).length);
const includedCount = computed(() => reviewRows.value.filter((r) => r.include).length);

// ── Import ────────────────────────────────────────────────────────────
const importing = ref(false);
const doImport = async () => {
  if (importing.value) return;
  const chosen = reviewRows.value.filter((r) => r.include);
  if (!chosen.length) return;
  importing.value = true;
  try {
    // Photo rows: upload the seller's shot to Cloudinary first so it lands
    // in photos[] (and becomes primaryImage). Concurrency-limited.
    const photoUrls = new Map<ReviewRow, string>();
    const photoRows = chosen.filter((r) => r.photoFile);
    let pIdx = 0;
    const uploadWorker = async () => {
      while (pIdx < photoRows.length) {
        const row = photoRows[pIdx++];
        try {
          photoUrls.set(row, await uploadImage(row.photoFile!));
        } catch {
          // Upload failed — import without the photo rather than blocking.
        }
      }
    };
    await Promise.all(Array.from({ length: 3 }, uploadWorker));

    await addMany(
      chosen.map((r) => ({
        productId: r.match?.productId ?? null,
        cardName: r.match?.name || r.rawName,
        setName: r.match?.setName || r.setHint || "",
        number: r.match?.number || r.number || "",
        rarity: r.match?.rarity || "",
        condition: r.condition,
        quantity: r.quantity,
        listPrice: r.price || 0,
        stockImageUrl: r.match?.imageUrl || "",
        photos: photoUrls.has(r) ? [photoUrls.get(r)!] : [],
        source: r.photoFile ? ("scan" as const) : ("csv" as const),
      })),
    );
    router.push("/inventory/items");
  } catch (e: any) {
    alert(e?.message || "Import failed. Please try again.");
    importing.value = false;
  }
};

const resetUpload = () => {
  step.value = "upload";
  headers.value = [];
  parsedRows.value = [];
  reviewRows.value = [];
  for (const p of photoFiles.value) URL.revokeObjectURL(p.preview);
  photoFiles.value = [];
};
</script>
