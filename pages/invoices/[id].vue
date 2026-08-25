<template>
  <div class="invoice-page">
    <div v-if="loading" class="py-20 text-center text-sm text-gray-500">Loading…</div>
    <div v-else-if="!order" class="py-20 text-center text-sm text-gray-500">Order not found.</div>

    <template v-else>
      <!-- Print controls — hidden on paper -->
      <div class="no-print flex items-center justify-between gap-3 mb-6">
        <NuxtLink :to="`/orders/${order.id}`" class="text-sm text-gray-500 hover:text-ink">
          ← Back to order
        </NuxtLink>
        <button
          @click="print"
          class="px-4 py-2 rounded-lg text-sm font-bold bg-ink text-white hover:bg-gray-700 transition-colors"
        >
          Print / Save as PDF
        </button>
      </div>

      <article class="sheet">
        <header class="flex items-start justify-between gap-6 pb-5 border-b border-gray-200">
          <div>
            <p class="text-xl font-extrabold tracking-tight">TCGo</p>
            <p class="text-[11px] text-gray-500 mt-0.5">TCGo Marketplace · tcgo.shop</p>
          </div>
          <div class="text-right">
            <p class="text-lg font-bold">INVOICE</p>
            <p class="text-xs text-gray-600 font-mono">#{{ order.id.slice(0, 8).toUpperCase() }}</p>
            <p class="text-xs text-gray-500 mt-0.5">{{ issuedOn }}</p>
          </div>
        </header>

        <section class="grid grid-cols-2 gap-8 py-5 text-sm">
          <div>
            <p class="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1">Billed to</p>
            <p class="font-semibold">{{ order.deliveryAddress?.name || order.buyerName }}</p>
            <template v-if="order.deliveryAddress">
              <p class="text-gray-600">{{ order.deliveryAddress.phone }}</p>
              <p class="text-gray-600 leading-relaxed">
                {{ order.deliveryAddress.address1
                }}<template v-if="order.deliveryAddress.address2">, {{ order.deliveryAddress.address2 }}</template><br/>
                {{ order.deliveryAddress.postcode }} {{ order.deliveryAddress.city }}<br/>
                {{ stateName(order.deliveryAddress.state) }}
              </p>
            </template>
          </div>
          <div>
            <p class="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1">Sold by</p>
            <p class="font-semibold">{{ order.sellerName }}</p>
            <p class="text-gray-600">Order placed {{ placedOn }}</p>
            <p v-if="order.paidAt" class="text-gray-600">Paid {{ paidOn }}</p>
            <p v-if="order.trackingNumber" class="text-gray-600 font-mono text-xs mt-1">
              {{ order.trackingNumber }}
            </p>
          </div>
        </section>

        <table class="w-full text-sm border-t border-gray-200">
          <thead>
            <tr class="text-left text-[11px] uppercase tracking-wide text-gray-500">
              <th class="py-2 font-bold">Item</th>
              <th class="py-2 font-bold text-right w-28">Amount</th>
            </tr>
          </thead>
          <tbody class="border-t border-gray-100">
            <tr v-for="item in order.items" :key="item.cardId" class="border-b border-gray-100">
              <td class="py-2.5 pr-4">
                <p class="font-medium">{{ item.cardName }}</p>
                <p class="text-xs text-gray-500">
                  {{ [item.cardSet, item.condition].filter(Boolean).join(" · ") }}
                </p>
              </td>
              <td class="py-2.5 text-right tabular-nums">RM {{ item.price.toFixed(2) }}</td>
            </tr>
          </tbody>
        </table>

        <section class="flex justify-end pt-4">
          <div class="w-64 text-sm space-y-1">
            <div class="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span class="tabular-nums">RM {{ order.subtotal.toFixed(2) }}</span>
            </div>
            <div class="flex justify-between text-gray-600">
              <span>Shipping<template v-if="order.shippingCourier"> ({{ order.shippingCourier }})</template></span>
              <span class="tabular-nums">RM {{ order.shipping.toFixed(2) }}</span>
            </div>
            <div class="flex justify-between font-bold text-base pt-2 border-t border-gray-300">
              <span>Total</span>
              <span class="tabular-nums">RM {{ order.total.toFixed(2) }}</span>
            </div>
          </div>
        </section>

        <footer class="pt-6 mt-6 border-t border-gray-200 text-[11px] text-gray-500 leading-relaxed">
          <p>Paid online via FPX{{ order.billplzBillId ? ` · ref ${order.billplzBillId}` : "" }}.</p>
          <p class="mt-1">
            This document is computer generated and valid without a signature.
            Prices are in Malaysian Ringgit (MYR).
          </p>
        </footer>
      </article>
    </template>
  </div>
</template>

<script setup lang="ts">
import { type CompiledOrder } from "~/composables/useCompiledOrders";
import { stateName } from "~/shared/my-states";

useHead({ title: "Invoice | TCGo" });

const route = useRoute();
const { firestore } = useFirebase();

const order = ref<CompiledOrder | null>(null);
const loading = ref(true);

onMounted(async () => {
  const id = route.params.id as string;
  if (!firestore || !id) {
    loading.value = false;
    return;
  }
  const { doc, getDoc } = await import("firebase/firestore");
  const snap = await getDoc(doc(firestore, "compiledOrders", id));
  order.value = snap.exists()
    ? ({ ...snap.data(), id: snap.id } as CompiledOrder)
    : null;
  loading.value = false;
});

const fmt = (ms?: number) =>
  ms
    ? new Date(ms).toLocaleDateString("en-MY", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

const placedOn = computed(() => fmt(order.value?.createdAt));
const paidOn = computed(() => fmt(order.value?.paidAt));
const issuedOn = computed(() => fmt(order.value?.paidAt ?? order.value?.createdAt));

const print = () => window.print();
</script>

<style scoped>
/* The invoice is a document, so it stays light on screen and on paper —
   a dark-mode invoice prints as a black rectangle. */
.invoice-page {
  max-width: 48rem;
  margin: 0 auto;
  padding: 1.5rem 1rem 4rem;
  color: #111;
}
.sheet {
  background: #fff;
  color: #111;
  padding: 2rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
}
@media print {
  .no-print { display: none !important; }
  .invoice-page { padding: 0; max-width: none; }
  .sheet { border: 0; border-radius: 0; padding: 0; }
  @page { margin: 16mm; }
}
</style>
