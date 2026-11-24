<template>
  <div class="sl-page">
    <SellerGate v-if="!user" message="Sign in to manage your inventory." />

    <template v-else>
      <!-- Header + summary. The three numbers that describe the shelf sit
           in their own card rather than inside a sentence. -->
      <SellerPageHead
        title="Inventory"
        description="Every card you hold, listed or not. Edit prices and costs right in the table."
      >
        <button
          v-if="count > 0"
          type="button"
          class="mc-btn"
          title="Print QR labels for the current view"
          @click="printAll"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Labels
        </button>
        <NuxtLink to="/seller/import" class="mc-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Bulk add
        </NuxtLink>
        <button type="button" class="mc-btn mc-btn-primary" @click="addOpen = !addOpen">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
          Add inventory
        </button>
      </SellerPageHead>

      <div v-if="count > 0 && !addOpen" class="mc-card mc-cells mb-5" data-cols="3">
        <AdminStat label="Units" :value="String(totalUnits)" />
        <AdminStat label="Entries" :value="String(count)" />
        <AdminStat label="Estimated value" :value="`RM ${formatMyr(totalValue)}`" hint="at your list prices" />
      </div>

      <!-- Add to inventory. Uses the same AddMethodPicker as Listings and
           Auctions so the choice looks and reads identically everywhere. -->
      <div v-if="addOpen" class="mc-card mc-card-pad mb-6">
        <div class="flex items-center justify-between gap-3 mb-4">
          <h2 class="mc-h2">Add to inventory</h2>
          <button type="button" class="mc-btn mc-btn-ghost mc-btn-sm" @click="closeAdd">Close</button>
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
            class="mc-btn mc-btn-primary disabled:cursor-not-allowed"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Open scanner
          </button>
          <p v-if="scanAdded > 0" class="mc-small mt-3 font-semibold text-[var(--ink-2)]">
            Added {{ scanAdded }} scanned {{ scanAdded === 1 ? "card" : "cards" }} to inventory.
          </p>
        </div>

        <!-- What just went in.
             This is the whole reason it's safe to hide the table below while
             adding: without some acknowledgement, a form that silently clears
             itself is indistinguishable from one that failed. -->
        <div
          v-if="sessionAdds.length"
          class="mc-callout mb-4" data-tone="good"
        >
          <div class="flex items-center justify-between gap-3 mb-1.5">
            <p class="text-[12.5px] font-semibold">
              Added {{ sessionAdds.length }} {{ sessionAdds.length === 1 ? "card" : "cards" }}
            </p>
            <button
              type="button"
              class="mc-btn mc-btn-ghost mc-btn-sm"
              @click="undoLastAdd"
              :disabled="undoBusy"
            >
              {{ undoBusy ? "Removing…" : "Undo last" }}
            </button>
          </div>
          <ul class="space-y-0.5">
            <li
              v-for="a in sessionAdds.slice(0, 4)"
              :key="a.id"
              class="mc-meta flex justify-between gap-3"
            >
              <span class="truncate">{{ a.label }}</span>
              <span v-if="a.qty > 1" class="shrink-0 tabular-nums">×{{ a.qty }}</span>
            </li>
          </ul>
          <p
            v-if="sessionAdds.length > 4"
            class="mc-small mt-1"
          >
            and {{ sessionAdds.length - 4 }} more
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
            <div class="panel surface rounded-2xl p-5 space-y-3 lg:col-span-2">
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
                  <span class="text-2xs font-medium">Add</span>
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

            <!-- Prices: what you'll ask, and what you paid. Cost and remark
                 are private — they feed the stock value card and the profit
                 column, and never appear on a listing. -->
            <div class="panel surface rounded-2xl p-5 space-y-4">
              <div>
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
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label="Cost price (RM)" optional hint="Per card. What you paid — your profit is measured against this.">
                  <div class="relative">
                    <span class="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-500 dark:text-zinc-400 pointer-events-none">RM</span>
                    <input v-model.number="manualCost" type="number" min="0" step="0.01" placeholder="0.00" class="tcgo-input pl-10 tabular-price" />
                  </div>
                </FormField>
                <FormField label="Remark" optional hint="Private. Where you got it, who from, the deal.">
                  <input v-model.trim="manualCostNote" type="text" maxlength="200" placeholder="e.g. Pulled from ETB · Sunway meetup" class="tcgo-input" />
                </FormField>
              </div>
            </div>
          </div>

          <div v-if="manualError" class="mc-callout" data-tone="bad">
            {{ manualError }}
          </div>

          <div class="flex gap-2">
            <button
              type="submit"
              :disabled="manualBusy || !cardForm.cardName.trim()"
              class="mc-btn mc-btn-primary flex-1 disabled:cursor-not-allowed"
            >
              <!-- The form already clears and stays open, so this IS the
                   add-another loop. Saying so is the only thing that was
                   missing — the old label read like a one-shot action. -->
              {{ manualBusy ? "Adding…" : sessionAdds.length ? "Add another card" : "Add to inventory" }}
            </button>
            <button
              v-if="sessionAdds.length"
              type="button"
              class="mc-btn"
              @click="finishAdding"
            >
              Done
            </button>
          </div>
        </form>
      </div>

      <CardScanner
        v-if="scannerOpen"
        @close="scannerOpen = false"
        @finished="onScanFinished"
      />

      <!-- Inventory list.
           Collapsed while the add panel is open: the table runs to fifty rows
           and pushes the form off screen, and during a run of adds it isn't
           what you're looking at anyway. The "just added" strip inside the
           panel carries the confirmation the table would otherwise provide. -->
      <div
        v-if="addOpen && count > 0"
        class="mc-card px-4 py-3 flex items-center justify-between gap-3 flex-wrap"
      >
        <p class="mc-meta">
          Your {{ count }} {{ count === 1 ? "item is" : "items are" }} hidden while you're adding.
        </p>
        <button type="button" class="mc-btn mc-btn-sm" @click="finishAdding">Show inventory</button>
      </div>

      <div v-else-if="loading" class="mc-skel h-[240px]" aria-busy="true" aria-label="Loading inventory" />

      <div v-else-if="count === 0" class="mc-card mc-empty flex items-center justify-between gap-3 flex-wrap">
        <span>
          <span class="font-semibold text-[var(--ink-2)]">No inventory yet.</span>
          Bulk add from a file or pasted rows, or add cards one at a time.
        </span>
        <NuxtLink to="/seller/import" class="mc-btn mc-btn-sm">Bulk add</NuxtLink>
      </div>

      <template v-else>
        <!-- Status filter + count + select all -->
        <div id="inventory-list" class="scroll-mt-4 mb-3">
          <McTabs v-model="statusFilter" :tabs="filterTabs" />
          <div class="flex items-center justify-between gap-2 mt-3 flex-wrap">
            <div class="flex items-center gap-2">
              <button
                v-if="missingCostCount > 0"
                type="button"
                class="mc-tag inv-filter mc-num"
                :aria-pressed="missingCostOnly"
                :title="missingCostOnly ? 'Show every item' : 'Show only items without a cost price'"
                @click="missingCostOnly = !missingCostOnly"
              >
                <span class="mc-dot" data-tone="warn" aria-hidden="true" />
                {{ missingCostCount }} without a cost price
              </button>
            </div>
            <div class="flex items-center gap-2">
              <span class="mc-small mc-num">
                {{ filteredItems.length }} {{ filteredItems.length === 1 ? "item" : "items" }}
              </span>
              <button type="button" class="mc-btn mc-btn-ghost mc-btn-sm" @click="toggleSelectAllFiltered">
                {{ allFilteredSelected ? "Clear selection" : `Select all` }}
              </button>
            </div>
          </div>
        </div>

        <!-- Bulk action bar -->
        <div v-if="selected.size" class="mc-card inv-bulk mb-3">
          <div class="flex items-center gap-2">
            <span class="font-semibold mc-num">{{ selected.size }} selected</span>
            <button
              v-if="selected.size < filteredItems.length"
              type="button"
              class="mc-btn mc-btn-ghost mc-btn-sm"
              @click="selectAllFiltered"
            >
              Select all {{ filteredItems.length }}
            </button>
          </div>
          <div class="flex items-center gap-1.5 flex-wrap">
            <button type="button" class="mc-btn mc-btn-sm mc-btn-primary" :disabled="bulkBusy" @click="bulkList">List</button>
            <button type="button" class="mc-btn mc-btn-sm" @click="printSelected">Labels</button>
            <button type="button" class="mc-btn mc-btn-sm" :disabled="bulkBusy" @click="bulkMarkSold">Mark sold</button>
            <button type="button" class="mc-btn mc-btn-sm mc-btn-danger" :disabled="bulkBusy" @click="bulkRemove">Remove</button>
            <button type="button" class="mc-btn mc-btn-sm mc-btn-ghost" @click="clearSelection">Clear</button>
          </div>
        </div>

        <!-- Phone: one compact row per item — photo, name and condition,
             then Edit and a ⋯ menu. Tapping the photo or name views it;
             price, quantity and photo are changed in the edit drawer. -->
        <ul class="sm:hidden mc-card inv-list">
          <li
            v-for="item in pagedItems"
            :key="item.id"
            class="flex items-center gap-2 pr-1 py-2"
            :class="{ 'is-selected': isSelected(item.id) }"
          >
            <label class="shrink-0 flex items-center justify-center w-10 h-11 cursor-pointer">
              <input type="checkbox" :checked="isSelected(item.id)" @change="toggleSelect(item.id)" class="rounded" :aria-label="`Select ${item.cardName}`" />
            </label>
            <button
              type="button"
              @click="viewItem(item)"
              class="relative shrink-0 w-11 h-[3.75rem] rounded overflow-hidden bg-gray-100 dark:bg-white/[0.04] border border-black/[0.04] dark:border-white/[0.06] active:scale-[0.97] transition-transform duration-150"
              :aria-label="viewLabel(item)"
            >
              <CardImage v-if="item.primaryImage" :src="item.primaryImage" :alt="item.cardName" />
              <span v-if="uploadingPhotoId === item.id" class="absolute inset-0 bg-black/50 flex items-center justify-center">
                <span class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"/>
              </span>
            </button>
            <button type="button" @click="viewItem(item)" class="flex-1 min-w-0 self-stretch flex flex-col justify-center text-left py-1" :aria-label="viewLabel(item)">
              <span class="text-sm font-medium text-ink dark:text-white leading-snug line-clamp-2 break-words">{{ item.cardName }}</span>
              <span class="text-xs text-gray-500 dark:text-zinc-400 truncate">{{ item.condition || "No condition" }}</span>
              <span class="mt-0.5 flex items-center gap-1.5 text-micro text-gray-400 dark:text-zinc-500 tabular-nums">
                RM {{ formatMyr(item.listPrice || 0) }}<template v-if="item.quantity > 1"> × {{ item.quantity }}</template>
                <span class="inline-flex items-center gap-1 whitespace-nowrap"><span class="mc-dot inv-dot" :data-tone="statusTone(item.status)" aria-hidden="true" />{{ statusLabel(item.status) }}</span>
              </span>
            </button>
            <button type="button" @click="openEditDialog(item)" aria-label="Edit listing" class="shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-full inv-touch">
              <svg class="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
            </button>
            <button type="button" @click="menuItem = item" aria-label="More actions" class="shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-full inv-touch">
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>
            </button>
          </li>
        </ul>

        <div class="hidden sm:block mc-card overflow-hidden">
          <table class="w-full table-fixed inv-table">
            <thead>
              <tr>
                <th class="px-3 py-2 w-9">
                  <input type="checkbox" :checked="allPageSelected" @change="toggleSelectAllPage" class="rounded align-middle" aria-label="Select all on page" />
                </th>
                <th class="px-1 py-2 w-12"></th>
                <th class="text-left font-semibold px-2 py-2">Card</th>
                <th class="text-right font-semibold px-1.5 py-2 w-20">Price</th>
                <th class="text-right font-semibold px-1.5 py-2 w-12">Qty</th>
                <th class="text-right font-semibold px-1.5 py-2 w-[5.5rem] hidden sm:table-cell">Cost</th>
                <th class="text-left font-semibold px-2 py-2 w-20 hidden sm:table-cell">Status</th>
                <th class="px-2 py-2 w-[8.5rem]"></th>
              </tr>
            </thead>
            <!-- Every cell is align-middle so checkbox, thumbnail, inputs, status
                 pill and action icons share one centre line regardless of how
                 many lines the card name wraps to. -->
            <tbody>
              <tr v-for="item in pagedItems" :key="item.id" :class="{ 'is-selected': isSelected(item.id) }">
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
                      <span class="text-2xs font-bold leading-none">Photo</span>
                    </span>
                    <span v-if="uploadingPhotoId === item.id" class="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"/>
                    </span>
                  </button>
                </td>
                <!-- Card -->
                <td class="px-2 py-2.5 align-middle">
                  <p class="font-medium text-ink dark:text-white leading-snug line-clamp-2 break-words" :title="item.cardName">{{ item.cardName }}</p>
                  <p class="text-micro text-gray-500 dark:text-zinc-400 truncate">
                    {{ [item.setName, item.number].filter(Boolean).join(" · ") }}
                  </p>
                  <select
                    :value="item.condition"
                    :disabled="item.status === 'listed'"
                    :title="item.status === 'listed' ? 'Unlist to change condition' : undefined"
                    @change="updateItem(item.id, { condition: ($event.target as HTMLSelectElement).value })"
                    class="inv-cell inv-cell-sm mt-1 max-w-full disabled:opacity-60 disabled:cursor-not-allowed"
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
                    class="inv-cell w-full text-right mc-num"
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
                    class="inv-cell w-full text-right mc-num disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </td>
                <!-- Cost, or profit once sold. Private either way: this column
                     never reaches the listing, so it stays editable while
                     listed. A sold row without a cost keeps the input, so
                     filling it in turns straight into a profit figure. -->
                <td class="px-1.5 py-2.5 text-right align-middle hidden sm:table-cell">
                  <template v-if="item.status === 'sold' && rowProfit(item) !== null">
                    <p
                      class="text-sm font-semibold tabular-nums"
                      
                      :title="item.costNote || 'Profit: sold price less TCGo fee and cost'"
                    >
                      {{ signedMyr(rowProfit(item) ?? 0) }}
                    </p>
                    <p class="text-2xs text-gray-400 dark:text-zinc-500 tabular-nums">
                      cost {{ formatMyr(item.costPrice ?? 0) }}<template v-if="rowFee(item) > 0"> · fee {{ formatMyr(rowFee(item)) }}</template>
                    </p>
                  </template>
                  <input
                    v-else
                    type="number" min="0" step="0.01"
                    :value="item.costPrice ?? ''"
                    placeholder="—"
                    :title="item.costNote || 'Cost price per card (private)'"
                    @change="updateItem(item.id, { costPrice: costFromInput(($event.target as HTMLInputElement).value) })"
                    class="inv-cell w-full text-right mc-num"
                  />
                </td>
                <!-- Status -->
                <td class="px-2 py-2.5 align-middle hidden sm:table-cell">
                  <span class="mc-meta inline-flex items-center gap-1.5 whitespace-nowrap">
                    <span class="mc-dot inv-dot" :data-tone="statusTone(item.status)" aria-hidden="true" />
                    {{ statusLabel(item.status) }}
                  </span>
                </td>
                <!-- Actions (icon buttons) -->
                <td class="px-2 py-2.5 align-middle">
                  <div class="flex items-center justify-end gap-0.5">
                    <button @click="openEditDialog(item)" title="Edit details" class="mc-btn mc-btn-ghost mc-btn-sm inv-icon">
                      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                    </button>
                    <template v-if="item.status === 'in_stock'">
                      <button @click="openListDialog(item)" title="List for sale" class="mc-btn mc-btn-ghost mc-btn-sm inv-icon !text-[var(--ink)]">
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3H4a1 1 0 0 0-1 1v5.59A2 2 0 0 0 3.83 11l9.58 9.59a2 2 0 0 0 2.83 0l4.35-4.35a2 2 0 0 0 0-2.83z"/><circle cx="7" cy="7" r="1.4" fill="currentColor" stroke="none"/></svg>
                      </button>
                      <button @click="handleMarkSold(item.id)" title="Mark sold" class="mc-btn mc-btn-ghost mc-btn-sm inv-icon">
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      </button>
                    </template>
                    <template v-else-if="item.status === 'listed'">
                      <NuxtLink v-if="item.listingId" :to="`/cards/${item.listingId}`" title="View listing" class="mc-btn mc-btn-ghost mc-btn-sm inv-icon">
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
                      </NuxtLink>
                      <button @click="handleUnlist(item.id)" title="Unlist (back to stock)" class="mc-btn mc-btn-ghost mc-btn-sm inv-icon">
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/></svg>
                      </button>
                    </template>
                    <button @click="handleRemove(item.id)" title="Remove from inventory" class="mc-btn mc-btn-ghost mc-btn-sm inv-icon mc-btn-danger">
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
          <p class="mc-small mc-num">{{ rangeStart }}–{{ rangeEnd }} of {{ filteredItems.length }}</p>
          <div class="flex items-center gap-1">
            <button
              @click="page = Math.max(0, page - 1)"
              :disabled="page === 0"
              class="mc-btn mc-btn-sm"
            >Prev</button>
            <span class="text-xs px-2 tabular-nums text-gray-500 dark:text-zinc-400">{{ page + 1 }} / {{ totalPages }}</span>
            <button
              @click="page = Math.min(totalPages - 1, page + 1)"
              :disabled="page >= totalPages - 1"
              class="mc-btn mc-btn-sm"
            >Next</button>
          </div>
        </div>
      </template>

      <!-- Hidden file input for inline photo upload -->
      <input ref="photoInput" type="file" accept="image/*" class="hidden" @change="onPhotoSelected" />
    </template>

    <!-- Phone ⋯ menu: the row's listing actions and Remove, as a bottom sheet. -->
    <Transition name="sheet">
      <div
        v-if="menuItem"
        class="sm:hidden fixed inset-0 z-50 flex items-end inv-scrim"
        @click.self="menuItem = null"
      >
        <div class="sheet-panel inv-sheet w-full px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <div class="mx-auto mb-1 h-1 w-9 rounded-full bg-gray-300 dark:bg-white/20" aria-hidden="true" />
          <p class="px-3 py-2 text-xs text-gray-500 dark:text-zinc-400 truncate">{{ menuItem.cardName }}</p>
          <template v-if="menuItem.status === 'in_stock'">
            <button type="button" class="menu-row font-semibold" @click="menuAction(openListDialog)">List for sale</button>
            <button type="button" class="menu-row" @click="menuAction((i) => handleMarkSold(i.id))">Mark sold</button>
          </template>
          <button v-else-if="menuItem.status === 'listed'" type="button" class="menu-row" @click="menuAction((i) => handleUnlist(i.id))">Unlist (back to stock)</button>
          <button type="button" class="menu-row inv-danger" @click="menuAction((i) => handleRemove(i.id))">Remove from inventory</button>
          <button type="button" class="menu-row justify-center mt-1 font-semibold" @click="menuItem = null">Cancel</button>
        </div>
      </div>
    </Transition>

    <!-- List-for-sale dialog -->
    <div
      v-if="listing"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 inv-scrim"
      @click.self="listing = null"
    >
      <div class="inv-modal w-full max-w-sm p-5">
        <h3 class="mc-h2 mb-1">List for sale</h3>
        <p class="mc-meta mb-4 truncate">{{ listing.cardName }}</p>
        <div class="space-y-3">
          <div>
            <label class="edit-label">Price (RM)</label>
            <input v-model.number="listForm.price" type="number" min="0.01" step="0.01" class="edit-input mc-num"/>
          </div>
          <div>
            <label class="edit-label">Condition</label>
            <select v-model="listForm.condition" class="edit-input mc-select">
              <option value="">Condition…</option>
              <option v-for="c in CONDITIONS" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
        </div>
        <p
          v-if="listPhotoRule.required && !listPhotoOk"
          class="mc-callout mt-3"
        >
          {{ listPhotoRule.reason }}
          <button
            type="button"
            class="block mt-1.5 font-bold underline"
            @click="addPhotoToListingCandidate"
          >
            Add a photo now
          </button>
        </p>
        <p v-else class="mc-small mt-3">
          <template v-if="!listingLive?.photos?.length">
            Lists with the catalogue image — fine at this price and condition,
            but your own photo always sells better.
          </template>
          Shipping is quoted live from your pickup address at checkout — you don't set a price here.
        </p>
        <div class="flex gap-2 mt-4">
          <button @click="listing = null" class="mc-btn mc-btn-ghost flex-1">Cancel</button>
          <button
            @click="confirmList"
            :disabled="listingBusy || !listForm.price || (listPhotoRule.required && !listPhotoOk)"
            class="mc-btn mc-btn-primary flex-1"
          >
            <span v-if="listingBusy" class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"/>
            List it
          </button>
        </div>
      </div>
    </div>

    <!-- Edit-details dialog. Centred card from sm up; on a phone a
         full-width drawer from the bottom that also holds the photo. -->
    <Transition name="sheet">
    <div
      v-if="editing"
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 inv-scrim"
      @click.self="editing = null"
    >
      <div class="sheet-panel inv-modal inv-modal--sheet w-full sm:max-w-md p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-5 max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto overscroll-contain">
        <div class="sm:hidden mx-auto -mt-2 mb-3 h-1 w-9 rounded-full bg-gray-300 dark:bg-white/20" aria-hidden="true" />
        <h3 class="mc-h2 mb-1">Edit item</h3>
        <p v-if="editLocked" class="mc-callout mb-4">
          This item is live on the marketplace — only the price can be changed.
          Unlist it first to edit the card details.
        </p>
        <p v-else class="mc-small mb-4">Update the card details in your inventory.</p>
        <!-- Phone only: the row has no photo button, so it lives here. -->
        <div class="sm:hidden flex items-center gap-3 mb-4">
          <div class="relative w-14 h-[4.75rem] shrink-0 rounded-md overflow-hidden bg-gray-100 dark:bg-white/[0.04] border border-black/[0.04] dark:border-white/[0.06]">
            <CardImage v-if="editingLive?.primaryImage" :src="editingLive.primaryImage" :alt="editingLive.cardName" />
            <span v-if="uploadingPhotoId === editing.id" class="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"/>
            </span>
          </div>
          <button
            type="button"
            @click="openPhotoPicker(editing)"
            :disabled="uploadingPhotoId === editing.id"
            class="mc-btn"
          >
            {{ editingLive?.photos?.length ? "Change photo" : "Add a photo" }}
          </button>
        </div>
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
          <!-- Private, so not locked with the listing. -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="edit-label">Cost price (RM)</label>
              <input v-model.number="editForm.costPrice" type="number" min="0" step="0.01" placeholder="Not recorded" class="edit-input tabular-nums" />
            </div>
            <div>
              <label class="edit-label">Remark <span class="font-normal opacity-70">(private)</span></label>
              <input v-model.trim="editForm.costNote" type="text" maxlength="200" placeholder="Where it came from" class="edit-input" />
            </div>
          </div>
          <div>
            <label class="edit-label">Notes</label>
            <textarea v-model.trim="editForm.notes" rows="2" :disabled="editLocked" class="edit-input resize-none disabled:opacity-50" placeholder="Defects, provenance, anything a buyer should know…" />
          </div>
        </div>
        <div class="flex gap-2 mt-5">
          <button @click="editing = null" class="mc-btn mc-btn-ghost flex-1">Cancel</button>
          <button
            @click="confirmEdit"
            :disabled="editBusy || !editForm.cardName"
            class="mc-btn mc-btn-primary flex-1"
          >
            <span v-if="editBusy" class="animate-spin rounded-full h-4 w-4 border-b-2 border-current"/>
            Save
          </button>
        </div>
      </div>
    </div>
    </Transition>
  </div>
