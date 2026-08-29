<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <Transition
      enter-active-class="transition duration-200"
      enter-from-class="opacity-0"
      leave-active-class="transition duration-150"
      leave-to-class="opacity-0"
    >
      <div
        v-if="modelValue"
        class="fixed inset-0 z-[60] bg-black/40 dark:bg-black/60"
        @click="close"
      />
    </Transition>

    <!-- Panel: slides in from the right so shoppers keep their place. -->
    <Transition
      enter-active-class="transition-transform duration-300 ease-premium"
      enter-from-class="translate-x-full"
      leave-active-class="transition-transform duration-200 ease-premium"
      leave-to-class="translate-x-full"
    >
      <aside
        v-if="modelValue"
        class="fixed inset-y-0 right-0 z-[61] w-full max-w-md flex flex-col bg-canvas dark:bg-canvas-inverse shadow-[-12px_0_40px_-12px_rgba(0,0,0,0.35)]"
        role="dialog"
        aria-modal="true"
        aria-label="Cart"
      >
        <!-- Header -->
        <div
          class="flex items-center justify-between px-5 h-16 border-b border-black/[0.06] dark:border-white/[0.08] shrink-0"
        >
          <h2 class="text-base font-bold text-ink dark:text-white">
            Cart
            <span
              v-if="items.length"
              class="ml-1 text-sm font-semibold text-ink-muted dark:text-zinc-400 tabular-nums"
            >
              ({{ items.length }})
            </span>
          </h2>
          <button
            @click="close"
            aria-label="Close cart"
            class="w-9 h-9 rounded-full flex items-center justify-center hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-ink dark:text-white"
          >
            <svg
              class="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <!-- Items -->
        <div class="flex-1 overflow-y-auto">
          <div
            v-if="!items.length"
            class="h-full flex flex-col items-center justify-center gap-3 px-6 text-center"
          >
            <svg
              class="w-10 h-10 text-ink-soft dark:text-zinc-600"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path
                d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"
              />
            </svg>
            <p class="text-sm font-semibold text-ink dark:text-white">
              Your cart is empty
            </p>
            <p class="text-xs text-ink-muted dark:text-zinc-400">
              Keep browsing — anything you add shows up here.
            </p>
          </div>

          <template v-else>
            <!-- Bulk toolbar -->
            <div
              class="sticky top-0 z-10 flex items-center justify-between px-5 py-2.5 bg-canvas/95 dark:bg-canvas-inverse/95 backdrop-blur border-b border-black/[0.06] dark:border-white/[0.08]"
            >
              <label
                class="inline-flex items-center gap-2.5 text-sm font-semibold text-ink dark:text-white cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  :checked="allSelected"
                  :indeterminate="someSelected && !allSelected"
                  @change="toggleAll"
                  class="w-4 h-4 rounded accent-pokemon-red cursor-pointer"
                />
                {{ allSelected ? "Deselect all" : "Select all" }}
              </label>
              <button
                :disabled="!someSelected"
                @click="removeSelected"
                class="text-sm font-semibold text-pokemon-red hover:underline disabled:text-ink-soft dark:disabled:text-zinc-600 disabled:no-underline disabled:cursor-default transition-colors"
              >
                Remove{{ selectedCount ? ` (${selectedCount})` : "" }}
              </button>
            </div>

            <ul class="divide-y divide-black/[0.06] dark:divide-white/[0.08]">
            <li
              v-for="item in items"
              :key="item.id"
              class="flex gap-3 px-5 py-4 transition-colors"
              :class="selected.has(item.id) ? 'bg-pokemon-red/[0.04]' : ''"
            >
              <label class="flex items-center shrink-0 cursor-pointer">
                <input
                  type="checkbox"
                  :checked="selected.has(item.id)"
                  @change="toggleOne(item.id)"
                  :aria-label="`Select ${item.cardName}`"
                  class="w-4 h-4 rounded accent-pokemon-red cursor-pointer"
                />
              </label>
              <NuxtLink
                :to="`/cards/${item.id}`"
                @click="close"
                class="w-14 shrink-0 rounded-md overflow-hidden bg-black/[0.04] dark:bg-white/[0.06]"
              >
                <CardImage :src="item.imageUrl" :alt="item.cardName" />
              </NuxtLink>
              <div class="flex-1 min-w-0">
                <NuxtLink
                  :to="`/cards/${item.id}`"
                  @click="close"
                  class="block text-sm font-semibold text-ink dark:text-white truncate hover:underline"
                >
                  {{ item.cardName }}
                </NuxtLink>
                <p class="text-xs text-ink-muted dark:text-zinc-400 truncate">
                  {{ item.cardSet }}
                  <span v-if="item.condition"> · {{ item.condition }}</span>
                </p>
                <p class="text-xs text-ink-soft dark:text-zinc-500 truncate">
                  @{{ item.seller }}
                </p>
                <div class="mt-1.5 flex items-center justify-between">
                  <span
                    class="tabular-price text-sm font-bold text-ink dark:text-white"
                  >
                    RM {{ item.price.toFixed(2) }}
                  </span>
                  <button
                    @click="removeOne(item.id)"
                    class="text-xs font-semibold text-ink-muted dark:text-zinc-400 hover:text-pokemon-red transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
            </ul>
          </template>
        </div>

        <!-- Footer -->
        <div
          v-if="items.length"
          class="shrink-0 px-5 py-4 border-t border-black/[0.06] dark:border-white/[0.08] space-y-3"
        >
          <div class="flex items-center justify-between text-sm">
            <span class="text-ink-muted dark:text-zinc-400">Subtotal</span>
            <span class="tabular-nums font-bold text-ink dark:text-white">
              RM {{ cartTotal.toFixed(2) }}
            </span>
          </div>
          <p class="text-xs text-ink-soft dark:text-zinc-500">
            Shipping is calculated at checkout.
          </p>
          <NuxtLink
            to="/cart"
            @click="close"
            class="block w-full text-center px-4 py-3 rounded-full text-sm font-semibold bg-pokemon-red text-white shadow-glow hover:brightness-110 transition"
          >
            Checkout
          </NuxtLink>
          <button
            @click="close"
            class="block w-full text-center px-4 py-3 rounded-full text-sm font-semibold text-ink dark:text-white bg-black/[0.05] dark:bg-white/[0.08] hover:bg-black/[0.09] dark:hover:bg-white/[0.12] transition-colors"
          >
            Continue browsing
          </button>
        </div>
      </aside>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ (e: "update:modelValue", v: boolean): void }>();

const { items, cartTotal, removeFromCart } = useCart();

const close = () => emit("update:modelValue", false);

// ── Multi-select ─────────────────────────────────────────────────────────
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
const removeOne = (id: string) => {
  removeFromCart(id);
  if (selected.value.has(id)) toggleOne(id);
};
const removeSelected = () => {
  for (const id of [...selected.value]) removeFromCart(id);
  selected.value = new Set();
};
// Drop selection when the drawer closes so it doesn't linger next time.
watch(
  () => props.modelValue,
  (open) => {
    if (!open) selected.value = new Set();
  },
);

// Escape closes; lock body scroll while open.
const onKey = (e: KeyboardEvent) => {
  if (e.key === "Escape" && props.modelValue) close();
};
onMounted(() => document.addEventListener("keydown", onKey));
const unlock = () => {
  document.body.style.overflow = "";
  document.body.style.paddingRight = "";
};
onBeforeUnmount(() => {
  document.removeEventListener("keydown", onKey);
  unlock();
});
watch(
  () => props.modelValue,
  (open) => {
    if (!open) return unlock();
    // Pad for the vanishing scrollbar so the page doesn't shift.
    const sb = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (sb > 0) document.body.style.paddingRight = `${sb}px`;
  },
);
</script>
