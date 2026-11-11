<template>
  <!-- The Contact us tab's welcome: a TCGo card waving hello, with a chat
       bubble, an envelope and the logo's sparkles. Drawn here, so it follows
       light and dark mode through the classes rather than shipping two images. -->
  <svg
    viewBox="0 0 320 200"
    class="w-full h-auto"
    fill="none"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path
      d="M160 16c62 0 116 28 120 82s-40 90-112 94S34 166 38 110 98 16 160 16z"
      class="fill-pokemon-red/[0.08] dark:fill-pokemon-red/[0.14]"
    />

    <!-- Chat bubble -->
    <g class="art-float" style="--d: 0s">
      <path
        d="M70 38h46a14 14 0 0 1 14 14v12a14 14 0 0 1-14 14H90l-12 10v-10h-8a14 14 0 0 1-14-14V52a14 14 0 0 1 14-14z"
        stroke-width="2.5"
        class="fill-white stroke-ink dark:fill-zinc-800 dark:stroke-zinc-200"
      />
      <circle cx="80" cy="58" r="3.5" class="fill-pokemon-red" />
      <circle cx="93" cy="58" r="3.5" class="fill-pokemon-red" />
      <circle cx="106" cy="58" r="3.5" class="fill-pokemon-red" />
    </g>

    <!-- Back card -->
    <rect
      x="124" y="44" width="84" height="116" rx="10"
      transform="rotate(-12 166 102)"
      stroke-width="2.5"
      class="fill-pokemon-yellow stroke-ink dark:stroke-zinc-200"
    />

    <!-- Front card, smiling and waving -->
    <g transform="rotate(7 182 108)">
      <g class="art-wave">
        <path d="M222 112c14-4 22-14 24-30" stroke-width="3" class="stroke-ink dark:stroke-zinc-200" />
        <circle cx="246" cy="76" r="7" stroke-width="2.5" class="fill-white stroke-ink dark:fill-zinc-800 dark:stroke-zinc-200" />
        <path d="M258 64l5-5M261 76h7" stroke-width="2.5" class="stroke-pokemon-red" />
      </g>
      <rect
        x="140" y="50" width="84" height="116" rx="10"
        stroke-width="2.5"
        class="fill-white stroke-ink dark:fill-zinc-800 dark:stroke-zinc-200"
      />
      <rect x="148" y="58" width="68" height="14" rx="4" class="fill-pokemon-red" />
      <circle cx="170" cy="102" r="4" class="fill-ink dark:fill-zinc-100" />
      <circle cx="194" cy="102" r="4" class="fill-ink dark:fill-zinc-100" />
      <path d="M173 115q9 8 18 0" stroke-width="2.5" class="stroke-ink dark:stroke-zinc-100" />
      <ellipse cx="162" cy="112" rx="5" ry="3" class="fill-pokemon-red/30" />
      <ellipse cx="202" cy="112" rx="5" ry="3" class="fill-pokemon-red/30" />
      <path d="M152 140h44M152 150h30" stroke-width="3" class="stroke-black/10 dark:stroke-white/15" />
    </g>

    <!-- Envelope -->
    <g class="art-float" style="--d: 1.2s">
      <rect
        x="246" y="120" width="48" height="34" rx="6"
        stroke-width="2.5"
        class="fill-white stroke-ink dark:fill-zinc-800 dark:stroke-zinc-200"
      />
      <path d="M248 124l22 16 22-16" stroke-width="2.5" class="stroke-ink dark:stroke-zinc-200" />
    </g>

    <!-- Paper plane -->
    <path
      d="M44 150l44-16-18 28-6-11z M64 151l24-17"
      stroke-width="2.5"
      class="fill-white stroke-ink dark:fill-zinc-800 dark:stroke-zinc-200"
    />

    <!-- Sparkles, as in the logo -->
    <path :d="sparkle(104, 142, 9)" class="fill-pokemon-yellow" />
    <path :d="sparkle(264, 42, 8)" class="fill-pokemon-red" />
    <path :d="sparkle(64, 108, 5)" class="fill-pokemon-red" />
    <path :d="sparkle(232, 182, 5)" class="fill-pokemon-yellow" />
  </svg>
</template>

<script setup lang="ts">
// Four-point star centred on (x, y) with arm length r.
const sparkle = (x: number, y: number, r: number) => {
  const k = r * 0.18;
  return (
    `M${x} ${y - r}C${x + k} ${y - k} ${x + k} ${y - k} ${x + r} ${y}` +
    `C${x + k} ${y + k} ${x + k} ${y + k} ${x} ${y + r}` +
    `C${x - k} ${y + k} ${x - k} ${y + k} ${x - r} ${y}` +
    `C${x - k} ${y - k} ${x - k} ${y - k} ${x} ${y - r}Z`
  );
};
</script>

<style scoped>
/* One small wave hello when the tab opens, then still; a slow bob on the
   bubble and envelope. Both off for reduced motion. */
.art-wave {
  /* Pivot at the shoulder, the arm's bottom-left corner. */
  transform-box: fill-box;
  transform-origin: 0% 100%;
  animation: wave 1.1s cubic-bezier(0.22, 1, 0.36, 1) 0.2s both;
}
.art-float {
  animation: float 4s ease-in-out var(--d) infinite;
}
@keyframes wave {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-14deg); }
  55% { transform: rotate(8deg); }
  80% { transform: rotate(-6deg); }
}
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}
@media (prefers-reduced-motion: reduce) {
  .art-wave,
  .art-float {
    animation: none;
  }
}
</style>
