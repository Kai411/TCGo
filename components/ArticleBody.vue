<template>
  <!-- Article text from Mint Condition, as text nodes only (no v-html), so
       nothing typed into the console can become markup. -->
  <div class="space-y-4 text-[16px] leading-relaxed text-ink dark:text-zinc-200 select-text">
    <template v-for="(block, i) in blocks" :key="i">
      <h2 v-if="block.kind === 'h2'" class="pt-2 text-xl font-bold leading-snug text-ink dark:text-white [text-wrap:balance]">
        {{ block.text }}
      </h2>
      <h3 v-else-if="block.kind === 'h3'" class="pt-1 text-[17px] font-semibold leading-snug text-ink dark:text-white">
        {{ block.text }}
      </h3>
      <ul v-else-if="block.kind === 'ul'" class="list-disc space-y-1.5 pl-5 marker:text-ink-soft">
        <li v-for="(item, j) in block.items" :key="j">{{ item }}</li>
      </ul>
      <p v-else class="whitespace-pre-line">{{ block.text }}</p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { parseArticle } from "~/shared/site-content";

const props = defineProps<{ body: string }>();
const blocks = computed(() => parseArticle(props.body));
</script>