</template>

<style scoped>
.edit-label {
  display: block;
  margin-bottom: 6px;
  font-size: 12.5px;
  font-weight: 550;
  color: var(--ink-2);
}
.edit-input {
  width: 100%;
  min-height: var(--control-h);
  padding: 6px 10px;
  border-radius: var(--radius-s);
  border: 1px solid var(--line-strong);
  background-color: var(--surface);
  color: var(--ink);
  font-size: 13.5px;
}
.edit-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--focus);
}
.menu-row {
  display: flex;
  width: 100%;
  align-items: center;
  min-height: 48px;
  padding: 0 12px;
  border-radius: var(--radius);
  font-size: 15px;
  text-align: left;
  color: var(--ink);
}
.menu-row:active {
  background: var(--surface-2);
}
.inv-icon {
  width: 30px;
  padding: 0;
}
.inv-touch {
  color: var(--ink-2);
}
.inv-touch:active {
  background: var(--surface-2);
}
.inv-danger {
  color: var(--danger);
}
.inv-filter[aria-pressed="true"] {
  background: var(--surface);
  border-color: var(--ink-3);
  color: var(--ink);
}
.inv-bulk {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
  padding: 8px 10px 8px 14px;
  background: var(--surface-2);
}
.inv-list > li + li {
  border-top: 1px solid var(--line);
}
.is-selected {
  background: var(--accent-soft);
}
.inv-table {
  font-size: 13.5px;
}
.inv-table thead {
  font-size: 12px;
  color: var(--ink-3);
  border-bottom: 1px solid var(--line);
}
.inv-table tbody tr + tr {
  border-top: 1px solid var(--line);
}
.inv-cell {
  padding: 4px 6px;
  border-radius: var(--radius-s);
  border: 1px solid var(--line-strong);
  background: var(--surface);
  color: var(--ink);
  font-size: 13px;
}
.inv-cell::placeholder {
  color: var(--ink-3);
}
.inv-cell:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--focus);
}
.inv-cell-sm {
  padding: 1px 4px;
  font-size: 11.5px;
}
.inv-dot {
  width: 6px;
  height: 6px;
  box-shadow: none;
}
.inv-scrim {
  background: var(--scrim);
}
.inv-sheet {
  background: var(--surface);
  border-top: 1px solid var(--line);
  border-radius: var(--radius-l) var(--radius-l) 0 0;
  box-shadow: var(--shadow-3);
}
.inv-modal {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-l);
  box-shadow: var(--shadow-3);
}
@media (max-width: 639.98px) {
  .inv-modal--sheet {
    border-radius: var(--radius-l) var(--radius-l) 0 0;
    border-width: 1px 0 0;
  }
}
/* Phone sheets slide up from the bottom; from sm up the edit dialog keeps
   its plain fade-free appearance. */
