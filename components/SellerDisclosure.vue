<template>
  <!-- Who the seller is, under the seller badge on listing and auction pages
       (shared/seller-disclosure.ts). Nothing renders until the seller has
       answered "individual or business", so older listings look as before. -->
  <dl
    v-if="d"
    class="mt-2 px-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px] leading-snug"
    aria-label="Seller details"
  >
    <dt class="text-ink-muted dark:text-zinc-500">{{ d.type === "business" ? "Business" : "Seller" }}</dt>
    <dd class="min-w-0 text-ink-subtle dark:text-zinc-300 break-words">
      {{ d.name }}<span v-if="d.type === 'individual'" class="text-ink-muted dark:text-zinc-500"> · identity verified</span>
    </dd>
    <template v-if="d.type === 'business' && d.ssmNumber">
      <dt class="text-ink-muted dark:text-zinc-500">SSM no.</dt>
      <dd class="text-ink-subtle dark:text-zinc-300 tabular-nums">{{ d.ssmNumber }}</dd>
    </template>
    <dt class="text-ink-muted dark:text-zinc-500">Contact</dt>
    <dd class="text-ink-subtle dark:text-zinc-300">Message the seller through TCGo chat</dd>
  </dl>
</template>

<script setup lang="ts">
import type { SellerDisclosure } from "~/shared/seller-disclosure";

const props = defineProps<{ uid?: string | null }>();

// Fetched once the seller is known (the listing loads after the page). A
// failure shows nothing rather than an error under someone's listing.
const d = ref<SellerDisclosure | null>(null);
watch(
  () => props.uid,
  async (uid) => {
    d.value = null;
    if (!uid) return;
    try {
      d.value = await $fetch<SellerDisclosure | null>(`/api/sellers/${uid}/disclosure`);
    } catch {}
  },
  { immediate: true },
);
</script>
