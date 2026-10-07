<template>
  <button
    v-if="!isSelf"
    type="button"
    @click="open"
    class="inline-flex items-center justify-center gap-1.5 rounded-full font-semibold border border-black/[0.08] dark:border-white/[0.10] text-ink dark:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
    :class="small ? 'px-3 py-1.5 text-xs sm:text-sm' : 'px-4 py-2 text-sm'"
  >
    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
    <slot>Message</slot>
  </button>
</template>

<script setup lang="ts">
import { computed } from "vue";

// Opens the conversation with `uid`, optionally with an order or product
// ready to attach. Signed-out visitors go to login and come back here.
const props = defineProps<{
  uid: string;
  orderId?: string;
  productId?: string;
  productKind?: "listing" | "auction";
  small?: boolean;
}>();

const { user } = useAuth();
const { requireSignIn } = useSignInGate();

const isSelf = computed(() => !!user.value && user.value.uid === props.uid);

const open = () => {
  if (!requireSignIn()) return;
  const query: Record<string, string> = {};
  if (props.orderId) query.order = props.orderId;
  if (props.productId) {
    query.product = props.productId;
    query.kind = props.productKind ?? "listing";
  }
  navigateTo({ path: `/messages/${props.uid}`, query });
};
</script>
