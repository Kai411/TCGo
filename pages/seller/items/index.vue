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
            to="/seller/import"
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
            Add inventory
          </button>
        </div>
      </div>

      <!-- Add to inventory. Uses the same AddMethodPicker as Listings and
           Auctions so the choice looks and reads identically everywhere. -->
      <div v-if="addOpen" class="surface rounded-2xl p-4 sm:p-5 mb-6">
        <div class="flex items-center justify-between gap-3 mb-4">
          <p class="text-sm font-bold text-ink dark:text-white">Add to inventory</p>
          <button
            type="button"
            @click="closeAdd"
            class="text-xs font-semibold text-ink-muted dark:text-zinc-400 hover:text-ink dark:hover:text-white"
          >
            Close
          </button>
        </div>

        <AddMethodPicker
          v-model="addMode"
          class="mb-5"
          :methods="['scan', 'manual']"
          :scan-remaining="scanRemaining"
          :scan-limit="FREE_SCAN_LIMIT"
          :is-premium="isPremium"
        />

        <!-- Scan -->
        <div v-if="addMode === 'scan'" class="text-center py-2">
          <p class="text-xs text-ink-muted dark:text-zinc-400 mb-3 max-w-md mx-auto">
            Point your phone at the card — we'll read the name and number and match
            it to the catalogue. Scan a whole stack in one go.
          </p>
          <button
            type="button"
            @click="scannerOpen = true"
            :disabled="!isPremium && scanRemaining === 0"
            class="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-pokemon-red text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Open scanner
          </button>
          <p v-if="scanAdded > 0" class="mt-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            Added {{ scanAdded }} scanned {{ scanAdded === 1 ? "card" : "cards" }} to inventory.
          </p>
        </div>

        <!-- Enter manually: the same form Listings uses (catalogue search on
             top, product type, card details, print details), so adding to
             inventory and listing a card look and behave identically. The only
             differences: photos are optional here, and nothing is published. -->
        <form v-else @submit.prevent="addManual" class="space-y-4">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CardFormFields
              v-model="cardForm"
              @import-image="handleImportImage"
              @catalog-select="handleCatalogSelect"
            />

            <!-- Photos (optional for stock; the catalogue image is the fallback) -->
            <div class="surface rounded-2xl p-5 space-y-3 lg:col-span-2">
              <div class="flex items-center justify-between">
                <h3 class="text-sm font-bold text-ink dark:text-zinc-100">Photos <span class="text-ink-muted dark:text-zinc-400 font-normal">(optional)</span></h3>
                <span class="text-xs text-gray-400 dark:text-zinc-500">{{ selectedFiles.length }}/{{ MAX_PHOTOS }}</span>
              </div>
              <input ref="fileInput" type="file" accept="image/*" multiple class="hidden" @change="handleFileSelect" />
              <div class="grid grid-cols-4 gap-2">
                <label
                  v-if="selectedFiles.length < MAX_PHOTOS"
                  class="cursor-pointer aspect-[5/7] rounded-lg border-2 border-dashed border-gray-300 dark:border-white/[0.10] flex flex-col items-center justify-center gap-1 text-gray-400 dark:text-zinc-500 hover:border-pokemon-blue hover:text-pokemon-blue transition-colors"
                  @click="fileInput?.click()"
                >
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
                  <span class="text-[10px] font-medium">Add</span>
                </label>
                <div v-for="(file, index) in selectedFiles" :key="index" class="relative group aspect-[5/7]">
                  <img :src="file.preview" class="w-full h-full object-cover rounded-lg border border-gray-200 dark:border-white/[0.08]" />
                  <button
                    type="button"
                    @click="removeFile(index)"
                    class="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  >✕</button>
                </div>
                <div v-if="!selectedFiles.length && importedImageUrl" class="relative aspect-[5/7]" title="Catalogue image">
                  <CardImage :src="importedImageUrl" :alt="cardForm.cardName" />
                </div>
              </div>
              <p class="text-xs text-gray-400 dark:text-zinc-500">PNG, JPG, WEBP · up to 5 MB each · without a photo the catalogue image is used</p>
            </div>

            <!-- Cost / list price -->
            <div class="surface rounded-2xl p-5">
              <FormField label="List price (RM)">
                <div class="relative">
                  <span class="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-500 dark:text-zinc-400 pointer-events-none">RM</span>
                  <input v-model.number="manualPrice" type="number" min="0" step="0.01" placeholder="0.00" class="tcgo-input pl-10 tabular-price" />
                </div>
              </FormField>
              <p class="text-xs text-gray-400 dark:text-zinc-500 mt-2">
                Used as the asking price when you list this item later. You can change it any time from the table.
              </p>
            </div>
          </div>

          <div v-if="manualError" class="bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm">
            {{ manualError }}
          </div>

          <button
            type="submit"
            :disabled="manualBusy || !cardForm.cardName.trim()"
            class="w-full bg-pokemon-red text-white py-3 rounded-lg font-bold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ manualBusy ? "Adding…" : "Add to inventory" }}
          </button>
        </form>
      </div>

      <CardScanner
        v-if="scannerOpen"
        @close="scannerOpen = false"
        @finished="onScanFinished"
      />

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
          <NuxtLink to="/seller/import" class="px-4 py-2 rounded-lg text-sm font-semibold bg-pokemon-red text-white hover:bg-red-700 transition-colors">Bulk add</NuxtLink>
          <button @click="addOpen = true" class="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 dark:border-white/[0.10] text-gray-700 dark:text-zinc-200">Add inventory</button>
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
                <th class="px-2 py-2 w-[8.5rem]"></th>
              </tr>
            </thead>
            <!-- Every cell is align-middle so checkbox, thumbnail, inputs, status
                 pill and action icons share one centre line regardless of how
                 many lines the card name wraps to. -->
            <tbody class="divide-y divide-black/[0.05] dark:divide-white/[0.06]">
              <tr v-for="item in pagedItems" :key="item.id" :class="isSelected(item.id) ? 'bg-pokemon-red/[0.03]' : ''">
                <!-- Select -->
                <td class="px-3 py-2.5 align-middle">
                  <input type="checkbox" :checked="isSelected(item.id)" @change="toggleSelect(item.id)" class="rounded align-middle" :aria-label="`Select ${item.cardName}`" />
                </td>
                <!-- Thumbnail — click to add/replace photo -->
                <td class="px-1 py-2.5 align-middle">
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
                <td class="px-2 py-2.5 align-middle">
                  <p class="font-medium text-ink dark:text-white leading-snug line-clamp-2 break-words" :title="item.cardName">{{ item.cardName }}</p>
                  <p class="text-[11px] text-gray-500 dark:text-zinc-400 truncate">
                    {{ [item.setName, item.number].filter(Boolean).join(" · ") }}
                  </p>
                  <select
                    :value="item.condition"
                    :disabled="item.status === 'listed'"
                    :title="item.status === 'listed' ? 'Unlist to change condition' : undefined"
                    @change="updateItem(item.id, { condition: ($event.target as HTMLSelectElement).value })"
                    class="mt-1 max-w-full text-[11px] px-1.5 py-0.5 rounded border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-ink dark:text-white disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <option value="">Condition…</option>
                    <option v-for="c in conditionOptions(item.condition)" :key="c" :value="c">{{ c }}</option>
                  </select>
                </td>
                <!-- Price -->
                <td class="px-1.5 py-2.5 text-right align-middle">
                  <input
                    type="number" min="0" step="0.01"
                    :value="item.listPrice"
                    @change="updateItem(item.id, { listPrice: Number(($event.target as HTMLInputElement).value) })"
                    class="w-full text-sm text-right px-1.5 py-1 rounded-md border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-ink dark:text-white tabular-nums"
                  />
                </td>
                <!-- Qty -->
                <td class="px-1.5 py-2.5 text-right align-middle">
                  <input
                    type="number" min="1" step="1"
                    :value="item.quantity"
                    :disabled="item.status === 'listed'"
                    :title="item.status === 'listed' ? 'Unlist to change quantity' : undefined"
                    @change="updateItem(item.id, { quantity: Math.max(1, Number(($event.target as HTMLInputElement).value)) })"
                    class="w-full text-sm text-right px-1.5 py-1 rounded-md border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-ink dark:text-white tabular-nums disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </td>
                <!-- Status -->
                <td class="px-2 py-2.5 align-middle hidden sm:table-cell">
                  <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap" :class="statusClass(item.status)">
                    {{ statusLabel(item.status) }}
                  </span>
                </td>
                <!-- Actions (icon buttons) -->
                <td class="px-2 py-2.5 align-middle">
                  <div class="flex items-center justify-end gap-0.5">
                    <button @click="openEditDialog(item)" title="Edit details" class="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-500 dark:text-zinc-400 hover:bg-black/[0.05] dark:hover:bg-white/[0.08] hover:text-ink dark:hover:text-white transition-colors">
                      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                    </button>
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
        </div>
        <p class="text-[11px] text-gray-400 dark:text-zinc-500 mt-3">
          Lists with the catalog image. Add a real photo from the listing later for graded/played cards.
          Shipping is quoted live from your pickup address at checkout — you don't set a price here.
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

    <!-- Edit-details dialog -->
    <div
      v-if="editing"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      @click.self="editing = null"
    >
      <div class="surface rounded-2xl w-full max-w-md p-5 border border-black/[0.06] dark:border-white/[0.08] max-h-[90vh] overflow-y-auto">
        <h3 class="text-base font-bold text-ink dark:text-white mb-1">Edit item</h3>
        <p v-if="editLocked" class="text-xs text-amber-600 dark:text-amber-400 mb-4">
          This item is live on the marketplace — only the price can be changed.
          Unlist it first to edit the card details.
        </p>
        <p v-else class="text-xs text-gray-500 dark:text-zinc-400 mb-4">Update the card details in your inventory.</p>
        <div class="space-y-3">
          <!-- Same rule as the listing edit page: everything but price is
               read-only while listed. A disabled fieldset greys the lot. -->
          <fieldset :disabled="editLocked" class="space-y-3 disabled:opacity-50">
            <div>
              <label class="edit-label">Card name</label>
              <input v-model.trim="editForm.cardName" type="text" class="edit-input" />
            </div>
            <div class="grid grid-cols-[1fr_6rem] gap-3">
              <div>
                <label class="edit-label">Set</label>
                <input v-model.trim="editForm.setName" type="text" class="edit-input" />
              </div>
              <div>
                <label class="edit-label">Number</label>
                <input v-model.trim="editForm.number" type="text" placeholder="92/100" class="edit-input" />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="edit-label">Rarity</label>
                <input v-model.trim="editForm.rarity" type="text" class="edit-input" />
              </div>
              <div>
                <label class="edit-label">Condition</label>
                <select v-model="editForm.condition" class="edit-input">
                  <option value="">Condition…</option>
                  <option v-for="c in conditionOptions(editForm.condition)" :key="c" :value="c">{{ c }}</option>
                </select>
              </div>
            </div>
          </fieldset>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="edit-label">Price (RM)</label>
              <input v-model.number="editForm.listPrice" type="number" min="0" step="0.01" class="edit-input tabular-nums" />
            </div>
            <div>
              <label class="edit-label">Quantity</label>
              <input v-model.number="editForm.quantity" type="number" min="1" step="1" :disabled="editLocked" class="edit-input tabular-nums disabled:opacity-50" />
            </div>
          </div>
          <div>
            <label class="edit-label">Notes</label>
            <textarea v-model.trim="editForm.notes" rows="2" :disabled="editLocked" class="edit-input resize-none disabled:opacity-50" placeholder="Defects, provenance, anything a buyer should know…" />
          </div>
        </div>
        <div class="flex gap-2 mt-5">
          <button @click="editing = null" class="flex-1 py-2 rounded-lg text-sm font-semibold border border-gray-200 dark:border-white/[0.08] text-gray-700 dark:text-zinc-200">Cancel</button>
          <button
            @click="confirmEdit"
            :disabled="editBusy || !editForm.cardName"
            class="flex-1 py-2 rounded-lg text-sm font-semibold bg-ink text-white dark:bg-white dark:text-ink hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
          >
            <span v-if="editBusy" class="animate-spin rounded-full h-4 w-4 border-b-2 border-current"/>
            Save
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.edit-label {
  @apply block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1;
}
.edit-input {
  @apply w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-sm text-ink dark:text-white;
}
</style>

