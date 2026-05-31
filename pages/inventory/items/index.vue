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
        <div class="flex items-center gap-2 flex-wrap">
          <button
            v-if="count > 0"
            @click="printAll"
            title="Print QR labels for the current view"
            class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold border border-gray-200 dark:border-white/[0.10] text-gray-700 dark:text-zinc-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Labels
          </button>
          <NuxtLink
            to="/inventory/import"
            class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold border border-gray-200 dark:border-white/[0.10] text-gray-700 dark:text-zinc-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Bulk add
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
          Bulk add from a file or pasted rows, or add cards to start tracking your stock.
        </p>
        <div class="mt-5 flex items-center justify-center gap-2">
          <NuxtLink to="/inventory/import" class="px-4 py-2 rounded-lg text-sm font-semibold bg-pokemon-red text-white hover:bg-red-700 transition-colors">Bulk add</NuxtLink>
          <button @click="addOpen = true" class="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 dark:border-white/[0.10] text-gray-700 dark:text-zinc-200">Add manually</button>
        </div>
      </div>

      <template v-else>
        <!-- Status filter + count + select all -->
        <div class="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <TabStrip v-model="statusFilter" :tabs="filterTabs" />
          <div class="flex items-center gap-3">
            <button
              @click="toggleSelectAllFiltered"
              class="text-xs font-semibold text-pokemon-red hover:underline"
            >
              {{ allFilteredSelected ? "Clear selection" : `Select all ${filteredItems.length}` }}
            </button>
            <p class="text-xs text-gray-400 dark:text-zinc-500">
              {{ filteredItems.length }} {{ filteredItems.length === 1 ? "item" : "items" }}
            </p>
          </div>
        </div>

        <!-- Bulk action bar -->
        <div
          v-if="selected.size"
          class="flex items-center justify-between gap-2 mb-3 px-3 py-2 rounded-xl border border-pokemon-red/30 bg-pokemon-red/[0.06] flex-wrap"
        >
          <div class="flex items-center gap-2">
            <span class="text-sm font-semibold text-ink dark:text-white">{{ selected.size }} selected</span>
            <button
              v-if="selected.size < filteredItems.length"
              @click="selectAllFiltered"
              class="text-xs font-semibold text-pokemon-red hover:underline"
            >
              Select all {{ filteredItems.length }}
            </button>
          </div>
          <div class="flex items-center gap-1.5">
            <button @click="printSelected" class="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 dark:border-white/[0.10] text-gray-700 dark:text-zinc-200">Labels</button>
            <button @click="bulkList" :disabled="bulkBusy" class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-pokemon-red text-white hover:bg-red-700 transition-colors disabled:opacity-50">List</button>
            <button @click="bulkMarkSold" :disabled="bulkBusy" class="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 dark:border-white/[0.10] text-gray-700 dark:text-zinc-200 disabled:opacity-50">Mark sold</button>
            <button @click="bulkRemove" :disabled="bulkBusy" class="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 dark:border-white/[0.10] text-red-600 disabled:opacity-50">Remove</button>
            <button @click="clearSelection" class="px-2 py-1.5 rounded-lg text-xs text-gray-500 dark:text-zinc-400 hover:text-ink dark:hover:text-white">Clear</button>
          </div>
        </div>

        <div class="surface rounded-2xl border border-black/[0.06] dark:border-white/[0.08]">
          <table class="w-full text-sm table-fixed">
            <thead class="text-[11px] uppercase tracking-wide text-gray-400 dark:text-zinc-500 border-b border-black/[0.06] dark:border-white/[0.08]">
              <tr>
                <th class="px-3 py-2 w-9">
                  <input type="checkbox" :checked="allPageSelected" @change="toggleSelectAllPage" class="rounded align-middle" aria-label="Select all on page" />
                </th>
                <th class="px-1 py-2 w-12"></th>
                <th class="text-left font-semibold px-2 py-2">Card</th>
                <th class="text-right font-semibold px-1.5 py-2 w-20">Price</th>
                <th class="text-right font-semibold px-1.5 py-2 w-12">Qty</th>
                <th class="text-left font-semibold px-2 py-2 w-20 hidden sm:table-cell">Status</th>
                <th class="px-2 py-2 w-24"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-black/[0.05] dark:divide-white/[0.06]">
              <tr v-for="item in pagedItems" :key="item.id" :class="isSelected(item.id) ? 'bg-pokemon-red/[0.03]' : ''">
                <!-- Select -->
                <td class="px-3 py-2 align-top">
                  <input type="checkbox" :checked="isSelected(item.id)" @change="toggleSelect(item.id)" class="rounded mt-1" :aria-label="`Select ${item.cardName}`" />
                </td>
                <!-- Thumbnail — click to add/replace photo -->
                <td class="px-1 py-2 align-top">
                  <button
                    type="button"
                    @click="openPhotoPicker(item)"
                    class="relative block w-10 h-14 rounded overflow-hidden group/photo bg-gray-100 dark:bg-white/[0.04] border border-black/[0.04] dark:border-white/[0.06]"
                    :title="item.primaryImage ? 'Replace photo' : 'Add a photo'"
                  >
                    <template v-if="item.primaryImage">
                      <CardImage :src="item.primaryImage" :alt="item.cardName" />
                      <span class="absolute inset-0 flex items-center justify-center bg-black/0 group-hover/photo:bg-black/40 opacity-0 group-hover/photo:opacity-100 transition-all">
                        <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                      </span>
                    </template>
                    <span v-else class="absolute inset-0 flex flex-col items-center justify-center gap-0.5 text-pokemon-blue">
                      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                      <span class="text-[8px] font-bold leading-none">Photo</span>
                    </span>
                    <span v-if="uploadingPhotoId === item.id" class="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"/>
                    </span>
                  </button>
                </td>
                <!-- Card -->
                <td class="px-2 py-2 align-top">
                  <p class="font-medium text-ink dark:text-white leading-snug line-clamp-2 break-words" :title="item.cardName">{{ item.cardName }}</p>
                  <p class="text-[11px] text-gray-500 dark:text-zinc-400 truncate">
                    {{ [item.setName, item.number].filter(Boolean).join(" · ") }}
                  </p>
                  <select
                    :value="item.condition"
                    @change="updateItem(item.id, { condition: ($event.target as HTMLSelectElement).value })"
                    class="mt-1 max-w-full text-[11px] px-1.5 py-0.5 rounded border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-ink dark:text-white"
                  >
                    <option value="">Condition…</option>
                    <option v-for="c in CONDITIONS" :key="c" :value="c">{{ c }}</option>
                  </select>
                </td>
                <!-- Price -->
                <td class="px-1.5 py-2 text-right align-top">
                  <input
                    type="number" min="0" step="0.01"
                    :value="item.listPrice"
                    @change="updateItem(item.id, { listPrice: Number(($event.target as HTMLInputElement).value) })"
                    class="w-full text-sm text-right px-1.5 py-1 rounded-md border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-ink dark:text-white tabular-nums"
                  />
                </td>
                <!-- Qty -->
                <td class="px-1.5 py-2 text-right align-top">
                  <input
                    type="number" min="1" step="1"
                    :value="item.quantity"
                    @change="updateItem(item.id, { quantity: Math.max(1, Number(($event.target as HTMLInputElement).value)) })"
                    class="w-full text-sm text-right px-1.5 py-1 rounded-md border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-ink dark:text-white tabular-nums"
                  />
                </td>
                <!-- Status -->
                <td class="px-2 py-2 align-top hidden sm:table-cell">
                  <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap" :class="statusClass(item.status)">
                    {{ statusLabel(item.status) }}
                  </span>
                </td>
                <!-- Actions (icon buttons) -->
                <td class="px-2 py-2 align-top">
                  <div class="flex items-center justify-end gap-0.5">
                    <template v-if="item.status === 'in_stock'">
                      <button @click="openListDialog(item)" title="List for sale" class="inline-flex items-center justify-center w-8 h-8 rounded-lg text-pokemon-red hover:bg-pokemon-red/10 transition-colors">
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3H4a1 1 0 0 0-1 1v5.59A2 2 0 0 0 3.83 11l9.58 9.59a2 2 0 0 0 2.83 0l4.35-4.35a2 2 0 0 0 0-2.83z"/><circle cx="7" cy="7" r="1.4" fill="currentColor" stroke="none"/></svg>
                      </button>
                      <button @click="handleMarkSold(item.id)" title="Mark sold" class="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-500 dark:text-zinc-400 hover:bg-black/[0.05] dark:hover:bg-white/[0.08] hover:text-ink dark:hover:text-white transition-colors">
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      </button>
                    </template>
                    <template v-else-if="item.status === 'listed'">
                      <NuxtLink v-if="item.listingId" :to="`/cards/${item.listingId}`" title="View listing" class="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-500 dark:text-zinc-400 hover:bg-black/[0.05] dark:hover:bg-white/[0.08] hover:text-ink dark:hover:text-white transition-colors">
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
                      </NuxtLink>
                      <button @click="handleUnlist(item.id)" title="Unlist (back to stock)" class="inline-flex items-center justify-center w-8 h-8 rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-colors">
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/></svg>
                      </button>
                    </template>
                    <button @click="handleRemove(item.id)" title="Remove from inventory" class="inline-flex items-center justify-center w-8 h-8 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors">
                      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div v-if="totalPages > 1" class="flex items-center justify-between mt-3">
          <p class="text-xs text-gray-400 dark:text-zinc-500 tabular-nums">{{ rangeStart }}–{{ rangeEnd }} of {{ filteredItems.length }}</p>
          <div class="flex items-center gap-1">
            <button
              @click="page = Math.max(0, page - 1)"
              :disabled="page === 0"
              class="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 dark:border-white/[0.08] text-gray-700 dark:text-zinc-200 disabled:opacity-40"
            >Prev</button>
            <span class="text-xs px-2 tabular-nums text-gray-500 dark:text-zinc-400">{{ page + 1 }} / {{ totalPages }}</span>
            <button
              @click="page = Math.min(totalPages - 1, page + 1)"
              :disabled="page >= totalPages - 1"
              class="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 dark:border-white/[0.08] text-gray-700 dark:text-zinc-200 disabled:opacity-40"
            >Next</button>
          </div>
        </div>
      </template>

      <!-- Hidden file input for inline photo upload -->
      <input ref="photoInput" type="file" accept="image/*" class="hidden" @change="onPhotoSelected" />
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
const { uploadImage } = useStorage();
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
  setLabelQueue,
} = useInventory();
const { searchCatalog } = useCardCatalog();
const router = useRouter();

