<template>
  <div class="max-w-5xl mx-auto">
    <NuxtLink
      :to="backTo"
      class="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-zinc-400 hover:text-ink dark:hover:text-white mb-4"
    >
      ← {{ backLabel }}
    </NuxtLink>

    <div v-if="loading" class="flex justify-center py-16">
      <div class="animate-spin rounded-full h-6 w-6 border-2 border-ink/10 border-t-pokemon-red"/>
    </div>

    <div v-else-if="!order" class="surface rounded-2xl py-16 text-center">
      <p class="text-gray-500 dark:text-zinc-400">Order not found.</p>
    </div>

    <template v-else>
      <!-- Just-placed banner -->
      <div
        v-if="route.query.placed"
        class="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl p-4 flex items-center gap-3 mb-5"
      >
        <svg class="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        <div>
          <p class="font-semibold text-emerald-800 dark:text-emerald-200 text-sm">Order placed</p>
          <p class="text-xs text-emerald-700 dark:text-emerald-300">
            Complete payment below to confirm your order with the seller.
          </p>
        </div>
      </div>

      <!-- Auction win — payment deadline -->
      <div
        v-if="order.auctionId && order.status === 'pending'"
        class="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-4 mb-5"
      >
        <p class="font-semibold text-amber-900 dark:text-amber-200 text-sm">
          {{ role === "buyer" ? "You won this auction" : "Auction won — awaiting payment" }}
        </p>
        <p v-if="order.paymentDueAt" class="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
          Payment is due by {{ formatDate(order.paymentDueAt) }}. After that the result is voided and the item is released.
        </p>
        <NuxtLink
          :to="`/auctions/${order.auctionId}`"
          class="inline-block text-xs font-semibold text-amber-900 dark:text-amber-200 underline mt-1"
        >
          View the auction →
        </NuxtLink>
      </div>

      <!-- Absorbed by a merge — point both parties at the surviving order -->
      <div
        v-if="order.mergedInto"
        class="bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/20 rounded-xl p-4 mb-5"
      >
        <p class="font-semibold text-sky-900 dark:text-sky-200 text-sm">
          Merged into another order
        </p>
        <p class="text-xs text-sky-800 dark:text-sky-300 mt-0.5">
          {{
            role === "buyer"
              ? "The seller combined this with your other order — nothing was lost, your items ship together under one waybill."
              : "This order was combined into one shipment."
          }}
        </p>
        <NuxtLink
          :to="`/orders/${order.mergedInto}`"
          class="inline-block text-xs font-semibold text-sky-900 dark:text-sky-200 underline mt-1"
        >
          View the combined order →
        </NuxtLink>
      </div>

      <div class="grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-4 items-start">

        <!-- ═══ LEFT: what was bought, and what it cost ═══ -->
        <div class="space-y-4 min-w-0">

          <!-- Header -->
          <div class="surface rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-5">
            <div class="flex items-start justify-between gap-3 mb-4">
              <div class="min-w-0">
                <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
                  Order
                </p>
                <p class="text-sm text-ink dark:text-white font-mono">#{{ order.id.slice(0, 8) }}</p>
                <p class="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">{{ formatDate(order.createdAt) }}</p>
              </div>
              <span class="shrink-0 text-[11px] font-semibold px-2 py-1 rounded-full" :class="statusColor">
                {{ statusLabel }}
              </span>
            </div>

            <div class="grid grid-cols-2 gap-4 text-sm">
              <div class="min-w-0">
                <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-0.5">Buyer</p>
                <NuxtLink :to="`/profile/${order.buyerUid}`" class="font-semibold text-ink dark:text-white hover:underline truncate block">
                  {{ order.buyerName }}
                </NuxtLink>
              </div>
              <div class="min-w-0">
                <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-0.5">Seller</p>
                <NuxtLink :to="`/profile/${order.sellerUid}`" class="font-semibold text-ink dark:text-white hover:underline truncate block">
                  {{ order.sellerName }}
                </NuxtLink>
              </div>
            </div>
          </div>

          <!-- Items + money -->
          <div class="surface rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-5">
            <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-3">
              Items ({{ order.items.length }})
            </h2>
            <div class="space-y-3">
              <NuxtLink
                v-for="item in order.items"
                :key="item.cardId"
                :to="`/cards/${item.cardId}`"
                class="flex items-center gap-3 hover:opacity-80 transition-opacity"
              >
                <div class="w-14 h-14 shrink-0 rounded-lg overflow-hidden">
                  <CardImage :src="item.imageUrl" :alt="item.cardName" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="font-medium text-sm text-ink dark:text-white truncate">{{ item.cardName }}</p>
                  <p class="text-xs text-gray-500 dark:text-zinc-400 truncate">
                    {{ [item.cardSet, item.condition].filter(Boolean).join(" · ") }}
                  </p>
                </div>
                <p class="font-semibold text-sm tabular-nums text-ink dark:text-white">
                  RM {{ item.price.toFixed(2) }}
                </p>
              </NuxtLink>
            </div>

            <div class="border-t border-gray-100 dark:border-white/[0.06] mt-4 pt-3 space-y-1 text-sm">
              <div class="flex justify-between text-gray-600 dark:text-zinc-300">
                <span>Subtotal</span>
                <span class="tabular-nums">RM {{ order.subtotal.toFixed(2) }}</span>
              </div>
              <div class="flex justify-between text-gray-600 dark:text-zinc-300">
                <span>
                  Shipping<template v-if="order.shippingCourier"> · {{ order.shippingCourier }}</template>
                </span>
                <span class="tabular-nums">RM {{ order.shipping.toFixed(2) }}</span>
              </div>
              <div class="flex justify-between font-bold text-base pt-2 border-t border-gray-100 dark:border-white/[0.06]">
                <span class="text-ink dark:text-white">Total</span>
                <span class="text-pokemon-red tabular-nums">RM {{ order.total.toFixed(2) }}</span>
              </div>
            </div>
          </div>

          <!-- Invoice -->
          <div class="surface rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-5">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">Invoice</h2>
                <p class="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                  <template v-if="invoiceAvailable">
                    Tax invoice for order #{{ order.id.slice(0, 8) }}.
                  </template>
                  <template v-else>
                    Available once payment has cleared.
                  </template>
                </p>
                <p v-if="invoiceStatus" class="text-xs mt-1" :class="invoiceStatusTone">
                  {{ invoiceStatus }}
                </p>
              </div>
              <div class="shrink-0 flex gap-2">
                <button
                  @click="emailInvoice"
                  :disabled="!invoiceAvailable || emailingInvoice"
                  class="px-3 py-2 rounded-lg text-xs font-bold border border-gray-200 dark:border-white/[0.10] text-gray-700 dark:text-zinc-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {{ emailingInvoice ? "Sending…" : order.invoiceEmailedAt ? "Resend email" : "Email to me" }}
                </button>
                <button
                  @click="openInvoice"
                  :disabled="!invoiceAvailable"
                  class="px-3 py-2 rounded-lg text-xs font-bold border border-gray-200 dark:border-white/[0.10] text-gray-700 dark:text-zinc-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  View / print
                </button>
              </div>
            </div>
          </div>

          <!-- Actions. Hidden entirely when there's nothing to do — a
               delivered order leaves every button and hint false, which
               rendered an empty card. -->
          <div v-if="hasActions" class="surface rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-5">
            <div class="flex flex-wrap gap-2">
              <!-- Buyer actions -->
              <template v-if="role === 'buyer'">
                <button
                  v-if="isPayable"
                  @click="startPayment"
                  :disabled="paying"
                  class="px-4 py-2 rounded-lg text-sm font-semibold bg-pokemon-red text-white hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center gap-2"
                >
                  <span v-if="paying" class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"/>
                  Pay online (FPX) · RM {{ order.total.toFixed(2) }}
                </button>
                <button
                  v-if="order.status === 'shipped'"
                  @click="handleMarkDelivered"
                  class="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
                >
                  Mark received
                </button>
                <button
                  v-if="order.status === 'pending'"
                  @click="handleCancel"
                  class="px-4 py-2 rounded-lg text-sm font-semibold text-red-600 hover:bg-red-500/10 transition-colors"
                >
                  Cancel order
                </button>
                <button
                  v-if="canCancelPaid"
                  @click="cancelPaidOrder"
                  :disabled="cancellingOrder"
                  class="px-4 py-2 rounded-lg text-sm font-semibold text-red-600 hover:bg-red-500/10 transition-colors disabled:opacity-60"
                >
                  {{ cancellingOrder ? "Cancelling…" : "Cancel & refund" }}
                </button>
              </template>

              <!-- Seller actions -->
              <template v-if="role === 'seller'">
                <button
                  v-if="order.status === 'paid' && order.deliveryAddress && !order.shipmentOrderNo"
                  @click="bookShipment"
                  :disabled="booking"
                  class="px-4 py-2 rounded-lg text-sm font-semibold bg-pokemon-red text-white hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center gap-2"
                >
                  <span v-if="booking" class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"/>
                  {{ booking ? "Booking courier…" : "Book courier" }}
                </button>
                <button
                  v-if="order.shipmentOrderNo"
                  @click="cancelShipment"
                  :disabled="cancelling"
                  class="px-4 py-2 rounded-lg text-sm font-semibold border border-red-200 dark:border-red-500/30 text-red-600 hover:bg-red-500/10 transition-colors disabled:opacity-60"
                >
                  {{ cancelling ? "Cancelling…" : "Cancel shipment" }}
                </button>
                <button
                  v-if="canCancelPaid"
                  @click="cancelPaidOrder"
                  :disabled="cancellingOrder"
                  class="px-4 py-2 rounded-lg text-sm font-semibold text-red-600 hover:bg-red-500/10 transition-colors disabled:opacity-60"
                >
                  {{ cancellingOrder ? "Cancelling…" : "Cancel & refund buyer" }}
                </button>
                <!-- Manual fallback only. Order status normally follows the
                     courier's own scans (/api/shipping/track), so this appears
                     solely when there is no consignment to track — a booking
                     that never succeeded. Without it such an order could never
                     leave "To ship". -->
                <button
                  v-if="
                    (order.status === 'confirmed' || order.status === 'paid') &&
                    !order.trackingNumber
                  "
                  @click="shipDialogOpen = true"
                  class="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 dark:border-white/[0.10] text-gray-700 dark:text-zinc-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
                >
                  Mark shipped manually
                </button>
              </template>
            </div>

            <p v-if="order.shipmentError && role === 'seller'" class="text-xs text-amber-600 dark:text-amber-400 mt-3">
              Automatic booking didn't go through: {{ order.shipmentError }}
            </p>
            <p v-if="role === 'buyer' && isPayable" class="text-xs text-gray-500 dark:text-zinc-400 mt-3">
              Pay securely online via FPX. Your order is confirmed to the seller the moment payment clears.
            </p>
            <p v-if="order.paymentAmountMismatch" class="text-xs text-red-600 dark:text-red-400 mt-3 font-medium">
              We couldn't match the amount received against this order's total. It hasn't been settled — please contact support before paying again.
            </p>
          </div>
        </div>

        <!-- ═══ RIGHT: where it's going ═══ -->
        <div class="space-y-4 min-w-0">

          <!-- Delivery address -->
          <div class="surface rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-5">
            <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-2">
              Delivery address
            </h2>
            <template v-if="order.deliveryAddress">
              <p class="text-sm font-medium text-ink dark:text-white">{{ order.deliveryAddress.name }}</p>
              <p class="text-sm text-gray-600 dark:text-zinc-300">{{ order.deliveryAddress.phone }}</p>
              <p class="text-sm text-gray-600 dark:text-zinc-300 mt-1 leading-relaxed">
                {{ order.deliveryAddress.address1 }}<template v-if="order.deliveryAddress.address2">, {{ order.deliveryAddress.address2 }}</template><br/>
                {{ order.deliveryAddress.postcode }} {{ order.deliveryAddress.city }}<br/>
                {{ stateName(order.deliveryAddress.state) }}
              </p>
              <p class="text-[11px] text-gray-400 dark:text-zinc-500 mt-2">
                {{ order.region === "WM" ? "West Malaysia" : "East Malaysia" }}
              </p>
            </template>
            <p v-else class="text-sm text-gray-500 dark:text-zinc-400">
              No address yet — added at payment.
            </p>
          </div>

          <!-- Waybill / tracking -->
          <div class="surface rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-5">
            <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-2">
              Waybill
            </h2>

            <template v-if="order.trackingNumber || order.shipmentOrderNo">
              <!-- Waybill number — the thing buyers copy into a courier site -->
              <div v-if="order.trackingNumber" class="flex items-start gap-2">
                <div class="min-w-0">
                  <p class="font-mono font-semibold text-sm text-ink dark:text-white break-all">
                    {{ order.trackingNumber }}
                  </p>
                  <p v-if="order.shippingCarrier" class="text-xs text-gray-500 dark:text-zinc-400">
                    via {{ order.shippingCarrier }}
                  </p>
                </div>
                <button
                  @click="copyTracking"
                  class="shrink-0 text-[11px] font-semibold px-2 py-1 rounded-md border border-gray-200 dark:border-white/[0.10] text-gray-600 dark:text-zinc-300 hover:border-pokemon-red hover:text-pokemon-red transition-colors"
                >
                  {{ copied ? "Copied" : "Copy" }}
                </button>
              </div>
              <p v-else class="text-sm text-gray-500 dark:text-zinc-400">
                Booked — waiting for the courier to assign a waybill number.
              </p>

              <!-- Delivery progress — buyers only. Sellers dispatch the parcel
                   and care about the consignment note, not the courier's
                   scan-by-scan progress. -->
              <div v-if="role === 'buyer'" class="mt-4 pt-4 border-t border-gray-100 dark:border-white/[0.06]">
                <div class="flex items-center justify-between gap-2 mb-3">
                  <h3 class="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
                    Delivery progress
                  </h3>
                  <button
                    @click="loadTracking"
                    :disabled="trackingBusy"
                    class="text-[11px] font-semibold text-pokemon-red hover:underline disabled:opacity-50"
                  >
                    {{ trackingBusy ? "Refreshing…" : "Refresh" }}
                  </button>
                </div>
                <ShipmentTimeline
                  :tracking="tracking"
                  :empty-message="trackingMessage"
                />
              </div>

              <!-- Seller-only: the printable consignment note -->
              <template v-if="role === 'seller'">
                <div v-if="labelUrl" class="mt-4">
                  <button
                    @click="openLabel"
                    class="block w-full rounded-lg border border-gray-200 dark:border-white/[0.10] overflow-hidden bg-gray-50 dark:bg-white/[0.04] hover:border-pokemon-red transition-colors group"
                    title="Open full size"
                  >
                    <iframe
                      :src="`${labelUrl}#toolbar=0&navpanes=0&view=FitH`"
                      class="w-full h-44 pointer-events-none"
                      title="Waybill preview"
                    />
                    <span class="block text-[11px] font-semibold text-gray-600 dark:text-zinc-300 py-1.5 group-hover:text-pokemon-red">
                      Open full size ↗
                    </span>
                  </button>
                </div>
                <button
                  v-if="order.shipmentOrderNo"
                  @click="fetchLabel"
                  :disabled="labelBusy"
                  class="inline-flex items-center gap-1 mt-3 text-xs font-semibold text-pokemon-red hover:underline disabled:opacity-60"
                >
                  <span v-if="labelBusy" class="animate-spin rounded-full h-3 w-3 border-b-2 border-pokemon-red"/>
                  {{ labelBusy ? "Fetching…" : labelUrl ? "Refresh label" : "Get consignment note" }}
                </button>
                <p v-if="labelError" class="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                  {{ labelError }}
                </p>
              </template>
            </template>

            <template v-else>
              <p class="text-sm text-gray-500 dark:text-zinc-400">
                <template v-if="order.status === 'pending' || order.status === 'confirmed'">
                  Generated automatically once payment clears.
                </template>
                <template v-else-if="role === 'seller'">
                  Not booked yet — use "Book courier".
                </template>
                <template v-else>
                  The seller hasn't dispatched this yet.
                </template>
              </p>
            </template>
          </div>
        </div>

        <!-- Refund state. A cancelled order has to say where the money is,
             because Billplz has no refund API and it is moved by hand — a
             silent "cancelled" reads as "you have been refunded". -->
        <div
          v-if="order.status === 'cancelled' && order.refundStatus"
          class="surface rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-5"
        >
          <h2 class="text-sm font-bold text-ink dark:text-white mb-2">Refund</h2>
          <div class="flex items-baseline justify-between gap-3">
            <p class="text-sm text-gray-600 dark:text-zinc-300">
              {{ order.refundStatus === "refunded" ? "Refunded" : "Refund being processed" }}
            </p>
            <p class="text-lg font-extrabold text-ink dark:text-white tabular-nums">
              RM {{ (order.refundAmount ?? order.total ?? 0).toFixed(2) }}
            </p>
          </div>
          <p class="text-[11px] text-gray-400 dark:text-zinc-500 mt-1.5">
            {{
              order.refundStatus === "refunded"
                ? "Back on the account you paid from."
                : "Returned to the account you paid from, usually within a few working days."
            }}
          </p>
        </div>

        <!-- Settlement — seller only.
             The seller's money was previously a single net figure on the
             funds page with nothing anywhere explaining how it got there.
             Every deduction is itemised here, read off what was actually
             charged at settlement rather than recomputed from today's rate. -->
        <div
          v-if="role === 'seller' && showSettlement"
          class="surface rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-5"
        >
          <div class="flex items-center justify-between gap-2 mb-3">
            <h2 class="text-sm font-bold text-ink dark:text-white">Settlement</h2>
            <span
              class="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
              :class="settlementBadge.cls"
            >
              {{ settlementBadge.label }}
            </span>
          </div>
          <SettlementBreakdown :order="order" :hint="settlementHint" />
        </div>
      </div>
    </template>

    <!-- Ship dialog -->
    <div
      v-if="shipDialogOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      @click.self="shipDialogOpen = false"
    >
      <div class="surface rounded-2xl w-full max-w-sm p-5 border border-black/[0.06] dark:border-white/[0.08]">
        <h3 class="text-base font-bold text-ink dark:text-white mb-3">Mark as shipped</h3>
        <div class="space-y-3">
          <div>
            <label class="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">Tracking number (optional)</label>
            <input
              v-model="shipTrackingNumber"
              type="text"
              placeholder="e.g. EM123456789MY"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-sm text-ink dark:text-white"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">Carrier (optional)</label>
            <input
              v-model="shipCarrier"
              type="text"
              placeholder="e.g. Pos Laju, J&T"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-sm text-ink dark:text-white"
            />
          </div>
        </div>
        <div class="flex gap-2 mt-4">
          <button
            @click="shipDialogOpen = false"
            class="flex-1 py-2 rounded-lg text-sm font-semibold border border-gray-200 dark:border-white/[0.08] text-gray-700 dark:text-zinc-200"
          >
            Cancel
          </button>
          <button
            @click="handleShip"
            class="flex-1 py-2 rounded-lg text-sm font-semibold bg-indigo-500 text-white hover:bg-indigo-600 transition-colors"
          >
            Mark shipped
          </button>
        </div>
      </div>
    </div>

    <!-- Delivery address dialog (buyer, before online payment) -->
    <div
      v-if="addressOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      @click.self="addressOpen = false"
    >
      <div class="surface rounded-2xl w-full max-w-md p-5 border border-black/[0.06] dark:border-white/[0.08] max-h-[90vh] overflow-y-auto">
        <h3 class="text-base font-bold text-ink dark:text-white mb-1">Delivery address</h3>
        <p class="text-xs text-gray-500 dark:text-zinc-400 mb-4">Where should the seller ship this order?</p>
        <form @submit.prevent="saveAddressAndPay" class="space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">Full name <span class="text-pokemon-red">*</span></label>
              <input v-model="addr.name" type="text" required class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-sm text-ink dark:text-white"/>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">Phone <span class="text-pokemon-red">*</span></label>
              <input v-model="addr.phone" type="tel" required class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-sm text-ink dark:text-white"/>
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">Address line 1 <span class="text-pokemon-red">*</span></label>
            <input v-model="addr.address1" type="text" required class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-sm text-ink dark:text-white"/>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">Address line 2</label>
            <input v-model="addr.address2" type="text" class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-sm text-ink dark:text-white"/>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label class="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">Postcode <span class="text-pokemon-red">*</span></label>
              <input v-model="addr.postcode" type="text" inputmode="numeric" pattern="[0-9]{5}" required class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-sm text-ink dark:text-white tabular-nums"/>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">City <span class="text-pokemon-red">*</span></label>
              <input v-model="addr.city" type="text" required class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-sm text-ink dark:text-white"/>
            </div>
            <div class="col-span-2 sm:col-span-1">
              <label class="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">State <span class="text-pokemon-red">*</span></label>
              <select v-model="addr.state" required class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-sm text-ink dark:text-white">
                <option value="">Select…</option>
                <option v-for="s in MY_STATES" :key="s.code" :value="s.code">{{ s.name }}</option>
              </select>
            </div>
          </div>
          <div class="flex gap-2 pt-1">
            <button type="button" @click="addressOpen = false" class="flex-1 py-2 rounded-lg text-sm font-semibold border border-gray-200 dark:border-white/[0.08] text-gray-700 dark:text-zinc-200">Cancel</button>
            <button
              type="submit"
              :disabled="paying"
              class="flex-1 py-2 rounded-lg text-sm font-semibold bg-pokemon-red text-white hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              <span v-if="paying" class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"/>
              Continue to payment
            </button>
          </div>
        </form>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import {
  type CompiledOrder,
  compiledOrderStatusLabel,
  compiledOrderStatusColor,
} from "~/composables/useCompiledOrders";
import { MY_STATES, stateName } from "~/composables/useSellerKyc";
import {
  isPayoutTrackable,
  payoutEligibleAt,
  PAYOUT_HOLD_DAYS,
} from "~/shared/payouts";