@media (max-width: 639.98px) {
  .sheet-enter-active,
  .sheet-leave-active {
    transition: background-color 240ms var(--ease-drawer);
  }
  .sheet-enter-active .sheet-panel,
  .sheet-leave-active .sheet-panel {
    transition: transform 240ms var(--ease-drawer);
  }
  .sheet-enter-from,
  .sheet-leave-to {
    background-color: transparent;
  }
  .sheet-enter-from .sheet-panel,
  .sheet-leave-to .sheet-panel {
    transform: translateY(100%);
  }
}
@media (prefers-reduced-motion: reduce) {
  .sheet-enter-active .sheet-panel,
  .sheet-leave-active .sheet-panel {
    transition: none;
  }
}
</style>

<script setup lang="ts">
import type { CatalogMatch } from "~/composables/useCardCatalog";
import type { AddMethod } from "~/components/AddMethodPicker.vue";
import type { CardFormData } from "~/components/CardFormFields.vue";
import { FREE_SCAN_LIMIT } from "~/composables/useScanQuota";
import { validCost, type InventoryItem } from "~/composables/useInventory";
import { hasCost, rowFee, rowProfit } from "~/shared/portfolio";
import {
  HIGH_VALUE_THRESHOLD,
  photoRequirement,
  photoRequirementMet,
} from "~/shared/photo-policy";

