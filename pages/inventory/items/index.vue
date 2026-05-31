<template>
  <div class="max-w-4xl mx-auto">
    <div v-if="!user" class="text-center py-16">
      <p class="text-gray-500 dark:text-zinc-400 text-lg mb-4">Sign in to manage your inventory.</p>
      <button @click="signInWithGoogle" class="bg-gray-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-700 transition-colors">
        Sign in with Google
      </button>
    </div>

    <template v-else>
      <!-- Header + summary -->
      <div class="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 class="text-2xl font-bold text-ink dark:text-white">Items</h1>
          <p class="text-sm text-gray-500 dark:text-zinc-400 mt-1">
            <span class="font-semibold text-ink dark:text-white tabular-nums">{{ totalUnits }}</span> units ·
            <span class="font-semibold text-ink dark:text-white tabular-nums">{{ count }}</span> entries ·
            est. value <span class="font-semibold text-pokemon-red tabular-nums">{{ formatMyr(totalValue) }} MYR</span>
          </p>
        </div>
        <div class="flex items-center gap-2">
          <NuxtLink
            to="/inventory/import"
            class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold border border-gray-200 dark:border-white/[0.10] text-gray-700 dark:text-zinc-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Import CSV
          </NuxtLink>
          <button
            @click="addOpen = !addOpen"
            class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold bg-pokemon-red text-white hover:bg-red-700 transition-colors"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
            Add card
          </button>
        </div>
      </div>

      <!-- Manual add via catalog search -->
      <div v-if="addOpen" class="surface rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-4 mb-6">
        <form @submit.prevent="runSearch" class="flex gap-2">
          <input
            v-model="searchInput"
            type="search"
            enterkeyhint="search"
            placeholder='Search to add — e.g. "charizard 151"'
            class="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-sm text-ink dark:text-white focus:border-pokemon-blue focus:outline-none"
            @keydown.enter.prevent="runSearch"
          />
          <button type="submit" class="px-4 py-2 rounded-lg text-sm font-semibold bg-ink text-white dark:bg-white dark:text-ink">Search</button>
        </form>
        <div v-if="searchLoading" class="flex justify-center py-5">
          <div class="animate-spin rounded-full h-5 w-5 border-2 border-ink/10 border-t-pokemon-red"/>
        </div>
        <div v-else-if="searchResults.length" class="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            v-for="card in searchResults"
            :key="card.productId"
            type="button"
            @click="quickAdd(card)"
            class="text-left surface rounded-xl overflow-hidden border border-black/[0.06] dark:border-white/[0.08] hover:border-pokemon-blue transition-colors"
          >
            <div class="aspect-[2.5/3.5]"><CardImage :src="card.imageUrl" :alt="card.name" /></div>
            <div class="p-2">
              <p class="text-[11px] font-semibold truncate text-ink dark:text-white">{{ card.name }}</p>
              <p class="text-[10px] text-gray-500 dark:text-zinc-400 truncate">{{ card.setName }}</p>
              <p class="text-[11px] font-bold text-pokemon-red mt-0.5">+ Add</p>
            </div>
          </button>
        </div>
      </div>

      <!-- Inventory list -->
      <div v-if="loading" class="flex justify-center py-16">
        <div class="animate-spin rounded-full h-6 w-6 border-2 border-ink/10 border-t-pokemon-red"/>
      </div>

      <div v-else-if="count === 0" class="surface rounded-2xl py-16 text-center">
        <p class="text-lg font-semibold text-ink dark:text-white">No inventory yet</p>
        <p class="mt-1 text-sm text-gray-500 dark:text-zinc-400">
          Import a CSV or add cards to start tracking your stock.
        </p>
        <div class="mt-5 flex items-center justify-center gap-2">
          <NuxtLink to="/inventory/import" class="px-4 py-2 rounded-lg text-sm font-semibold bg-pokemon-red text-white hover:bg-red-700 transition-colors">Import CSV</NuxtLink>
          <button @click="addOpen = true" class="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 dark:border-white/[0.10] text-gray-700 dark:text-zinc-200">Add manually</button>
        </div>
      </div>

      <div v-else class="space-y-2">
        <div
          v-for="item in items"
          :key="item.id"
          class="surface rounded-xl border border-black/[0.06] dark:border-white/[0.08] p-3 flex items-center gap-3"
        >
          <div class="w-12 h-16 shrink-0 rounded-lg overflow-hidden">
            <CardImage :src="item.primaryImage" :alt="item.cardName" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-ink dark:text-white truncate">{{ item.cardName }}</p>
            <p class="text-xs text-gray-500 dark:text-zinc-400 truncate">
              {{ [item.setName, item.number].filter(Boolean).join(" · ") }}
            </p>
            <div class="flex items-center gap-2 mt-1.5 flex-wrap">
              <select
                :value="item.condition"
                @change="updateItem(item.id, { condition: ($event.target as HTMLSelectElement).value })"
                class="text-xs px-2 py-1 rounded-md border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-ink dark:text-white"
              >
                <option value="">Condition…</option>
                <option v-for="c in CONDITIONS" :key="c" :value="c">{{ c }}</option>
              </select>
              <span
                v-if="item.status !== 'in_stock'"
                class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                :class="item.status === 'sold' ? 'bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-zinc-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'"
              >
                {{ item.status === "sold" ? "Sold" : "Listed" }}
              </span>
            </div>
          </div>
          <div class="shrink-0 flex flex-col items-end gap-1.5">
            <div class="flex items-center gap-1">
              <span class="text-[10px] text-gray-400">RM</span>
              <input
                type="number" min="0" step="0.01"
                :value="item.listPrice"
                @change="updateItem(item.id, { listPrice: Number(($event.target as HTMLInputElement).value) })"
                class="w-20 text-sm text-right px-2 py-1 rounded-md border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-ink dark:text-white tabular-nums"
              />
            </div>
            <div class="flex items-center gap-1">
              <span class="text-[10px] text-gray-400">Qty</span>
              <input
                type="number" min="1" step="1"
                :value="item.quantity"
                @change="updateItem(item.id, { quantity: Math.max(1, Number(($event.target as HTMLInputElement).value)) })"
                class="w-14 text-sm text-right px-2 py-1 rounded-md border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-ink dark:text-white tabular-nums"
              />
            </div>
            <div class="flex items-center gap-2">
              <template v-if="item.status === 'in_stock'">
                <button @click="openListDialog(item)" class="text-[11px] font-semibold text-pokemon-red hover:underline">List</button>
                <span class="text-gray-300 dark:text-zinc-700">·</span>
                <button @click="handleMarkSold(item.id)" class="text-[11px] text-gray-500 dark:text-zinc-400 hover:text-ink dark:hover:text-white">Sold</button>
              </template>
              <template v-else-if="item.status === 'listed'">
                <NuxtLink v-if="item.listingId" :to="`/cards/${item.listingId}`" class="text-[11px] text-gray-500 dark:text-zinc-400 hover:text-ink dark:hover:text-white">View</NuxtLink>
                <span class="text-gray-300 dark:text-zinc-700">·</span>
                <button @click="handleUnlist(item.id)" class="text-[11px] text-amber-600 dark:text-amber-400 hover:underline">Unlist</button>
              </template>
              <button @click="handleRemove(item.id)" class="text-[11px] text-red-500 hover:text-red-700">Remove</button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- List-for-sale dialog -->
    <div
      v-if="listing"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      @click.self="listing = null"
    >
      <div class="surface rounded-2xl w-full max-w-sm p-5 border border-black/[0.06] dark:border-white/[0.08]">
        <h3 class="text-base font-bold text-ink dark:text-white mb-1">List for sale</h3>
        <p class="text-xs text-gray-500 dark:text-zinc-400 mb-4 truncate">{{ listing.cardName }}</p>
        <div class="space-y-3">
          <div>
            <label class="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">Price (RM)</label>
            <input v-model.number="listForm.price" type="number" min="0.01" step="0.01" class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-sm text-ink dark:text-white"/>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">Condition</label>
            <select v-model="listForm.condition" class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-sm text-ink dark:text-white">
              <option value="">Condition…</option>
              <option v-for="c in CONDITIONS" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">Ship WM (RM)</label>
              <input v-model.number="listForm.shippingWM" type="number" min="0" step="0.01" class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-sm text-ink dark:text-white"/>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">Ship EM (RM)</label>
              <input v-model.number="listForm.shippingEM" type="number" min="0" step="0.01" class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-sm text-ink dark:text-white"/>
            </div>
          </div>
        </div>
        <p class="text-[11px] text-gray-400 dark:text-zinc-500 mt-3">
          Lists with the catalog image. Add a real photo from the listing later for graded/played cards.
        </p>
        <div class="flex gap-2 mt-4">
          <button @click="listing = null" class="flex-1 py-2 rounded-lg text-sm font-semibold border border-gray-200 dark:border-white/[0.08] text-gray-700 dark:text-zinc-200">Cancel</button>
          <button
            @click="confirmList"
            :disabled="listingBusy || !listForm.price"
            class="flex-1 py-2 rounded-lg text-sm font-semibold bg-pokemon-red text-white hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            <span v-if="listingBusy" class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"/>
            List it
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CatalogMatch } from "~/composables/useCardCatalog";
import type { InventoryItem } from "~/composables/useInventory";