useHead({ title: "Order | TCGo Marketplace" });

const route = useRoute();
const router = useRouter();
const { user } = useAuth();
const { firestore } = useFirebase();
const { authedFetch } = useAuthedFetch();
const {
  getCompiledOrder,
  markShipped,
  markDelivered,
  cancelOrder,
} = useCompiledOrders();

const orderId = computed(() => route.params.id as string);
const order = ref<CompiledOrder | null>(null);
const loading = ref(true);

// Subscribe to live updates so status changes from the other party are reflected.
let unsub: (() => void) | null = null;

const subscribe = async () => {
  if (!firestore || !orderId.value) return;
  loading.value = true;
  const { doc, onSnapshot } = await import("firebase/firestore");
  unsub?.();
  unsub = onSnapshot(doc(firestore, "compiledOrders", orderId.value), (snap) => {
    order.value = snap.exists()
      ? ({ ...snap.data(), id: snap.id } as CompiledOrder)
      : null;
    loading.value = false;
  });
};

onMounted(subscribe);
watch(orderId, subscribe);
onBeforeUnmount(() => unsub?.());

const role = computed<"buyer" | "seller" | null>(() => {
  if (!order.value || !user.value) return null;
  if (order.value.buyerUid === user.value.uid) return "buyer";
  if (order.value.sellerUid === user.value.uid) return "seller";
  return null;
});

