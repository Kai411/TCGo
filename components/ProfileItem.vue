<template>
  <NuxtLink :to="to" class="group block">
    <article
      class="surface rounded-2xl overflow-hidden hover:shadow-card-hover transition-shadow duration-300 ease-premium"
    >
      <div
        class="relative aspect-[3/4] bg-canvas-sunken dark:bg-white/[0.02] overflow-hidden"
      >
        <img
          v-if="image"
          :src="cdnUrl(image, 400)"
          :alt="title"
          loading="lazy"
          class="w-full h-full object-cover"
        />
        <div
          v-else
          class="absolute inset-0 flex items-center justify-center text-xs text-ink-soft dark:text-zinc-500"
        >
          No image
        </div>

        <span
          v-if="status"
          class="absolute top-2 left-2 chip"
          :class="statusChip"
        >
          {{ statusLabel }}
        </span>
      </div>

      <div class="p-3.5 sm:p-4">
        <h3
          class="font-semibold text-[15px] leading-tight text-ink dark:text-white truncate"
        >
          {{ title }}
        </h3>
        <p
          v-if="subtitle"
          class="mt-1 text-xs text-ink-muted dark:text-zinc-400 truncate"
        >
          {{ subtitle }}
        </p>

        <div class="mt-3 flex items-end justify-between">
          <div class="min-w-0">
            <span
              class="text-[11px] font-semibold text-ink-soft dark:text-zinc-500"
            >
              RM
            </span>
            <p
              class="tabular-price font-extrabold text-[17px] leading-none text-ink dark:text-white"
            >
              {{ price.toFixed(2) }}
            </p>
          </div>
        </div>
      </div>
    </article>
  </NuxtLink>
</template>

<script setup lang="ts">
const props = defineProps<{
  to: string;
  image: string;
  title: string;
  subtitle?: string;
  price: number;
  status?: "available" | "sold" | "active" | "ended";
}>();

const statusLabel = computed(() => {
  switch (props.status) {
    case "available":
      return "Available";
    case "sold":
      return "Sold";
    case "active":
      return "Live";
    case "ended":
      return "Ended";
    default:
      return "";
  }
});

const statusChip = computed(() => {
  switch (props.status) {
    case "available":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "active":
      return "bg-pokemon-red/10 text-pokemon-red";
    case "sold":
    case "ended":
      return "bg-ink/[0.06] text-ink-muted dark:bg-white/[0.06] dark:text-zinc-400";
    default:
      return "";
  }
});
</script>
