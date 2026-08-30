<template>
  <div class="max-w-3xl mx-auto">
    <h1 class="text-2xl font-bold mb-2 text-ink dark:text-white">Shopping Cart</h1>
    <p class="text-sm text-gray-500 dark:text-zinc-400 mb-6">
      Items from the same seller are combined into a single order with one shipping fee.
    </p>

    <div v-if="items.length === 0" class="text-center py-16">
      <p class="text-gray-500 dark:text-zinc-400 text-lg">Your cart is empty.</p>
      <NuxtLink to="/" class="text-pokemon-blue hover:underline mt-2 inline-block text-sm">
        Browse cards →
      </NuxtLink>
    </div>

    <template v-else>
      <!-- Delivery address — shipping can't be quoted without it -->
      <div class="surface rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-4 mb-4">
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-1">
          Deliver to
        </p>
        <template v-if="hasAddress">
          <p class="text-sm text-ink dark:text-white">{{ addressLine }}</p>
          <NuxtLink to="/profile" class="text-xs font-semibold text-pokemon-red hover:underline">
            Change address →
          </NuxtLink>
        </template>
        <template v-else>
          <p class="text-sm text-gray-500 dark:text-zinc-400">
            Add a delivery address to see shipping costs.
          </p>
          <NuxtLink to="/profile" class="text-xs font-semibold text-pokemon-red hover:underline">
            Add delivery address →
          </NuxtLink>
        </template>
      </div>

      <!-- Selection bar: tick cards (or a whole seller) and remove in one go -->
      <div
        class="flex items-center justify-between gap-3 mb-3 px-1 text-xs"
      >
        <label class="inline-flex items-center gap-2 text-gray-600 dark:text-zinc-300 cursor-pointer select-none">
          <input
            type="checkbox"
            :checked="allSelected"
            :indeterminate="someSelected && !allSelected"
            @change="toggleAll"
            class="rounded"
            aria-label="Select all items"
          />
          <span v-if="selectedCount">{{ selectedCount }} of {{ items.length }} selected</span>
          <span v-else>Select all</span>
        </label>
        <div class="flex items-center gap-3">
          <button
            v-if="someSelected"
            @click="clearSelection"
            class="text-gray-500 dark:text-zinc-400 hover:text-ink dark:hover:text-white"
          >
            Clear selection
          </button>
          <button
            :disabled="!someSelected"
            @click="removeSelected"
            class="font-semibold text-red-500 hover:text-red-700 disabled:opacity-40 disabled:hover:text-red-500"
          >
            Remove selected{{ selectedCount ? ` (${selectedCount})` : "" }}
          </button>
        </div>
      </div>

      <!-- Compiled-order previews (one per seller) -->
      <div class="space-y-4 mb-6">
        <div
          v-for="group in groupedBySeller"
          :key="group.sellerUid"
          class="surface rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-4"
        >
          <div class="flex items-center justify-between mb-3">
            <label class="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                :checked="groupState(group) === 'all'"
                :indeterminate="groupState(group) === 'some'"
                @change="toggleGroup(group)"
                class="rounded"
                :aria-label="`Select all items from ${group.sellerName}`"
              />
              <div>
                <!-- "Compiled order" is what we call this internally, after
                     the compiledOrders collection. A buyer has no idea what it
                     means; they want to know who they're buying from. -->
                <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
                  Sold by
                </p>
                <NuxtLink
                  :to="`/profile/${group.sellerUid}`"
                  class="font-semibold text-ink dark:text-white text-sm hover:underline"
                  @click.stop
                >
                  {{ group.sellerName }}
                </NuxtLink>
              </div>
            </label>
            <div class="flex items-center gap-3 text-xs">
              <span class="text-gray-500 dark:text-zinc-400">
                {{ group.items.length }} {{ group.items.length === 1 ? "item" : "items" }}
              </span>
              <button
                @click="removeGroup(group)"
                class="text-red-500 hover:text-red-700"
                :title="`Remove all items from ${group.sellerName}`"
              >
                Remove seller
              </button>
            </div>
          </div>

          <div class="space-y-2">
            <div
              v-for="item in group.items"
              :key="item.id"
              class="flex gap-3 items-center rounded-lg -mx-1 px-1 transition-colors"
              :class="selected.has(item.id) ? 'bg-pokemon-red/[0.04]' : ''"
            >
              <input
                type="checkbox"
                :checked="selected.has(item.id)"
                @change="toggleOne(item.id)"
                class="rounded shrink-0"
                :aria-label="`Select ${item.cardName}`"
              />
              <div class="w-14 h-14 shrink-0 rounded-lg overflow-hidden">
                <CardImage :src="item.imageUrl" :alt="item.cardName" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="font-medium text-sm truncate text-ink dark:text-white">{{ item.cardName }}</p>
                <p class="text-xs text-gray-500 dark:text-zinc-400 truncate">
                  {{ [item.cardSet, item.condition].filter(Boolean).join(" · ") }}
                </p>
              </div>
              <div class="text-right">
                <p class="font-semibold text-sm tabular-nums text-ink dark:text-white">
                  RM {{ item.price.toFixed(2) }}
                </p>
                <button
                  @click="removeFromCart(item.id)"
                  class="text-[11px] text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>

          <div class="border-t border-gray-100 dark:border-white/[0.06] mt-3 pt-3 space-y-1 text-xs">
            <div class="flex justify-between text-gray-600 dark:text-zinc-300">
              <span>Subtotal</span>
              <span class="tabular-nums">RM {{ group.subtotal.toFixed(2) }}</span>
            </div>
            <div class="flex justify-between text-gray-600 dark:text-zinc-300">
              <span>
                <template v-if="joinsFor(group.sellerUid)">Combine</template
                ><template v-else>Shipping</template
                ><template v-if="quoteFor(group.sellerUid)?.courier && !joinsFor(group.sellerUid)">
                  · {{ quoteFor(group.sellerUid)!.courier }}</template>
              </span>
              <span v-if="quotesLoading" class="text-gray-400 dark:text-zinc-500">Calculating…</span>
              <span
                v-else-if="joinsFor(group.sellerUid)"
                class="tabular-nums font-semibold text-emerald-600 dark:text-emerald-400"
              >
                RM {{ groupShipping(group).toFixed(2) }}
              </span>
              <span v-else-if="quoteFor(group.sellerUid)" class="tabular-nums">
                RM {{ groupShipping(group).toFixed(2) }}
              </span>
              <span v-else class="text-gray-400 dark:text-zinc-500">—</span>
            </div>

            <!-- A zero shipping line with no explanation reads as a bug, and
                 the buyer is owed the reason: they already paid postage on a
                 parcel from this seller that hasn't gone out yet. -->
            <p
              v-if="joinsFor(group.sellerUid)"
              class="flex items-start gap-1.5 text-[11px] leading-relaxed text-emerald-700 dark:text-emerald-400"
            >
              <svg class="w-3.5 h-3.5 shrink-0 mt-px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Ships with your existing order from {{ group.sellerName }}, so
              you pay RM {{ groupShipping(group).toFixed(2) }} instead of full
              postage. Everything arrives in one parcel.
            </p>
            <p v-if="quoteError(group.sellerUid)" class="text-[11px] text-amber-600 dark:text-amber-400">
              {{ quoteError(group.sellerUid) }}
            </p>
            <div class="flex justify-between font-bold text-sm pt-1 border-t border-gray-100 dark:border-white/[0.06]">
              <span class="text-ink dark:text-white">Order total</span>
              <span class="text-pokemon-red tabular-nums">
                RM {{ (group.subtotal + groupShipping(group)).toFixed(2) }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Grand summary + checkout -->
      <div class="surface rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-5">
        <div class="space-y-1 text-sm mb-4">
          <div class="flex justify-between text-gray-600 dark:text-zinc-300">
            <span>Items ({{ items.length }})</span>
            <span class="tabular-nums">RM {{ cartTotal.toFixed(2) }}</span>
          </div>
          <div class="flex justify-between text-gray-600 dark:text-zinc-300">
            <span>Total shipping ({{ groupedBySeller.length }} {{ groupedBySeller.length === 1 ? "shipment" : "shipments" }})</span>
            <span class="tabular-nums">RM {{ totalShipping.toFixed(2) }}</span>
          </div>
          <div class="flex justify-between font-bold text-base pt-2 border-t border-gray-100 dark:border-white/[0.06]">
            <span class="text-ink dark:text-white">Grand total</span>
            <span class="text-pokemon-red tabular-nums">RM {{ grandTotal.toFixed(2) }}</span>
          </div>
        </div>

        <div v-if="!user">
          <p class="text-sm text-gray-500 dark:text-zinc-400 text-center mb-2">Sign in to place orders</p>
          <button
            @click="signInWithGoogle"
            class="w-full bg-gray-900 text-white py-3 rounded-lg font-bold hover:bg-gray-700 transition-colors"
          >
            Sign in with Google
          </button>
        </div>

        <div v-else>
          <button
            @click="handlePlaceOrders"
            :disabled="placing || !canCheckout"
            class="w-full bg-pokemon-red text-white py-3 rounded-lg font-bold hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            <span v-if="placing" class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"/>
            {{ checkoutLabel }}
          </button>
          <p class="text-xs text-gray-500 dark:text-zinc-400 text-center mt-2">
            You'll pay each seller securely online (FPX) after placing the order.
          </p>
        </div>
      </div>

      <button
        @click="clearCart"
        class="text-sm text-gray-400 dark:text-zinc-500 hover:text-red-500 mt-4 block mx-auto"
      >
        Clear cart
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { CartItem } from "~/composables/useCart";
import type { QuotedShipping } from "~/composables/useCompiledOrders";
import { stateName } from "~/shared/my-states";
import { regionForState } from "~/shared/shipping";

useHead({ title: "Cart | TCGo Marketplace" });

const router = useRouter();
const { items, cartTotal, removeFromCart, clearCart } = useCart();
const { user, signInWithGoogle } = useAuth();
const { profile } = useMyProfile();
const { createCompiledOrders } = useCompiledOrders();

const { authedFetch } = useAuthedFetch();

const placing = ref(false);

// ── Multi-select removal ──────────────────────────────────────────────
// Tick individual cards, or a whole seller via the group-header checkbox,
// then remove in one go. Selection is pruned whenever the cart changes so a
// removed item can't linger as a phantom "selected" id.
const selected = ref(new Set<string>());
const selectedCount = computed(
  () => items.value.filter((i) => selected.value.has(i.id)).length,
);
const someSelected = computed(() => selectedCount.value > 0);
const allSelected = computed(
  () => items.value.length > 0 && selectedCount.value === items.value.length,
);
const toggleOne = (id: string) => {
  const next = new Set(selected.value);
  next.has(id) ? next.delete(id) : next.add(id);
  selected.value = next;
};
const toggleAll = () => {
  selected.value = allSelected.value
    ? new Set()
    : new Set(items.value.map((i) => i.id));
};
const clearSelection = () => {
  selected.value = new Set();
};
const groupState = (g: { items: CartItem[] }): "none" | "some" | "all" => {
  const n = g.items.filter((i) => selected.value.has(i.id)).length;
  if (n === 0) return "none";
  return n === g.items.length ? "all" : "some";
};
const toggleGroup = (g: { items: CartItem[] }) => {
  const next = new Set(selected.value);
  const ids = g.items.map((i) => i.id);
  if (groupState(g) === "all") ids.forEach((id) => next.delete(id));
  else ids.forEach((id) => next.add(id));
  selected.value = next;
};
const removeSelected = () => {
  for (const id of [...selected.value]) removeFromCart(id);
  selected.value = new Set();
};
const removeGroup = (g: { items: CartItem[]; sellerName: string }) => {
  if (!confirm(`Remove all ${g.items.length} items from ${g.sellerName}?`)) return;
  for (const it of g.items) removeFromCart(it.id);
};
watch(items, (list) => {
  const live = new Set(list.map((i) => i.id));
  if ([...selected.value].some((id) => !live.has(id))) {
    selected.value = new Set([...selected.value].filter((id) => live.has(id)));
  }
});

// ── Delivery address ──────────────────────────────────────────────────
// Shipping is quoted live from each seller's pickup postcode to the buyer's
// address, so without an address there is nothing to quote.
const destination = computed(() => {
  const p = profile.value;
  if (!p?.deliveryPostcode || !p?.deliveryState) return null;
  return {
    address1: p.deliveryAddress1 || "",
    city: p.deliveryCity || "",
    state: p.deliveryState,
    postcode: p.deliveryPostcode,
  };
});
const hasAddress = computed(() => !!destination.value);
const addressLine = computed(() => {
  const p = profile.value;
  if (!p) return "";
  return [p.deliveryAddress1, p.deliveryAddress2, `${p.deliveryPostcode || ""} ${p.deliveryCity || ""}`.trim(), stateName(p.deliveryState)]
    .filter(Boolean)
    .join(", ");
});

// ── Live shipping quotes, one per seller ──────────────────────────────
interface GroupQuote {
  shipping: number;
  courier: string;
  serviceId: string;
  serviceCode: string;
  quotedRate: number;
  joinsOrderId?: string | null;
}
const quotes = ref<Record<string, GroupQuote>>({});
const quoteErrors = ref<Record<string, string>>({});
// Short id of the parcel a group is joining, for the line that explains why
// its shipping is free.
const joinsOrder = ref<Record<string, string>>({});
const joinsFor = (sellerUid: string): string => joinsOrder.value[sellerUid] || "";
const quotesLoading = ref(false);

const quoteFor = (sellerUid: string): GroupQuote | undefined => quotes.value[sellerUid];
const quoteError = (sellerUid: string): string => quoteErrors.value[sellerUid] || "";

const refreshQuotes = async () => {
  const dest = destination.value;
  if (!dest || !user.value || !groupedBySeller.value.length) {
    quotes.value = {};
    quoteErrors.value = {};
    return;
  }
  quotesLoading.value = true;
  const nextQuotes: Record<string, GroupQuote> = {};
  const nextErrors: Record<string, string> = {};
  const joinsBySeller: Record<string, string> = {};
  try {
    await Promise.all(
      groupedBySeller.value.map(async (g) => {
        try {
          const res = await authedFetch<{
            available: boolean;
            reason?: string;
            shipping?: number;
            courier?: string;
            serviceId?: string;
            serviceCode?: string;
            quotedRate?: number;
            joinsOrderId?: string;
            joinsOrderShortId?: string;
          }>("/api/shipping/quote", {
            method: "POST",
            body: {
              sellerUid: g.sellerUid,
              itemCount: g.items.length,
              destination: dest,
            },
          });
          if (res.available && res.shipping != null) {
            nextQuotes[g.sellerUid] = {
              shipping: res.shipping,
              courier: res.courier || "",
              serviceId: res.serviceId || "",
              serviceCode: res.serviceCode || "",
              quotedRate: res.quotedRate ?? 0,
              joinsOrderId: res.joinsOrderId ?? null,
            };
            if (res.joinsOrderShortId) {
              joinsBySeller[g.sellerUid] = res.joinsOrderShortId;
            }
          } else {
            nextErrors[g.sellerUid] = res.reason || "Shipping unavailable for this seller.";
          }
        } catch (e: any) {
          nextErrors[g.sellerUid] =
            e?.data?.message || "Couldn't get a shipping rate for this seller.";
        }
      }),
    );
  } finally {
    quotes.value = nextQuotes;
    quoteErrors.value = nextErrors;
    joinsOrder.value = joinsBySeller;
    quotesLoading.value = false;
  }
};

interface SellerGroup {
  sellerUid: string;
  sellerName: string;
  items: CartItem[];
  subtotal: number;
  shippingWM: number;
  shippingEM: number;
}

const groupedBySeller = computed<SellerGroup[]>(() => {
  const map = new Map<string, SellerGroup>();
  for (const item of items.value) {
    if (!map.has(item.sellerUid)) {
      map.set(item.sellerUid, {
        sellerUid: item.sellerUid,
        sellerName: item.seller,
        items: [],
        subtotal: 0,
        shippingWM: 0,
        shippingEM: 0,
      });
    }
    const g = map.get(item.sellerUid)!;
    g.items.push(item);
    g.subtotal += item.price;
    g.shippingWM = Math.max(g.shippingWM, item.shippingWM ?? 0);
    g.shippingEM = Math.max(g.shippingEM, item.shippingEM ?? 0);
  }
  return [...map.values()];
});

// Re-quote when the cart composition, the address, or sign-in state changes.
// Declared after groupedBySeller: `immediate: true` evaluates the getter during
// setup, so referencing it any earlier is a temporal-dead-zone ReferenceError.
watch(
  [
    () => groupedBySeller.value.map((g) => `${g.sellerUid}:${g.items.length}`).join("|"),
    destination,
    user,
  ],
  () => {
    void refreshQuotes();
  },
  { immediate: true },
);

const groupShipping = (g: SellerGroup) => quotes.value[g.sellerUid]?.shipping ?? 0;

// Every group must have a live quote before we let anyone check out — a
// missing quote means we'd create an order with RM 0 shipping.
const canCheckout = computed(
  () =>
    hasAddress.value &&
    !quotesLoading.value &&
    groupedBySeller.value.length > 0 &&
    groupedBySeller.value.every((g) => !!quotes.value[g.sellerUid]),
);

const checkoutLabel = computed(() => {
  if (placing.value) return "Creating orders...";
  if (!hasAddress.value) return "Add a delivery address";
  if (quotesLoading.value) return "Calculating shipping...";
  if (!canCheckout.value) return "Shipping unavailable";
  const n = groupedBySeller.value.length;
  return `Place ${n} ${n === 1 ? "order" : "orders"}`;
});

const totalShipping = computed(() =>
  groupedBySeller.value.reduce((sum, g) => sum + groupShipping(g), 0),
);

const grandTotal = computed(() => cartTotal.value + totalShipping.value);

const handlePlaceOrders = async () => {
  if (!user.value || !items.value.length || !canCheckout.value) return;
  placing.value = true;
  try {
    // Freeze the quotes the buyer was just shown onto the orders — the price
    // *and* which courier it was for, so booking uses the service they paid
    // for rather than re-quoting later and possibly picking a different one.
    const quotedShipping: Record<string, QuotedShipping> = {};
    for (const g of groupedBySeller.value) {
      const q = quotes.value[g.sellerUid];
      if (q) {
        quotedShipping[g.sellerUid] = {
          shipping: q.shipping,
          courier: q.courier,
          serviceId: q.serviceId,
          serviceCode: q.serviceCode,
          quotedRate: q.quotedRate,
        };
      }
    }

    const created = await createCompiledOrders(
      items.value.map((it) => ({
        cardId: it.id,
        cardName: it.cardName,
        cardSet: it.cardSet,
        condition: it.condition,
        imageUrl: it.imageUrl,
        price: it.price,
        shippingWM: it.shippingWM ?? 0,
        shippingEM: it.shippingEM ?? 0,
        sellerUid: it.sellerUid,
        sellerName: it.seller,
      })),
      regionForState(profile.value?.deliveryState),
      profile.value?.customName || profile.value?.displayName || user.value.displayName || "Buyer",
      quotedShipping,
    );

    clearCart();

    // If only one order was created, jump straight to it. Otherwise send
    // the buyer to their activity Orders tab.
    if (created.length === 1) {
      router.push(`/orders/${created[0].id}?placed=1`);
    } else {
      router.push(`/activity?tab=purchases&placed=${created.length}`);
    }
  } catch (e: any) {
    alert(e?.message || "Could not place orders. Please try again.");
  } finally {
    placing.value = false;
  }
};
</script>