// One order page serves both sides, so "back" has to mean different things.
// It was hardcoded to the buyer's list, which sent a seller reviewing their
// own sale to a purchases tab that will never contain it.
//
// Driven off `role` rather than the previous route: role is a fact about this
// order, whereas history is empty on a hard refresh or a link opened from an
// email, which is exactly when being dumped somewhere wrong is most annoying.
// `role` is null until the order loads, and this link renders above the
// spinner — so fall back to where the user actually came from for that first
// moment, rather than flashing the buyer destination at a seller.
const cameFromSeller = computed(() =>
  String((router.options.history.state?.back as string) || "").startsWith("/seller"),
);
const viewingAsSeller = computed(() =>
  role.value ? role.value === "seller" : cameFromSeller.value,
);

const backTo = computed(() =>
  viewingAsSeller.value ? "/seller/orders" : "/activity?tab=purchases",
);
const backLabel = computed(() =>
  viewingAsSeller.value ? "Back to sales" : "Back to orders",
);

// Mirrors the v-ifs inside the actions card. Kept adjacent to them so a new
// button added there without updating this shows up as a missing card rather
// than silently reintroducing the empty one.
const buyerActions = computed(() => {
  const o = order.value;
  if (!o || role.value !== "buyer") return false;
  return (
    isPayable.value ||
    o.status === "shipped" ||
    o.status === "pending" ||
    o.status === "confirmed"
  );
});

