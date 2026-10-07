<template>
  <div class="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/40 dark:bg-black/60" @click.self="$emit('close')">
    <div class="w-full sm:max-w-lg max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-white dark:bg-[#1b1b21] shadow-xl">
      <div class="flex items-center justify-between px-4 pt-4 pb-2">
        <p class="text-base font-bold text-ink dark:text-white">Attach</p>
        <button type="button" @click="$emit('close')" aria-label="Close" class="p-1.5 rounded-lg text-ink-muted hover:bg-black/[0.05] dark:hover:bg-white/[0.08]">
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>
      <div class="flex gap-1 px-4 pb-2">
        <button
          v-for="t in tabs"
          :key="t.key"
          type="button"
          @click="tab = t.key"
          class="px-3 py-1.5 rounded-full text-sm font-semibold transition-colors"
          :class="tab === t.key ? 'bg-ink text-white dark:bg-white dark:text-ink' : 'text-ink-muted dark:text-zinc-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'"
        >
          {{ t.label }}
        </button>
      </div>

      <div class="overflow-y-auto px-4 pb-4 space-y-2">
        <p v-if="loading" class="py-10 text-center text-sm text-ink-soft">Loading…</p>
        <p v-else-if="error" class="py-10 text-center text-sm text-pokemon-red">{{ error }}</p>

        <template v-else-if="tab === 'orders'">
          <p v-if="!orders.length" class="py-10 text-center text-sm text-ink-soft dark:text-zinc-500">
            You and {{ otherName }} don't have any orders together yet.
          </p>
          <button v-for="o in orders" :key="o.id" type="button" class="block w-full" @click="pickOrder(o)">
            <ChatAttachmentCard :attachment="orderSnapshot(o)" :link="false" class="hover:border-pokemon-red/50" />
          </button>
        </template>

        <template v-else>
          <p v-if="!shownProducts.length" class="py-10 text-center text-sm text-ink-soft dark:text-zinc-500">
            {{ tab === "mine" ? "You have nothing listed right now." : `${otherName} has nothing listed right now.` }}
          </p>
          <button v-for="p in shownProducts" :key="p.kind + p.id" type="button" class="block w-full" @click="pickProduct(p)">
            <ChatAttachmentCard :attachment="productSnapshot(p)" :link="false" class="hover:border-pokemon-red/50" />
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type { ChatAttachment, ChatAttachmentRef } from "~/shared/chat";

const props = defineProps<{ otherUid: string; otherName: string }>();
const emit = defineEmits<{
  close: [];
  pick: [ref: ChatAttachmentRef, preview: ChatAttachment];
}>();

const { user } = useAuth();
const { ordersBetween, productsOf } = useChat();

const tab = ref<"orders" | "mine" | "theirs">("orders");
const tabs = computed(() => [
  { key: "orders" as const, label: "Orders" },
  { key: "mine" as const, label: "Your listings" },
  { key: "theirs" as const, label: `${props.otherName}'s listings` },
]);

const loading = ref(true);
const error = ref("");
const orders = ref<any[]>([]);
const products = ref<any[]>([]);

const shownProducts = computed(() =>
  products.value.filter((p) => (tab.value === "mine" ? p.sellerUid === user.value?.uid : p.sellerUid === props.otherUid)),
);

onMounted(async () => {
  try {
    const [o, p] = await Promise.all([
      ordersBetween(props.otherUid),
      productsOf([user.value!.uid, props.otherUid]),
    ]);
    orders.value = o;
    products.value = p;
  } catch (e) {
    console.error("[chat] attach picker", e);
    error.value = "Couldn't load your orders and listings.";
  } finally {
    loading.value = false;
  }
});

const orderSnapshot = (o: any): ChatAttachment => ({
  type: "order",
  orderId: o.id,
  itemCount: o.items?.length ?? 0,
  firstItemName: o.items?.[0]?.cardName ?? "Order",
  imageUrl: o.items?.[0]?.imageUrl ?? "",
  total: Number(o.total) || 0,
  status: o.status ?? "",
});

const productSnapshot = (p: any): ChatAttachment => ({
  type: "product",
  kind: p.kind,
  productId: p.id,
  name: p.cardName || p.title || "Card",
  subtitle: [p.cardSet, p.condition].filter(Boolean).join(" · "),
  imageUrl: p.imageUrls?.[0] || p.imageUrl || "",
  price: Number(p.kind === "auction" ? p.currentPrice ?? p.startingPrice : p.price) || 0,
  sellerUid: p.sellerUid,
});

const pickOrder = (o: any) => emit("pick", { type: "order", id: o.id }, orderSnapshot(o));
const pickProduct = (p: any) =>
  emit("pick", { type: "product", kind: p.kind, id: p.id }, productSnapshot(p));
</script>
