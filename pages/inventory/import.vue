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
      <h1 class="text-2xl font-bold text-ink dark:text-white mb-1">Import CSV</h1>
      <p class="text-sm text-gray-500 dark:text-zinc-400 mb-6">
        Upload your inventory spreadsheet — we'll match each row to the catalog and attach card images automatically.
      </p>

      <!-- Step 1: upload -->
      <div v-if="step === 'upload'" class="surface rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-6">
        <label class="block">
          <div class="border-2 border-dashed border-gray-300 dark:border-white/[0.12] rounded-xl py-10 text-center cursor-pointer hover:border-pokemon-blue transition-colors">
            <svg class="w-10 h-10 mx-auto text-gray-400 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <p class="text-sm font-semibold text-ink dark:text-white">Choose a CSV file</p>
            <p class="text-xs text-gray-400 dark:text-zinc-500 mt-1">Any column layout — you'll map them next</p>
          </div>
          <input type="file" accept=".csv,text/csv" class="hidden" @change="handleFile" />
        </label>
        <p v-if="parseError" class="mt-3 text-sm text-red-500">{{ parseError }}</p>
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
        <p class="text-sm font-semibold text-ink dark:text-white">Matching to catalog…</p>
        <p class="text-xs text-gray-500 dark:text-zinc-400 mt-1 tabular-nums">{{ progress }} / {{ parsedRows.length }}</p>
        <div class="w-full h-1.5 rounded-full bg-gray-100 dark:bg-white/[0.06] overflow-hidden mt-3 max-w-xs mx-auto">
          <div class="h-full bg-pokemon-red transition-all" :style="{ width: `${parsedRows.length ? (progress / parsedRows.length) * 100 : 0}%` }"/>
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
              <CardImage :src="row.match?.imageUrl" :alt="row.match?.name || row.rawName" />
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
          <button @click="step = 'map'" class="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 dark:border-white/[0.08] text-gray-700 dark:text-zinc-200">Back</button>
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
useHead({ title: "Inventory · Import | TCGo" });

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

type Step = "upload" | "map" | "reviewing" | "review";
const step = ref<Step>("upload");

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

const handleFile = async (e: Event) => {
  parseError.value = "";
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const { headers: h, rows } = parseCsv(text);
    if (!h.length || !rows.length) {
      parseError.value = "Couldn't find any rows in that file.";
      return;
    }
    headers.value = h;
    parsedRows.value = rows;
    autoMap();
    step.value = "map";
  } catch {
    parseError.value = "Couldn't read that file. Make sure it's a .csv.";
  }
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
  step.value = "reviewing";
  progress.value = 0;
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
        source: "csv" as const,
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
};
</script>