const sellerActions = computed(() => {
  const o = order.value;
  if (!o || role.value !== "seller") return false;
  return (
    (o.status === "paid" && !!o.deliveryAddress && !o.shipmentOrderNo) ||
    !!o.shipmentOrderNo ||
    o.status === "confirmed" ||
    o.status === "paid"
  );
});

const actionHints = computed(() => {
  const o = order.value;
  if (!o) return false;
  return (
    (!!o.shipmentError && role.value === "seller") ||
    (role.value === "buyer" && isPayable.value) ||
    !!o.paymentAmountMismatch
  );
});

const hasActions = computed(
  () => buyerActions.value || sellerActions.value || actionHints.value,
);

const statusLabel = computed(() =>
  order.value ? compiledOrderStatusLabel(order.value.status) : "",
);
const statusColor = computed(() =>
  order.value ? compiledOrderStatusColor(order.value.status) : "",
);

const formatDate = (ts: number) =>
  new Date(ts).toLocaleString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

// Ship dialog state
const shipDialogOpen = ref(false);
const shipTrackingNumber = ref("");
const shipCarrier = ref("");

const handleShip = async () => {
  if (!order.value) return;
  await markShipped(
    order.value.id,
    shipTrackingNumber.value.trim() || undefined,
    shipCarrier.value.trim() || undefined,
  );
  shipDialogOpen.value = false;
};