<script setup lang="ts">
import type { CatalogMatch } from "~/composables/useCardCatalog";
import type { AddMethod } from "~/components/AddMethodPicker.vue";
import type { CardFormData } from "~/components/CardFormFields.vue";
import { FREE_SCAN_LIMIT } from "~/composables/useScanQuota";
import type { InventoryItem } from "~/composables/useInventory";

definePageMeta({ layout: "seller" });
useHead({ title: "Seller · Inventory | TCGo" });

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
  syncListingsToInventory,
} = useInventory();
const { cards, loading: cardsLoading } = useCards();
const { isPremium, remaining: scanRemaining } = useScanQuota();
const { queue: scanQueue, clear: clearScanQueue } = useScanQueue();
const { sellerReady } = useSellerKyc();
const router = useRouter();

// ── Label printing entry points ───────────────────────────────────────
const printSelected = () => {
  if (!selected.value.size) return;
  setLabelQueue([...selected.value]);
  router.push("/seller/labels");
};
const printAll = () => {
  setLabelQueue(filteredItems.value.map((i) => i.id));
  router.push("/seller/labels");
};

onMounted(() => {
  if (user.value) listenMyInventory();
});
watch(user, (u) => {
  if (u) listenMyInventory();
});

// Every listing the seller owns must show up here too. Once both the
// inventory and the marketplace feeds have loaded, mirror any listing that
// has no inventory row (the composable makes this a once-per-uid no-op).
watch(
  [loading, cardsLoading, user],
  ([invLoading, cLoading, u]) => {
    if (invLoading || cLoading || !u) return;
    syncListingsToInventory(cards.value).catch((e) =>
      console.error("[inventory] listing sync failed:", e),
    );
  },
  { immediate: true },
);

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
  if (!sellerReady.value) {
    alert("Complete seller verification before listing.");
    router.push("/seller/verify");
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
        condition: i.condition || CONDITIONS[0] || "",
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

// ── Add card: mode chooser ────────────────────────────────────────────
// Shared with Listings and Auctions via AddMethodPicker.
const addMode = ref<AddMethod>("scan");
const scannerOpen = ref(false);
const scanAdded = ref(0);

// ── Enter manually: the Listings form, minus publishing ──────────────
const blankCardForm = (): CardFormData => ({
  productType: "Ungraded",
  cardName: "",
  cardSet: "",
  cardNumber: "",
  condition: "",
  gradingProvider: "",
  grade: "",
  customGradingProvider: "",
  description: "",
  language: "EN",
  tcgType: "Pokemon",
  rarity: "",
  variant: "",
  edition: "",
  artist: "",
  certNumber: "",
  quantity: 1,
  negotiable: false,
  pickupAvailable: false,
});
const cardForm = ref<CardFormData>(blankCardForm());
const manualPrice = ref<number | null>(null);
const manualBusy = ref(false);
const manualError = ref("");

// Catalogue pick: CardFormFields fills the text fields itself; we keep the
// product id (for price history / QR labels) and the stock image.
const importedImageUrl = ref("");
const pickedProductId = ref<number | null>(null);
const handleImportImage = (url: string) => {
  importedImageUrl.value = url;
};
const handleCatalogSelect = (card: CatalogMatch) => {
  pickedProductId.value = card.productId ?? null;
  if (card.price?.market && !manualPrice.value) manualPrice.value = card.price.market;
};

// Photos — same picker as Listings, but optional here.
interface SelectedFile {
  file: File;
  preview: string;
}
const MAX_PHOTOS = 3;
const fileInput = ref<HTMLInputElement | null>(null);
const selectedFiles = ref<SelectedFile[]>([]);
const handleFileSelect = (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (!input.files) return;
  for (const file of Array.from(input.files)) {
    if (!file.type.startsWith("image/")) continue;
    if (file.size > 5 * 1024 * 1024) {
      manualError.value = `${file.name} is too large (max 5MB)`;
      continue;
    }
    if (selectedFiles.value.length >= MAX_PHOTOS) {
      manualError.value = `Maximum ${MAX_PHOTOS} photos`;
      break;
    }
    selectedFiles.value.push({ file, preview: URL.createObjectURL(file) });
  }
  input.value = "";
};
const removeFile = (index: number) => {
  URL.revokeObjectURL(selectedFiles.value[index].preview);
  selectedFiles.value.splice(index, 1);
};

const resetManual = () => {
  selectedFiles.value.forEach((f) => URL.revokeObjectURL(f.preview));
  selectedFiles.value = [];
  cardForm.value = blankCardForm();
  manualPrice.value = null;
  importedImageUrl.value = "";
  pickedProductId.value = null;
};

const addManual = async () => {
  manualError.value = "";
  const f = cardForm.value;
  const name = f.cardName.trim();
  if (!name || manualBusy.value) return;
  manualBusy.value = true;
  try {
    const photos: string[] = [];
    for (const sf of selectedFiles.value) photos.push(await uploadImage(sf.file));
    // Ungraded → condition; Graded → "PSA 10"-style label so the table
    // still shows something meaningful in the condition column.
    const condition =
      f.productType === "Graded" && f.gradingProvider
        ? [f.gradingProvider === "Others" ? f.customGradingProvider : f.gradingProvider, f.grade]
            .filter(Boolean)
            .join(" ")
        : f.condition;
    await addItem({
      productId: pickedProductId.value,
      cardName: name,
      setName: f.cardSet.trim(),
      number: f.cardNumber.trim(),
      rarity: f.rarity || "",
      condition,
      quantity: Math.max(1, f.quantity || 1),
      listPrice: manualPrice.value || 0,
      stockImageUrl: importedImageUrl.value,
      photos,
      notes: f.description || "",
      source: "manual",
    });
    resetManual();
  } catch (e: any) {
    manualError.value = e?.message || "Could not add this item.";
  } finally {
    manualBusy.value = false;
  }
};

const closeAdd = () => {
  addOpen.value = false;
  scanAdded.value = 0;
};

/**
 * The scanner only fills a client-side queue; persisting is the caller's job.
 * Pull every card it managed to match into inventory, then clear the queue so
 * reopening the scanner starts clean.
 */
const onScanFinished = async () => {
  scannerOpen.value = false;
  const matched = scanQueue.value.filter((i) => i.productId && i.cardName);
  scanAdded.value = 0;
  for (const item of matched) {
    await addItem({
      productId: item.productId!,
      cardName: item.cardName!,
      setName: item.cardSet ?? "",
      number: item.cardNumber ?? "",
      rarity: item.rarity ?? "",
      listPrice: item.tcgoPrice?.market ?? 0,
      stockImageUrl: item.imageUrl ?? "",
      source: "scan",
    });
    scanAdded.value++;
  }
  clearScanQueue();
};

const addOpen = ref(false);

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
});

