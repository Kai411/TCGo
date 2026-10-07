<template>
  <article class="legal w-[90%] sm:w-[70%] lg:w-[60%] max-w-3xl mx-auto pt-8 pb-[120px]">
    <header>
      <h1>{{ title }}</h1>
      <p class="mt-2 text-sm italic text-ink-soft">
        Effective {{ LEGAL_EFFECTIVE_DATE }}
      </p>
      <p v-if="summary" class="mt-5 rounded-xl bg-black/[0.03] p-4 text-[15px] leading-relaxed">
        <b>In short:</b> {{ summary }}
      </p>
    </header>

    <hr class="my-8" />

    <div class="legal-body">
      <slot />
    </div>

    <hr class="my-10" />

    <section class="text-sm leading-relaxed text-ink-muted">
      <p>
        TCGo is operated by <b>{{ OPERATOR.legalName }}</b> (SSM
        {{ OPERATOR.registrationNo }}), {{ OPERATOR.address }}. Questions or
        complaints: <b>{{ OPERATOR.supportEmail }}</b>.
      </p>
      <nav class="mt-4 flex flex-wrap gap-x-4 gap-y-1" aria-label="Legal">
        <NuxtLink
          v-for="link in LEGAL_LINKS"
          :key="link.to"
          :to="link.to"
          class="font-semibold hover:text-pokemon-red"
          active-class="text-pokemon-red"
        >
          {{ link.label }}
        </NuxtLink>
      </nav>
    </section>
  </article>
</template>

<script setup lang="ts">
import { LEGAL_EFFECTIVE_DATE, LEGAL_LINKS, OPERATOR } from "~/shared/legal";

// Shared shell for the four policy pages, so they read as one set: same
// heading, same effective date, same operator block and cross-links.
defineProps<{ title: string; summary?: string }>();
</script>

<style scoped>
h1 {
  @apply text-3xl font-bold;
}

.legal-body :deep(h2) {
  @apply text-xl font-bold mt-10 mb-3;
}

.legal-body :deep(h3) {
  @apply text-base font-bold mt-5 mb-2;
}

.legal-body :deep(p) {
  @apply leading-relaxed mb-3;
}

.legal-body :deep(ul),
.legal-body :deep(ol) {
  @apply mb-3 ml-6 space-y-1 leading-relaxed;
}

.legal-body :deep(ul) {
  list-style: disc;
}

.legal-body :deep(ol) {
  list-style: decimal;
}

.legal-body :deep(a) {
  @apply font-semibold text-pokemon-red hover:underline;
}

.legal-body :deep(table) {
  @apply w-full text-sm mb-4 border-collapse;
}

.legal-body :deep(th),
.legal-body :deep(td) {
  @apply border border-black/10 px-3 py-2 text-left align-top;
}
</style>