const handleMarkDelivered = async () => {
  if (!order.value) return;
  if (!confirm("Confirm you received this order?")) return;
  await markDelivered(order.value.id);
};

const handleCancel = async () => {
  if (!order.value) return;
  if (!confirm("Cancel this order?")) return;
  await cancelOrder(order.value.id);
};

// ── Online payment (Billplz FPX) ──────────────────────────────────────
// Payable until the money is in: a seller confirming a manual order must not
// strand a buyer who intended to pay by FPX. Mirrors PAYABLE_STATUSES on
// /api/billplz/create-bill.
const isPayable = computed(
  () =>
    !!order.value &&
    (order.value.status === "pending" || order.value.status === "confirmed") &&
    !order.value.paymentAmountMismatch,
);

const paying = ref(false);
const addressOpen = ref(false);
const addr = ref({
  name: "",
  phone: "",
  address1: "",
  address2: "",
  postcode: "",
  city: "",
  state: "",
});

const { profile: myProfile } = useMyProfile();

// ── Cancel a paid order ──
// Either side can, while the money is in and the parcel hasn't gone. The
// server stops the courier first and refuses the whole thing if the courier
// won't release it — a cancelled order whose parcel still ships is the one
// outcome with no clean recovery.
const cancellingOrder = ref(false);
const canCancelPaid = computed(() => {
  const o = order.value as any;
  if (!o || !role.value) return false;
  return o.status === "paid" || o.status === "confirmed";
});

