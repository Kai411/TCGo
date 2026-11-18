<template>
  <!-- Quiet on purpose: most buyers never need it, so it sits under the
       details as a text button rather than competing with Buy or Bid.
       Hidden on your own listing. -->
  <div v-if="!isOwn" class="mt-8 pt-4 border-t border-black/[0.06] dark:border-white/[0.06]">
    <button
      type="button"
      class="press -ml-2 inline-flex items-center gap-2 min-h-[44px] px-2 rounded-lg text-sm font-medium text-ink-muted dark:text-zinc-400 hover:text-ink dark:hover:text-white"
      @click="openSheet"
    >
      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M4 22V4" />
        <path d="M4 4h12l-2 4 2 4H4" />
      </svg>
      {{ submitted ? "Reported. Thanks for telling us" : "Report this listing" }}
    </button>

    <ReportForm
      v-if="sheetOpen"
      kind="listing"
      :reported-uid="sellerUid"
      :reported-name="sellerName"
      :related-item-id="listingId"
      :related-item-type="listingKind"
      :item-name="itemName"
      @close="sheetOpen = false"
      @submitted="onSubmitted"
    />

    <Teleport to="body">
      <Transition name="report-toast">
        <div
          v-if="toast"
          role="status"
          class="fixed left-1/2 -translate-x-1/2 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] lg:bottom-14 z-[60] surface rounded-full pl-3 pr-4 py-2 flex items-center gap-2 shadow-card-hover whitespace-nowrap"
        >
          <span class="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true" />
          <span class="text-sm font-medium text-ink dark:text-white">Report sent to TCGo</span>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  listingKind: "card" | "auction";
  listingId: string;
  sellerUid: string;
  sellerName: string;
  itemName?: string;
}>();

const { user } = useAuth();
const { goToLogin } = useSignInGate();

const isOwn = computed(() => !!user.value && user.value.uid === props.sellerUid);
const sheetOpen = ref(false);
const submitted = ref(false);
const toast = ref(false);
let toastTimer: ReturnType<typeof setTimeout> | undefined;

const openSheet = () => {
  if (!user.value) return goToLogin();
  sheetOpen.value = true;
};

const onSubmitted = () => {
  submitted.value = true;
  toast.value = true;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.value = false), 2600);
};

onBeforeUnmount(() => clearTimeout(toastTimer));
</script>

<style scoped>
.press {
  transition: transform 160ms cubic-bezier(0.22, 1, 0.36, 1);
  -webkit-tap-highlight-color: transparent;
}
.press:active {
  transform: scale(0.97);
}
.report-toast-enter-active,
.report-toast-leave-active {
  transition: opacity 200ms ease, transform 200ms cubic-bezier(0.22, 1, 0.36, 1);
}
.report-toast-enter-from,
.report-toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 8px);
}
@media (prefers-reduced-motion: reduce) {
  .report-toast-enter-active,
  .report-toast-leave-active {
    transition: opacity 200ms ease;
  }
  .report-toast-enter-from,
  .report-toast-leave-to {
    transform: translate(-50%, 0);
  }
}
</style>
