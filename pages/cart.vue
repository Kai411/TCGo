<template>
  <div class="max-w-3xl mx-auto">
    <h1 class="text-2xl font-bold tracking-tight text-ink dark:text-white">Cart</h1>
    <p class="mt-1 mb-6 text-sm text-ink-muted dark:text-zinc-400">
      Items from the same seller are combined into one order with one shipping fee.
    </p>

    <EmptyState
      v-if="items.length === 0"
      headline="Your cart is empty"
      caption="Cards you add from the shop will wait here until you're ready to order."
    >
      <template #icon>
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
      </template>
      <NuxtLink
        to="/"
        class="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold bg-ink text-white dark:bg-white dark:text-ink hover:opacity-90 transition-opacity"
      >
        Browse cards
      </NuxtLink>
    </EmptyState>

    <template v-else>
      <!-- Stale items: sold or delisted since they were added -->
      <div
        v-if="unavailableIds.size > 0"
        role="alert"
        class="mb-4 flex items-start justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.08] px-4 py-3 text-sm text-amber-800 dark:text-amber-200"
      >
        <div class="min-w-0">
          <p class="font-semibold">
            {{ unavailableIds.size === 1 ? "1 item has" : `${unavailableIds.size} items have` }}
            sold or been removed
          </p>
          <p class="truncate">{{ unavailableNames }}</p>
        </div>
        <button
          type="button"
          @click="removeUnavailable"
          class="shrink-0 font-semibold underline underline-offset-2 hover:no-underline"
        >
          Remove
        </button>
      </div>

      <!-- Shipping region picker (applies to all groups) -->
      <fieldset class="surface rounded-2xl p-4 mb-4">
        <legend class="sr-only">Shipping region</legend>
        <p class="eyebrow mb-2" aria-hidden="true">Shipping to</p>
        <div class="grid grid-cols-2 gap-1 p-1 rounded-xl bg-black/[0.04] dark:bg-white/[0.06]">
          <button
            v-for="r in regions"
            :key="r.value"
            type="button"
            @click="shippingRegion = r.value"
            :aria-pressed="shippingRegion === r.value"
            class="py-2 rounded-lg text-sm font-semibold transition-colors"
            :class="
              shippingRegion === r.value
                ? 'bg-white text-ink shadow-ring-soft dark:bg-white/[0.12] dark:text-white'
                : 'text-ink-muted dark:text-zinc-400 hover:text-ink dark:hover:text-white'
            "
          >
            {{ r.label }}
          </button>
        </div>
      </fieldset>

      <div class="md:grid md:grid-cols-[1fr_18rem] md:gap-6 md:items-start">
        <!-- Compiled-order previews (one per seller) -->
        <div class="space-y-4 mb-6 md:mb-0">
          <section
            v-for="group in groupedBySeller"
            :key="group.sellerUid"
            class="surface rounded-2xl p-4"
            :aria-label="`Order from ${group.sellerName}`"
          >
            <div class="flex items-center justify-between mb-3">
              <div>
                <p class="eyebrow">Order from</p>
                <NuxtLink
                  :to="`/profile/${group.sellerUid}`"
                  class="font-semibold text-ink dark:text-white text-sm hover:underline"
                >
                  @{{ group.sellerName }}
                </NuxtLink>
              </div>
              <span class="text-xs text-ink-muted dark:text-zinc-400">
                {{ group.items.length }} {{ group.items.length === 1 ? "item" : "items" }}
              </span>
            </div>

            <ul class="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
              <li
                v-for="item in group.items"
                :key="item.id"
                class="flex gap-3 items-center py-2.5 first:pt-0"
              >
                <NuxtLink :to="`/cards/${item.id}`" class="w-12 h-16 shrink-0 rounded-md overflow-hidden" tabindex="-1">
                  <CardImage :src="item.imageUrl" :alt="item.cardName" />
                </NuxtLink>
                <div class="flex-1 min-w-0">
                  <NuxtLink
                    :to="`/cards/${item.id}`"
                    class="block font-medium text-sm truncate text-ink dark:text-white hover:underline"
                  >
                    {{ item.cardName }}
                  </NuxtLink>
                  <p class="text-xs text-ink-muted dark:text-zinc-400 truncate">
                    {{ [item.cardSet, item.condition].filter(Boolean).join(" · ") }}
                  </p>
                </div>
                <div class="text-right shrink-0">
                  <p class="font-semibold text-sm tabular-price text-ink dark:text-white">
                    RM {{ formatRM(item.price) }}
                  </p>
                  <button
                    type="button"
                    @click="removeFromCart(item.id)"
                    :aria-label="`Remove ${item.cardName} from cart`"
                    class="mt-0.5 text-xs font-medium text-ink-muted dark:text-zinc-400 hover:text-pokemon-red"
                  >
                    Remove
                  </button>
                </div>
              </li>
            </ul>

            <dl class="hairline mt-3 pt-3 space-y-1 text-xs">
              <div class="flex justify-between text-ink-muted dark:text-zinc-400">
                <dt>Subtotal</dt>
                <dd class="tabular-price">RM {{ formatRM(group.subtotal) }}</dd>
              </div>
              <div class="flex justify-between text-ink-muted dark:text-zinc-400">
                <dt>Shipping ({{ shippingRegion }}, combined)</dt>
                <dd class="tabular-price">RM {{ formatRM(groupShipping(group)) }}</dd>
              </div>
              <div class="flex justify-between font-semibold text-sm pt-1 text-ink dark:text-white">
                <dt>Order total</dt>
                <dd class="tabular-price">RM {{ formatRM(group.subtotal + groupShipping(group)) }}</dd>
              </div>
            </dl>
          </section>
        </div>

        <!-- Grand summary + checkout (sticks beside the orders on desktop) -->
        <aside class="surface rounded-2xl p-5 md:sticky md:top-[5.5rem]">
          <h2 class="text-sm font-semibold text-ink dark:text-white mb-3">Summary</h2>
          <dl class="space-y-1 text-sm mb-4">
            <div class="flex justify-between text-ink-muted dark:text-zinc-400">
              <dt>Items ({{ orderableItems.length }})</dt>
              <dd class="tabular-price">RM {{ formatRM(cartTotalLive) }}</dd>
            </div>
            <div class="flex justify-between text-ink-muted dark:text-zinc-400">
              <dt>Shipping ({{ groupedBySeller.length }} {{ groupedBySeller.length === 1 ? "parcel" : "parcels" }})</dt>
              <dd class="tabular-price">RM {{ formatRM(totalShipping) }}</dd>
            </div>
            <div class="hairline flex justify-between items-baseline pt-2 mt-2">
              <dt class="font-semibold text-ink dark:text-white">Total</dt>
              <dd class="tabular-price text-xl font-extrabold text-ink dark:text-white">RM {{ formatRM(grandTotal) }}</dd>
            </div>
          </dl>

          <button
            v-if="!user"
            type="button"
            @click="signInWithGoogle"
            class="w-full bg-ink text-white dark:bg-white dark:text-ink py-3 rounded-xl font-semibold hover:opacity-90 transition-opacity"
          >
            Sign in to place {{ ordersLabel }}
          </button>

          <template v-else>
            <button
              type="button"
              @click="handlePlaceOrders"
              :disabled="placing || orderableItems.length === 0"
              class="w-full bg-pokemon-red text-white py-3 rounded-xl font-semibold hover:shadow-glow transition-shadow disabled:opacity-60 disabled:hover:shadow-none flex items-center justify-center gap-2"
            >
              <span v-if="placing" class="animate-spin rounded-full h-4 w-4 border-2 border-white/40 border-t-white" aria-hidden="true" />
              {{ placing ? "Placing orders…" : `Place ${ordersLabel}` }}
            </button>
          </template>
          <p class="text-xs text-ink-muted dark:text-zinc-400 text-center mt-2">
            You'll arrange payment and shipping with each seller on WhatsApp after ordering.
          </p>

          <button
            type="button"
            @click="confirmClear"
            class="text-xs font-medium text-ink-muted dark:text-zinc-500 hover:text-pokemon-red mt-4 block mx-auto"
          >
            Clear cart
          </button>
        </aside>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { CartItem } from "~/composables/useCart";