// ── Label printing entry points ───────────────────────────────────────
const printSelected = () => {
  if (!selected.value.size) return;
  setLabelQueue([...selected.value]);
  router.push("/inventory/labels");
};
const printAll = () => {
  setLabelQueue(filteredItems.value.map((i) => i.id));
  router.push("/inventory/labels");
};

onMounted(() => {
  if (user.value) listenMyInventory();
});
watch(user, (u) => {
  if (u) listenMyInventory();
});

// ── Filter + pagination ───────────────────────────────────────────────
const PAGE_SIZE = 20;
const statusFilter = ref<string>("all");
const page = ref(0);

const filterTabs = computed(() => [
  { id: "all", label: "All", count: items.value.length },
  { id: "in_stock", label: "In stock", count: items.value.filter((i) => i.status === "in_stock").length },
  { id: "listed", label: "Listed", count: items.value.filter((i) => i.status === "listed").length },
  { id: "sold", label: "Sold", count: items.value.filter((i) => i.status === "sold").length },
]);

const filteredItems = computed(() =>
  statusFilter.value === "all"
    ? items.value
    : items.value.filter((i) => i.status === statusFilter.value),
);
const totalPages = computed(() => Math.max(1, Math.ceil(filteredItems.value.length / PAGE_SIZE)));
const pagedItems = computed(() =>
  filteredItems.value.slice(page.value * PAGE_SIZE, page.value * PAGE_SIZE + PAGE_SIZE),
);
const rangeStart = computed(() => (filteredItems.value.length === 0 ? 0 : page.value * PAGE_SIZE + 1));
const rangeEnd = computed(() => Math.min(filteredItems.value.length, (page.value + 1) * PAGE_SIZE));