const openListDialog = (item: InventoryItem) => {
  listing.value = item;
  listForm.value = {
    price: item.listPrice || 0,
    condition: item.condition || CONDITIONS[0] || "",
  };
};

const confirmList = async () => {
  if (!listing.value || !user.value || listingBusy.value) return;
  if (!sellerReady.value) {
    alert("Complete seller verification before listing.");
    router.push("/seller/verify");
    return;
  }
  listingBusy.value = true;
  try {
    await listItem(listing.value.id, {
      sellerName: profile.value?.customName || user.value.displayName || "Anonymous",
      sellerUid: user.value.uid,
      price: listForm.value.price,
      condition: listForm.value.condition,
    });
    listing.value = null;
  } catch (e: any) {
    alert(e?.message || "Could not list this item.");
  } finally {
    listingBusy.value = false;
  }
};

// Legacy / imported rows can carry a condition string that isn't in our
// list (or a bare "NM"). Keep it selectable so the dropdown never shows blank.
const conditionOptions = (current: string) =>
  current && !CONDITIONS.includes(current) ? [current, ...CONDITIONS] : CONDITIONS;

// ── Edit-details dialog ───────────────────────────────────────────────
const editing = ref<InventoryItem | null>(null);
const editBusy = ref(false);
const editForm = ref({
  cardName: "",
  setName: "",
  number: "",
  rarity: "",
  condition: "",
  listPrice: 0,
  quantity: 1,
  notes: "",
});

