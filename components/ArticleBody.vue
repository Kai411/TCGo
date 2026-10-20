<template>
  <!-- Article text from Mint Condition, as text nodes only (no v-html), so
       nothing typed into the console can become markup. -->
  <div class="select-text text-[16px] leading-[1.7] text-ink/85 dark:text-zinc-300 sm:text-[17px]">
    <template v-for="(block, i) in blocks" :key="i">
      <h2
        v-if="block.kind === 'h2'"
        class="mb-3 mt-9 text-[22px] font-bold leading-snug tracking-tight text-ink first:mt-0 dark:text-white [text-wrap:balance] sm:text-2xl"
      >
        {{ block.text }}
      </h2>
      <h3 v-else-if="block.kind === 'h3'" class="mb-2 mt-7 text-[17px] font-semibold leading-snug text-ink first:mt-0 dark:text-white sm:text-lg">
        {{ block.text }}
      </h3>
      <ul v-else-if="block.kind === 'ul'" class="mb-5 mt-1 list-disc space-y-2 pl-5 marker:text-pokemon-red last:mb-0">
        <li v-for="(item, j) in block.items" :key="j" class="pl-1">{{ item }}</li>
      </ul>
      <p v-else class="mb-5 whitespace-pre-line last:mb-0">{{ block.text }}</p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { parseArticle } from "~/shared/site-content";

const props = defineProps<{ body: string }>();
const blocks = computed(() => parseArticle(props.body));
</script>