const cancelPaidOrder = async () => {
  const o = order.value as any;
  if (!o || cancellingOrder.value) return;
  const total = (o.total ?? 0).toFixed(2);
  const warning = o.shipmentOrderNo
    ? "\n\nThe booked waybill will be cancelled too."
    : "";
  if (
    !confirm(
      `Cancel this order and refund RM ${total} to the buyer?${warning}\n\nThe cards go back on sale.`,
    )
  ) {
    return;
  }
  cancellingOrder.value = true;
  try {
    await authedFetch("/api/orders/cancel", {
      method: "POST",
      body: { orderId: o.id },
    });
  } catch (e: any) {
    alert(e?.data?.message || e?.message || "Couldn't cancel this order.");
  } finally {
    cancellingOrder.value = false;
  }
};

// ── Settlement ────────────────────────────────────────────────────────
// Only online orders carry a settlement: manual and POS sales never enter
// the payout rail, so there is nothing for us to have deducted.
const showSettlement = computed(
  () => !!order.value && isPayoutTrackable(order.value as any),
);

const settlementBadge = computed(() => {
  const o = order.value as any;
  const status = o?.payoutStatus ?? "pending";
  if (status === "paid")
    return { label: "Paid out", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" };
  if (status === "queued" || status === "processing")
    return { label: "Payout in progress", cls: "bg-blue-500/10 text-blue-700 dark:text-blue-400" };
  const eligibleAt = payoutEligibleAt(o);
  if (eligibleAt !== null && Date.now() >= eligibleAt)
    return { label: "Available", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" };
  return { label: "Locked", cls: "bg-ink/[0.06] dark:bg-white/[0.08] text-ink-muted dark:text-zinc-400" };
});

const settlementHint = computed(() => {
  const o = order.value as any;
  const status = o?.payoutStatus ?? "pending";
  if (status === "paid") return "Paid out to your bank account.";
  if (status === "queued" || status === "processing")
    return "Included in a payout that's on its way to your bank.";
  const eligibleAt = payoutEligibleAt(o);
  if (eligibleAt === null)
    return `Unlocks ${PAYOUT_HOLD_DAYS} days after the parcel is delivered.`;
  if (Date.now() >= eligibleAt) return "Ready to withdraw from your Funds page.";
  const d = new Date(eligibleAt);
  return `Unlocks on ${d.toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}.`;
});

// The delivery address saved in settings, if it's complete enough to ship to.
// Postcode and state are the two the courier quote actually needs.
const profileAddress = computed(() => {
  const p = myProfile.value;
  if (!p?.deliveryAddress1 || !p?.deliveryPostcode || !p?.deliveryState) return null;
  return {
    name: p.deliveryName || p.customName || p.displayName || "",
    phone: p.deliveryPhone || p.whatsappNumber || p.phone || "",
    address1: p.deliveryAddress1,
    address2: p.deliveryAddress2 || "",
    postcode: p.deliveryPostcode,
    city: p.deliveryCity || "",
    state: p.deliveryState,
  };
});

const startPayment = async () => {
  if (!order.value) return;

  // Already captured on the order — nothing to ask for.
  if (order.value.deliveryAddress) {
    void createBillAndRedirect();
    return;
  }

  // Otherwise use the address from settings rather than asking again. It's
  // the same address the cart quoted shipping against, so re-prompting was
  // both redundant and a chance to enter something that doesn't match.
  if (profileAddress.value) {
    paying.value = true;
    try {
      const { doc: docRef, updateDoc } = await import("firebase/firestore");
      await updateDoc(docRef(firestore!, "compiledOrders", order.value.id), {
        deliveryAddress: profileAddress.value,
      });
      await createBillAndRedirect();
    } catch (e: any) {
      paying.value = false;
      alert(e?.data?.message || e?.message || "Couldn't start the payment.");
    }
    return;
  }

  // No saved address anywhere — ask, prefilled with whatever we do know.
  addr.value = {
    name: myProfile.value?.customName || order.value.buyerName || "",
    phone: myProfile.value?.whatsappNumber || myProfile.value?.phone || "",
    address1: "",
    address2: "",
    postcode: "",
    city: "",
    state: "",
  };
  addressOpen.value = true;
};

const saveAddressAndPay = async () => {
  if (!order.value || !firestore) return;
  paying.value = true;
  try {
    const { doc: docRef, updateDoc } = await import("firebase/firestore");
    await updateDoc(docRef(firestore, "compiledOrders", order.value.id), {
      deliveryAddress: {
        name: addr.value.name.trim(),
        phone: addr.value.phone.trim(),
        address1: addr.value.address1.trim(),
        address2: addr.value.address2.trim(),
        postcode: addr.value.postcode.trim(),
        city: addr.value.city.trim(),
        state: addr.value.state,
      },
    });
    await createBillAndRedirect();
  } catch (e: any) {
    alert(e?.data?.message || e?.message || "Couldn't start the payment.");
    paying.value = false;
  }
};

// ── Shipment (seller) ─────────────────────────────────────────────────
// One click: the service was chosen and paid for at checkout, so there's no
// rate picker here.
const booking = ref(false);
const bookShipment = async () => {
  if (!order.value || booking.value) return;
  if (!confirm("Book the courier for this order? This charges the platform's shipping account.")) return;
  booking.value = true;
  try {
    await authedFetch("/api/shipping/book", {
      method: "POST",
      body: { orderId: order.value.id },
    });
    // The label is a PDF, fetched separately as a blob.
    await fetchLabel();
  } catch (e: any) {
    alert(e?.data?.message || "Couldn't book the courier.");
  } finally {
    booking.value = false;
  }
};

// Invoice is only meaningful once money has actually changed hands.
const invoiceAvailable = computed(
  () => !!order.value && ["paid", "shipped", "delivered"].includes(order.value.status),
);
// Emailing the invoice. Sandbox sends are captured by Mailtrap and never
// reach the buyer, so that's said plainly rather than reported as "sent".
const emailingInvoice = ref(false);
const invoiceSendResult = ref<{ sent: boolean; sandbox?: boolean; error?: string } | null>(null);

const emailInvoice = async () => {
  if (!order.value || emailingInvoice.value) return;
  emailingInvoice.value = true;
  invoiceSendResult.value = null;
  try {
    const res = await authedFetch<{ sent: boolean; sandbox?: boolean }>(
      "/api/invoices/send",
      { method: "POST", body: { orderId: order.value.id } },
    );
    invoiceSendResult.value = { sent: res.sent, sandbox: res.sandbox };
  } catch (e: any) {
    invoiceSendResult.value = {
      sent: false,
      error: e?.data?.message || "Couldn't send the invoice.",
    };
  } finally {
    emailingInvoice.value = false;
  }
};

const invoiceStatus = computed(() => {
  const r = invoiceSendResult.value;
  if (r?.error) return r.error;
  if (r?.sent) {
    return r.sandbox
      ? "Captured in the Mailtrap sandbox — not delivered to a real inbox."
      : "Sent. Check your inbox.";
  }
  const o = order.value;
  if (!o?.invoiceEmailedAt) return "";
  const when = formatDate(o.invoiceEmailedAt);
  return o.invoiceEmailSandbox
    ? `Captured in the sandbox on ${when} — not delivered.`
    : `Emailed to ${o.invoiceEmailedTo || "you"} on ${when}.`;
});

const invoiceStatusTone = computed(() => {
  const r = invoiceSendResult.value;
  if (r?.error) return "text-red-600 dark:text-red-400";
  if (order.value?.invoiceEmailSandbox || r?.sandbox)
    return "text-amber-600 dark:text-amber-400";
  return "text-emerald-600 dark:text-emerald-400";
});

const openInvoice = () => {
  if (!order.value || !invoiceAvailable.value) return;
  window.open(`/invoices/${order.value.id}`, "_blank", "noopener");
};

const cancelling = ref(false);
const cancelShipment = async () => {
  if (!order.value || cancelling.value) return;
  if (
    !confirm(
      "Cancel this shipment with the courier?\n\nOnly possible before a courier is assigned. Delyva does not guarantee the shipping charge is credited back.",
    )
  )
    return;
  cancelling.value = true;
  try {
    await authedFetch("/api/shipping/cancel", {
      method: "POST",
      body: { orderId: order.value.id },
    });
  } catch (e: any) {
    alert(e?.data?.message || "Couldn't cancel the shipment.");
  } finally {
    cancelling.value = false;
  }
};

// ── Courier tracking ──────────────────────────────────────────────────
// Loaded on demand and on arrival, for buyer and seller alike. The buyer is
// the one who wants to know where the parcel is, but the call also advances
// the order's status from the courier's scans, so the seller must be able to
// make it too — otherwise an order only moves when the buyer looks at it.
const tracking = ref<any>(null);
const trackingBusy = ref(false);
const trackingMessage = ref("No courier updates yet.");

const loadTracking = async () => {
  if (!role.value) return;
  if (!order.value?.trackingNumber || trackingBusy.value) return;
  trackingBusy.value = true;
  try {
    const res = await authedFetch<{ available: boolean; reason?: string; tracking?: any }>(
      "/api/shipping/track",
      { method: "POST", body: { orderId: order.value.id } },
    );
    if (res.available && res.tracking) {
      tracking.value = res.tracking;
    } else {
      tracking.value = null;
      trackingMessage.value =
        res.reason || "The courier hasn't scanned this parcel yet.";
    }
  } catch (e: any) {
    tracking.value = null;
    trackingMessage.value =
      e?.data?.message || "Couldn't load tracking just now.";
  } finally {
    trackingBusy.value = false;
  }
};

// Fetch once a tracking number exists (it appears after booking) and we know
// who is looking — role resolves asynchronously with the order.
watch(
  [() => order.value?.trackingNumber, role],
  ([n, r]) => {
    if (n && r) void loadTracking();
  },
  { immediate: true },
);

const copied = ref(false);
const copyTracking = async () => {
  const n = order.value?.trackingNumber;
  if (!n) return;
  try {
    await navigator.clipboard.writeText(n);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1500);
  } catch {
    /* clipboard blocked — the number is selectable on screen anyway */
  }
};

// Delyva returns the label as a PDF document, so it's fetched as a blob and
// held as an object URL. Never treat the response as a link — an earlier
// version did, and the browser navigated to a megabyte of PDF bytes.
const labelBusy = ref(false);
const labelError = ref("");
const labelUrl = ref("");

const revokeLabel = () => {
  if (labelUrl.value) URL.revokeObjectURL(labelUrl.value);
  labelUrl.value = "";
};

const fetchLabel = async () => {
  if (!order.value || labelBusy.value) return;
  labelBusy.value = true;
  labelError.value = "";
  try {
    const blob = await authedFetch<Blob>("/api/shipping/label", {
      method: "POST",
      body: { orderId: order.value.id },
      responseType: "blob",
    });
    revokeLabel();
    labelUrl.value = URL.createObjectURL(blob);
  } catch (e: any) {
    labelError.value =
      e?.data?.message || "The label isn't ready yet — try again in a moment.";
  } finally {
    labelBusy.value = false;
  }
};

const openLabel = () => {
  if (labelUrl.value) window.open(labelUrl.value, "_blank", "noopener");
};

// Pull the label in as soon as a seller opens a booked order. Bookings now
// happen automatically in the payment webhook, so there's no client-side
// moment to fetch it — without this the seller just sees a button and
// reasonably concludes no label was generated.
watch(
  [() => order.value?.shipmentOrderNo, role],
  ([shipmentNo, r]) => {
    if (shipmentNo && r === "seller" && !labelUrl.value && !labelBusy.value) {
      void fetchLabel();
    }
  },
  { immediate: true },
);

onBeforeUnmount(revokeLabel);

const createBillAndRedirect = async () => {
  if (!order.value) return;
  paying.value = true;
  try {
    const res = await authedFetch<{ url: string }>("/api/billplz/create-bill", {
      method: "POST",
      body: { orderId: order.value.id },
    });
    if (res.url) window.location.href = res.url;
  } catch (e: any) {
    alert(e?.data?.message || "Couldn't start the payment. Please try again.");
    paying.value = false;
  }
};
</script>
