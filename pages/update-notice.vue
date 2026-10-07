<script setup lang="ts">
// Every word on this page comes from shared/releases.ts, whose test keeps the
// notes free of anything about how TCGo is built or run. Don't add copy here.
import { APP_VERSION, RELEASES } from "~/shared/releases";

definePageMeta({
  layout: "landing",
});

useHead({
  title: "Updates · TCGo",
});

// Release dates are calendar days, so format them as such — parsing
// "2026-09-07" as local time would show 6 September west of Greenwich.
const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-MY", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
</script>

<template>
  <div class="w-[90%] sm:w-[60%] mx-auto pt-8 pb-[120px]">
    <h1 class="text-3xl font-bold">TCGo Updates</h1>
    <p class="mt-2 text-sm text-gray-500 dark:text-zinc-400">
      You're on version {{ APP_VERSION }}.
    </p>

    <section v-for="release in RELEASES" :key="release.version">
      <hr class="my-8" />
      <h2 class="text-2xl font-bold">{{ release.title }}</h2>
      <p class="mt-1 text-sm text-gray-500 dark:text-zinc-400">
        Version {{ release.version }} ·
        <time :datetime="release.date">{{ formatDate(release.date) }}</time>
      </p>
      <ul class="mt-4 ml-[30px] list-disc space-y-1.5">
        <li v-for="note in release.notes" :key="note">{{ note }}</li>
      </ul>
    </section>
  </div>
</template>