definePageMeta({ layout: "inventory" });
useHead({ title: "Inventory · Items | TCGo" });

const CONDITIONS = [
  "Near Mint (NM)",
  "Lightly Played (LP)",
  "Moderately Played (MP)",
  "Heavily Played (HP)",
  "Damaged (DMG)",
];

const { user, signInWithGoogle } = useAuth();
const { profile } = useMyProfile();
const {
  items,
  loading,
  count,
  totalUnits,
  totalValue,
  listenMyInventory,
  addItem,
  updateItem,
  removeItem,
  listItem,
  unlistItem,
  markItemSold,
} = useInventory();
const { searchCatalog } = useCardCatalog();

onMounted(() => {
  if (user.value) listenMyInventory();
});
watch(user, (u) => {
  if (u) listenMyInventory();
});

// ── Manual add via catalog search ─────────────────────────────────────
const addOpen = ref(false);
const searchInput = ref("");
const searchResults = ref<CatalogMatch[]>([]);
const searchLoading = ref(false);

const runSearch = async () => {
  const q = searchInput.value.trim();
  if (q.length < 2) return;
  searchLoading.value = true;
  const { results } = await searchCatalog(q, { limit: 8, language: "EN" });
  searchResults.value = results;
  searchLoading.value = false;
};

const quickAdd = async (card: CatalogMatch) => {
  await addItem({
    productId: card.productId,
    cardName: card.name,
    setName: card.setName,
    number: card.number ?? "",
    rarity: card.rarity ?? "",
    listPrice: card.price?.market ?? 0,
    stockImageUrl: card.imageUrl ?? "",
    source: "manual",
  });
};