const openEditDialog = (item: InventoryItem) => {
  editing.value = item;
  editForm.value = {
    cardName: item.cardName || "",
    setName: item.setName || "",
    number: item.number || "",
    rarity: item.rarity || "",
    condition: item.condition || "",
    listPrice: item.listPrice || 0,
    quantity: item.quantity || 1,
    notes: item.notes || "",
  };
};

// Listed items follow the listing-edit rule: price only. Anything else must
// go through unlist → edit → relist so the live listing never drifts.
const editLocked = computed(() => editing.value?.status === "listed");

const confirmEdit = async () => {
  if (!editing.value || editBusy.value) return;
  const f = editForm.value;
  if (!f.cardName) return;
  editBusy.value = true;
  try {
    const price = Math.max(0, Number(f.listPrice) || 0);
    await updateItem(
      editing.value.id,
      editLocked.value
        ? { listPrice: price }
        : {
            cardName: f.cardName,
            setName: f.setName,
            number: f.number,
            rarity: f.rarity,
            condition: f.condition,
            listPrice: price,
            quantity: Math.max(1, Math.floor(Number(f.quantity) || 1)),
            notes: f.notes,
          },
    );
    editing.value = null;
  } catch (e: any) {
    alert(e?.message || "Could not save changes.");
  } finally {
    editBusy.value = false;
  }
};

const formatMyr = (n: number) =>
  n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
</script>