definePageMeta({ layout: "seller" });
useHead({ title: "Seller · Inventory | TCGo" });

const CONDITIONS = [
  "Near Mint (NM)",
  "Lightly Played (LP)",
  "Moderately Played (MP)",
  "Heavily Played (HP)",
  "Damaged (DMG)",
];

const {user} = useAuth();
const { goToLogin } = useSignInGate();
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

// "Only rows without a cost price" — the backfill path the stock value card
// links to (/seller/items?missing=cost). Switches itself off once every row
// has one, so the seller isn't left looking at an empty table.
const route = useRoute();
const missingCostOnly = ref(route.query.missing === "cost");
const missingCostCount = computed(() => items.value.filter((i) => !hasCost(i)).length);
watch([missingCostCount, loading], ([n, busy]) => {
  if (!busy && n === 0) missingCostOnly.value = false;
});

const filterTabs = computed(() => [
  { id: "all", label: "All", count: items.value.length },
  { id: "in_stock", label: "In stock", count: items.value.filter((i) => i.status === "in_stock").length },
  { id: "listed", label: "Listed", count: items.value.filter((i) => i.status === "listed").length },
  { id: "sold", label: "Sold", count: items.value.filter((i) => i.status === "sold").length },
]);

const filteredItems = computed(() => {
  const byStatus =
    statusFilter.value === "all"
      ? items.value
      : items.value.filter((i) => i.status === statusFilter.value);
  return missingCostOnly.value ? byStatus.filter((i) => !hasCost(i)) : byStatus;
});
const totalPages = computed(() => Math.max(1, Math.ceil(filteredItems.value.length / PAGE_SIZE)));
const pagedItems = computed(() =>
  filteredItems.value.slice(page.value * PAGE_SIZE, page.value * PAGE_SIZE + PAGE_SIZE),
);
const rangeStart = computed(() => (filteredItems.value.length === 0 ? 0 : page.value * PAGE_SIZE + 1));
const rangeEnd = computed(() => Math.min(filteredItems.value.length, (page.value + 1) * PAGE_SIZE));