const handleRemove = async (id: string) => {
  if (!confirm("Remove this item from inventory?")) return;
  await removeItem(id);
};

const handleMarkSold = async (id: string) => {
  if (!confirm("Mark this item as sold?")) return;
  await markItemSold(id);
};

const handleUnlist = async (id: string) => {
  if (!confirm("Remove this listing from the marketplace? The item stays in your inventory.")) return;
  await unlistItem(id);
};

// ── List-for-sale dialog ──────────────────────────────────────────────
const listing = ref<InventoryItem | null>(null);
const listingBusy = ref(false);
const listForm = ref({
  price: 0,
  condition: "",
  shippingWM: 0,
  shippingEM: 0,
});

const openListDialog = (item: InventoryItem) => {
  listing.value = item;
  listForm.value = {
    price: item.listPrice || 0,
    condition: item.condition || CONDITIONS[0],
    shippingWM: profile.value?.shippingWM ?? 8,
    shippingEM: profile.value?.shippingEM ?? 12,
  };
};

const confirmList = async () => {
  if (!listing.value || !user.value || listingBusy.value) return;
  if (!profile.value?.phone && !profile.value?.whatsappNumber) {
    alert("Add your contact number in your profile before listing.");
    return;
  }
  listingBusy.value = true;
  try {
    await listItem(listing.value.id, {
      sellerName: profile.value?.customName || user.value.displayName || "Anonymous",
      sellerUid: user.value.uid,
      price: listForm.value.price,
      condition: listForm.value.condition,
      shippingWM: listForm.value.shippingWM,
      shippingEM: listForm.value.shippingEM,
    });
    listing.value = null;
  } catch (e: any) {
    alert(e?.message || "Could not list this item.");
  } finally {
    listingBusy.value = false;
  }
};

const formatMyr = (n: number) =>
  n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
</script>
