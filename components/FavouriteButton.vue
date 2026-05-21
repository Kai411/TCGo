<template>
  <button
    @click.prevent.stop="handleToggle"
    :disabled="!user"
    class="inline-flex items-center gap-0.5 transition-all"
    :class="[
      size === 'sm' ? 'p-1' : 'p-1.5',
      !user
        ? 'opacity-30 cursor-not-allowed'
        : 'hover:scale-110 active:scale-95',
    ]"
    :title="
      user
        ? isFav
          ? 'Remove from favourites'
          : 'Add to favourites'
        : 'Sign in to favourite'
    "
  >
    <svg
      :class="size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'"
      :fill="isFav ? '#E3350D' : 'none'"
      :stroke="isFav ? '#E3350D' : 'currentColor'"
      stroke-width="2"
      viewBox="0 0 24 24"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
      />
    </svg>
    <span
      v-if="count > 0"
      class="text-gray-500 dark:text-zinc-400"
      :class="size === 'sm' ? 'text-[10px]' : 'text-xs'"
    >
      {{ count }}
    </span>
  </button>
</template>

<script setup lang="ts">
const props = defineProps<{
  itemId: string;
  itemType: "card" | "auction";
  count?: number;
  size?: "sm" | "md";
}>();

const { user } = useAuth();
const { isFavourited, toggleFavourite } = useFavourites();

const isFav = computed(() => isFavourited(props.itemId));

const handleToggle = () => {
  if (!user.value) return;
  toggleFavourite(props.itemId, props.itemType);
};
</script>