watch([statusFilter, missingCostOnly], () => {
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
    router.push("/seller/onboarding?next=/seller/items");
    return;
  }
  // Bulk is where this matters most: CSV and scanner rows arrive with no
  // photographs at all, so without a check here a whole import could be
  // published against catalogue images in one click.
  const eligible = priced.filter((i) =>
    photoRequirementMet(
      photoRequirement(
        /^(PSA|CGC|TAG|BGS|Beckett|ACE)\b/i.test(i.condition || "") ? "Graded" : "Ungraded",
        i.condition,
        i.listPrice,
      ),
      i.photos?.length ?? 0,
    ),
  );
  const needPhotos = priced.length - eligible.length;

  if (!eligible.length) {
    alert(
      `None of these can be listed yet: ${needPhotos} need your own photo (graded, sealed, top condition, or over RM${HIGH_VALUE_THRESHOLD}). Add a photo from the thumbnail in the table.`,
    );
    return;
  }

  const skipped = targets.length - priced.length;
  let msg = `List ${eligible.length} item${eligible.length === 1 ? "" : "s"} for sale at their set prices?`;
  if (skipped) msg += `\n${skipped} skipped (no price set).`;
  if (needPhotos) msg += `\n${needPhotos} skipped (needs your own photo).`;
  if (!confirm(msg)) return;
  bulkBusy.value = true;
  try {
    for (const i of eligible) {
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
const statusTone = (s: string) =>
  s === "listed" ? "good" : s === "sold" ? undefined : "info";

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
// Optional cost basis. "" is what an emptied number input reports, and it
// means "not recorded", not free — see validCost.
const manualCost = ref<number | "" | null>(null);
const manualCostNote = ref("");
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
  // The remark survives "Add another card": a stack bought together shares
  // its provenance. The cost does not — carrying it over silently would put
  // the wrong figure on the next card.
  manualCost.value = null;
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
    const qty = Math.max(1, f.quantity || 1);
    // Built before resetManual() wipes the form it reads from.
    const label = [name, f.cardSet.trim(), f.cardNumber.trim() && `#${f.cardNumber.trim()}`, condition]
      .filter(Boolean)
      .join(" · ");
    const newId = await addItem({
      productId: pickedProductId.value,
      cardName: name,
      setName: f.cardSet.trim(),
      number: f.cardNumber.trim(),
      rarity: f.rarity || "",
      condition,
      quantity: qty,
      listPrice: manualPrice.value || 0,
      stockImageUrl: importedImageUrl.value,
      photos,
      notes: f.description || "",
      costPrice: typeof manualCost.value === "number" ? manualCost.value : null,
      costNote: manualCostNote.value,
      source: "manual",
    });
    if (newId) noteAdded(newId, label, qty);
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
  sessionAdds.value = [];
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
    const id = await addItem({
      productId: item.productId!,
      cardName: item.cardName!,
      setName: item.cardSet ?? "",
      number: item.cardNumber ?? "",
      rarity: item.rarity ?? "",
      listPrice: item.tcgoPrice?.market ?? 0,
      stockImageUrl: item.imageUrl ?? "",
      source: "scan",
    });
    // Same strip as manual adds, so scanning a stack and typing one in read
    // the same way.
    if (id) {
      noteAdded(
        id,
        [item.cardName, item.cardSet, item.cardNumber && `#${item.cardNumber}`]
          .filter(Boolean)
          .join(" · "),
        1,
      );
    }
    scanAdded.value++;
  }
  clearScanQueue();
};

const addOpen = ref(false);

/**
 * What was added since the panel was opened.
 *
 * Exists because the add form clears itself and stays open — which is the
 * right behaviour for adding a stack of cards, but leaves nothing on screen
 * to say it worked. Without this the only confirmation is the table further
 * down the page, and that table is exactly what we now hide while adding.
 */
const sessionAdds = ref<{ id: string; label: string; qty: number }[]>([]);
const undoBusy = ref(false);

const noteAdded = (id: string, label: string, qty: number) => {
  // Newest first — the last card added is the one you're checking.
  sessionAdds.value.unshift({ id, label, qty });
};

const undoLastAdd = async () => {
  const last = sessionAdds.value[0];
  if (!last || undoBusy.value) return;
  undoBusy.value = true;
  try {
    await removeItem(last.id);
    sessionAdds.value.shift();
  } catch {
    // Already gone (removed from the table in another tab) — drop it from the
    // strip either way rather than leaving an undo button that never works.
    sessionAdds.value.shift();
  } finally {
    undoBusy.value = false;
  }
};

/** Close the panel and put the seller back in front of what they just built. */
const finishAdding = () => {
  closeAdd();
  nextTick(() => {
    document.getElementById("inventory-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
});

const openListDialog = (item: InventoryItem) => {
  listing.value = item;
  listForm.value = {
    price: item.listPrice || 0,
    condition: item.condition || CONDITIONS[0] || "",
  };
};

// Recomputed as the seller changes price or condition in the dialog, so the
// requirement appears the moment their own input triggers it rather than
// after they press the button.
const listPhotoRule = computed(() =>
  photoRequirement(
    // Inventory rows don't carry a product type; a graded item is recorded by
    // its condition string ("PSA 10"). Treat that as graded so slabs are
    // caught from this path too.
    /^(PSA|CGC|TAG|BGS|Beckett|ACE)\b/i.test(listForm.value.condition || "")
      ? "Graded"
      : "Ungraded",
    listForm.value.condition,
    listForm.value.price,
  ),
);
// Read the photo count off the live items array, not off `listing` — that's a
// snapshot taken when the dialog opened, so adding a photo from inside the
// dialog would update Firestore and leave the warning on screen forever.
const listingLive = computed(() =>
  listing.value ? items.value.find((i) => i.id === listing.value!.id) ?? listing.value : null,
);
const listPhotoOk = computed(() =>
  photoRequirementMet(listPhotoRule.value, listingLive.value?.photos?.length ?? 0),
);

/** Jump straight to the inline uploader for the item being listed. */
const addPhotoToListingCandidate = () => {
  if (!listing.value) return;
  openPhotoPicker(listing.value);
};

const confirmList = async () => {
  if (!listing.value || !user.value || listingBusy.value) return;
  if (!sellerReady.value) {
    alert("Complete seller verification before listing.");
    router.push("/seller/onboarding?next=/seller/items");
    return;
  }
  if (!listPhotoOk.value) {
    alert(listPhotoRule.value.reason);
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
  // "" is what an emptied number input reports; it means "not recorded".
  costPrice: "" as number | "",
  costNote: "",
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
    costPrice: validCost(item.costPrice) ? item.costPrice : "",
    costNote: item.costNote || "",
  };
};

// The drawer's photo follows the live row, so a new upload shows at once.
const editingLive = computed(() =>
  items.value.find((i) => i.id === editing.value?.id) ?? editing.value,
);

// ── Phone row: view and ⋯ menu ────────────────────────────────────────
// A listed item opens its live listing; anything else has no public page,
// so tapping it opens the edit drawer instead.
const viewItem = (item: InventoryItem) => {
  if (item.status === "listed" && item.listingId) navigateTo(`/cards/${item.listingId}`);
  else openEditDialog(item);
};
const viewLabel = (item: InventoryItem) =>
  item.status === "listed" && item.listingId ? `View listing: ${item.cardName}` : `Edit ${item.cardName}`;

const menuItem = ref<InventoryItem | null>(null);
const menuAction = (fn: (item: InventoryItem) => unknown) => {
  const item = menuItem.value;
  menuItem.value = null;
  if (item) fn(item);
};

// Listed items follow the listing-edit rule: price only. Anything else must
// go through unlist → edit → relist so the live listing never drifts. The
// cost fields are the exception — they never reach the listing.
const editLocked = computed(() => editing.value?.status === "listed");

const confirmEdit = async () => {
  if (!editing.value || editBusy.value) return;
  const f = editForm.value;
  if (!f.cardName) return;
  editBusy.value = true;
  try {
    const price = Math.max(0, Number(f.listPrice) || 0);
    const cost = {
      costPrice: typeof f.costPrice === "number" ? Math.max(0, f.costPrice) : null,
      costNote: f.costNote,
    };
    await updateItem(
      editing.value.id,
      editLocked.value
        ? { listPrice: price, ...cost }
        : {
            cardName: f.cardName,
            setName: f.setName,
            number: f.number,
            rarity: f.rarity,
            condition: f.condition,
            listPrice: price,
            quantity: Math.max(1, Math.floor(Number(f.quantity) || 1)),
            notes: f.notes,
            ...cost,
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
const signedMyr = (n: number) => `${n < 0 ? "−" : "+"}${formatMyr(Math.abs(n))}`;

// An emptied cost input clears the field (null → deleted in Firestore); see
// useInventory.updateItem. Anything unparseable is treated the same way
// rather than saved as a zero-cost card.
const costFromInput = (raw: string): number | null => {
  const n = Number(raw);
  return raw.trim() === "" || !Number.isFinite(n) ? null : Math.max(0, n);
};
</script>