watch(statusFilter, () => {
  page.value = 0;
  clearSelection();
});
// Clamp page if the list shrinks (e.g. items sold/removed/filtered).
watch(totalPages, (tp) => {
  if (page.value > tp - 1) page.value = Math.max(0, tp - 1);
});

// ── Selection + bulk actions ──────────────────────────────────────────
const selected = ref<Set<string>>(new Set());
const isSelected = (id: string) => selected.value.has(id);
const toggleSelect = (id: string) => {
  const s = new Set(selected.value);
  s.has(id) ? s.delete(id) : s.add(id);
  selected.value = s;
};
const pageIds = computed(() => pagedItems.value.map((i) => i.id));
const allPageSelected = computed(
  () => pageIds.value.length > 0 && pageIds.value.every((id) => selected.value.has(id)),
);
const toggleSelectAllPage = () => {
  const s = new Set(selected.value);
  if (allPageSelected.value) pageIds.value.forEach((id) => s.delete(id));
  else pageIds.value.forEach((id) => s.add(id));
  selected.value = s;
};
const clearSelection = () => (selected.value = new Set());
const selectedItems = computed(() => items.value.filter((i) => selected.value.has(i.id)));

// Select across all pages of the current filter (not just the visible page).
const allFilteredSelected = computed(
  () =>
    filteredItems.value.length > 0 &&
    filteredItems.value.every((i) => selected.value.has(i.id)),
);
const selectAllFiltered = () => {
  selected.value = new Set(filteredItems.value.map((i) => i.id));
};
const toggleSelectAllFiltered = () => {
  if (allFilteredSelected.value) clearSelection();
  else selectAllFiltered();
};

