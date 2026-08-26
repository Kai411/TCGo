<template>
  <span
    class="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-ink/[0.04] ring-1 ring-inset ring-black/[0.05]"
    aria-hidden="true"
  >
    <svg viewBox="0 0 32 32" fill="none" class="w-[60%] h-[60%]">
      <!-- Two-tone line art: brand red carries the "active" element of each
           mark, ink carries the structure. Drawn on a 32px grid at 1.6 stroke
           so all four read as one family. -->
      <g
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
        fill="none"
      >
        <!-- Live auctions: gavel striking a block -->
        <template v-if="name === 'auction'">
          <path d="M17.5 5.5 26 14l-3.2 3.2L14.3 8.7z" stroke="#09090B" />
          <path d="M13.4 9.6 5.6 17.4l3.4 3.4 7.8-7.8" stroke="#09090B" />
          <path d="M6 27h13" stroke="#E3350D" stroke-width="2.2" />
          <path d="M20.5 4 24 7.5M22 20l4 4" stroke="#E3350D" />
        </template>

        <!-- Trust: shield with a check -->
        <template v-else-if="name === 'trust'">
          <path
            d="M16 4.5 6.5 8.3v7.4c0 5.4 3.9 10.3 9.5 11.8 5.6-1.5 9.5-6.4 9.5-11.8V8.3z"
            stroke="#09090B"
          />
          <path d="m11.8 15.8 3 3 5.4-5.8" stroke="#E3350D" stroke-width="2.2" />
        </template>

        <!-- Graded & raw: a slab in front of a raw card -->
        <template v-else-if="name === 'graded'">
          <rect x="4.5" y="7.5" width="12" height="17" rx="1.6" stroke="#09090B" />
          <rect x="13.5" y="4.5" width="14" height="21" rx="2" fill="#fff" stroke="#09090B" />
          <path d="M16.5 8.5h8" stroke="#E3350D" stroke-width="2.2" />
          <path d="M16.5 12h5" stroke="#09090B" opacity="0.35" />
          <rect x="16.5" y="15" width="8" height="7.5" rx="1" stroke="#09090B" opacity="0.35" />
        </template>

        <!-- Local: parcel with a route pin -->
        <template v-else-if="name === 'local'">
          <path d="M16 4.5 27 10v12L16 27.5 5 22V10z" stroke="#09090B" />
          <path d="M5 10l11 5.5L27 10M16 15.5V27.5" stroke="#09090B" opacity="0.35" />
          <path
            d="M16 6.2c1.6 0 2.9 1.3 2.9 2.9 0 2.2-2.9 4.9-2.9 4.9s-2.9-2.7-2.9-4.9c0-1.6 1.3-2.9 2.9-2.9z"
            fill="#E3350D"
            stroke="none"
          />
        </template>
      </g>
    </svg>
  </span>
</template>

<script setup lang="ts">
/**
 * Custom line-art marks for the landing feature cards.
 *
 * Replaces the emoji that were there before: emoji render differently on every
 * platform (and as full-colour cartoons on Apple), which read as placeholder
 * art on a page selling a business tool. These are drawn on one 32px grid with
 * a shared stroke weight so they sit together as a set.
 */
defineProps<{
  name: "auction" | "trust" | "graded" | "local";
}>();
</script>