useHead({ title: "Cart | TCGo Marketplace" });

const router = useRouter();
const { items, removeFromCart, clearCart } = useCart();
const { cards, loading: cardsLoading } = useCards();

const regions = [
  { value: "WM" as const, label: "West Malaysia" },
  { value: "EM" as const, label: "East Malaysia" },
];

const formatRM = (n: number) =>
  n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Cart items persist across visits, so one may have sold or been delisted
// since it was added. Only flag once listings have loaded.
const unavailableIds = computed(() => {
  if (cardsLoading.value) return new Set<string>();
  const live = new Map(cards.value.map((c) => [c.id, c]));
  return new Set(
    items.value
      .filter((it) => {
        const c = live.get(it.id);
        return !c || c.sold;
      })
      .map((it) => it.id),
  );
});
const unavailableNames = computed(() =>
  items.value
    .filter((it) => unavailableIds.value.has(it.id))
    .map((it) => it.cardName)
    .join(", "),
);
const orderableItems = computed(() =>
  items.value.filter((it) => !unavailableIds.value.has(it.id)),
);
const cartTotalLive = computed(() =>
  orderableItems.value.reduce((sum, it) => sum + it.price, 0),
);
const removeUnavailable = () => {
  for (const id of unavailableIds.value) removeFromCart(id);
};
const confirmClear = () => {
  if (confirm("Remove everything from your cart?")) clearCart();
};
const ordersLabel = computed(() =>
  groupedBySeller.value.length === 1
    ? "order"
    : `${groupedBySeller.value.length} orders`,
);
const { user, signInWithGoogle } = useAuth();
const { profile } = useMyProfile();
const { createCompiledOrders } = useCompiledOrders();

const shippingRegion = ref<"WM" | "EM">("WM");
const placing = ref(false);

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
  for (const item of orderableItems.value) {
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

const groupShipping = (g: SellerGroup) =>
  shippingRegion.value === "WM" ? g.shippingWM : g.shippingEM;

const totalShipping = computed(() =>
  groupedBySeller.value.reduce((sum, g) => sum + groupShipping(g), 0),
);

const grandTotal = computed(() => cartTotalLive.value + totalShipping.value);

const handlePlaceOrders = async () => {
  if (!user.value || !orderableItems.value.length) return;
  placing.value = true;
  try {
    const created = await createCompiledOrders(
      orderableItems.value.map((it) => ({
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
      shippingRegion.value,
      profile.value?.customName || profile.value?.displayName || user.value.displayName || "Buyer",
    );

    for (const it of orderableItems.value.slice()) removeFromCart(it.id);

    // If only one order was created, jump straight to it. Otherwise send
    // the buyer to their activity Orders tab.
    if (created.length === 1) {
      router.push(`/orders/${created[0].id}?placed=1`);
    } else {
      router.push(`/activity?tab=orders&placed=${created.length}`);
    }
  } catch (e: any) {
    alert(e?.message || "Could not place orders. Please try again.");
  } finally {
    placing.value = false;
  }
};
</script>