const bulkBusy = ref(false);

const bulkRemove = async () => {
  if (!selected.value.size || bulkBusy.value) return;
  if (!confirm(`Remove ${selected.value.size} items from inventory?`)) return;
  bulkBusy.value = true;
  try {
    await Promise.all([...selected.value].map((id) => removeItem(id)));
    clearSelection();
  } finally {
    bulkBusy.value = false;
  }
};

const bulkMarkSold = async () => {
  if (!selected.value.size || bulkBusy.value) return;
  if (!confirm(`Mark ${selected.value.size} items as sold?`)) return;
  bulkBusy.value = true;
  try {
    await Promise.all(selectedItems.value.map((i) => markItemSold(i.id)));
    clearSelection();
  } finally {
    bulkBusy.value = false;
  }
};

const bulkList = async () => {
  if (bulkBusy.value) return;
  const targets = selectedItems.value.filter((i) => i.status === "in_stock");
  const priced = targets.filter((i) => i.listPrice > 0);
  if (!priced.length) {
    alert("Selected items need a price (> 0) before they can be listed.");
    return;
  }
  if (!profile.value?.phone && !profile.value?.whatsappNumber) {
    alert("Add your contact number in your profile before listing.");
    return;
  }
  const skipped = targets.length - priced.length;
  let msg = `List ${priced.length} item${priced.length === 1 ? "" : "s"} for sale at their set prices?`;
  if (skipped) msg += `\n${skipped} skipped (no price set).`;
  if (!confirm(msg)) return;
  bulkBusy.value = true;
  try {
    for (const i of priced) {
      await listItem(i.id, {
        sellerName: profile.value?.customName || user.value!.displayName || "Anonymous",
        sellerUid: user.value!.uid,
        price: i.listPrice,
        condition: i.condition || CONDITIONS[0],
        shippingWM: profile.value?.shippingWM ?? 8,
        shippingEM: profile.value?.shippingEM ?? 12,
      });
    }
    clearSelection();
  } catch (e: any) {
    alert(e?.message || "Bulk list failed.");
  } finally {
    bulkBusy.value = false;
  }
};

const statusLabel = (s: string) =>
  s === "in_stock" ? "In stock" : s === "listed" ? "Listed" : "Sold";
const statusClass = (s: string) =>
  s === "listed"
    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
    : s === "sold"
      ? "bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-zinc-400"
      : "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300";

// ── Inline photo upload ───────────────────────────────────────────────
const photoInput = ref<HTMLInputElement | null>(null);
const photoTargetId = ref<string | null>(null);
const uploadingPhotoId = ref<string | null>(null);

const openPhotoPicker = (item: { id: string }) => {
  photoTargetId.value = item.id;
  photoInput.value?.click();
};

const onPhotoSelected = async (e: Event) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  const id = photoTargetId.value;
  input.value = "";
  if (!file || !id) return;
  uploadingPhotoId.value = id;
  try {
    const url = await uploadImage(file);
    const item = items.value.find((i) => i.id === id);
    // Prepend so the real photo becomes the primary image everywhere.
    await updateItem(id, { photos: [url, ...(item?.photos ?? [])] });
  } catch (err: any) {
    alert(err?.message || "Photo upload failed.");
  } finally {
    uploadingPhotoId.value = null;
    photoTargetId.value = null;
  }
};

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
