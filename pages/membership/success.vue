<template>
  <!-- Where Stripe checkout lands after a Pro payment. A small celebration:
       three cards fan out with the Pro star on the front one, then the
       line and the two ways on. Motion is decoration only and is off under
       reduced motion. -->
  <div class="max-w-md mx-auto text-center py-6 lg:py-16 min-h-[calc(100dvh-13rem)] lg:min-h-0 flex flex-col justify-center">
    <div class="hero relative mx-auto w-[260px] h-[220px]" aria-hidden="true">
      <div class="glow absolute inset-0 rounded-full" />

      <svg class="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 260 220">
        <!-- Back cards -->
        <g class="card card-left">
          <rect x="70" y="40" width="104" height="146" rx="12" class="fill-white dark:fill-[#26262C] stroke-black/10 dark:stroke-white/10" stroke-width="1.5" />
          <rect x="80" y="50" width="84" height="62" rx="6" class="fill-black/[0.05] dark:fill-white/[0.06]" />
          <rect x="80" y="122" width="56" height="7" rx="3.5" class="fill-black/[0.08] dark:fill-white/[0.10]" />
          <rect x="80" y="136" width="40" height="7" rx="3.5" class="fill-black/[0.06] dark:fill-white/[0.08]" />
        </g>
        <g class="card card-right">
          <rect x="86" y="40" width="104" height="146" rx="12" class="fill-white dark:fill-[#26262C] stroke-black/10 dark:stroke-white/10" stroke-width="1.5" />
          <rect x="96" y="50" width="84" height="62" rx="6" class="fill-black/[0.05] dark:fill-white/[0.06]" />
          <rect x="96" y="122" width="56" height="7" rx="3.5" class="fill-black/[0.08] dark:fill-white/[0.10]" />
          <rect x="96" y="136" width="40" height="7" rx="3.5" class="fill-black/[0.06] dark:fill-white/[0.08]" />
        </g>

        <!-- Front card: the Pro star -->
        <g class="card card-front">
          <defs>
            <linearGradient id="pro-card" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#F0532B" />
              <stop offset="1" stop-color="#C42A08" />
            </linearGradient>
          </defs>
          <rect x="78" y="30" width="104" height="146" rx="12" fill="url(#pro-card)" />
          <rect x="78.75" y="30.75" width="102.5" height="144.5" rx="11.25" fill="none" stroke="white" stroke-opacity="0.25" stroke-width="1.5" />
          <path
            d="M130 70l9.3 18.8 20.7 3-15 14.6 3.5 20.6-18.5-9.7-18.5 9.7 3.5-20.6-15-14.6 20.7-3z"
            fill="white"
          />
          <rect x="108" y="146" width="44" height="14" rx="7" fill="white" fill-opacity="0.22" />
          <text x="130" y="156.5" text-anchor="middle" font-size="9" font-weight="700" letter-spacing="1.2" fill="white">PRO</text>
        </g>

        <!-- Sparkles -->
        <path class="spark s1" d="M44 62l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="#F5B83D" />
        <path class="spark s2" d="M214 46l2.2 5.8 5.8 2.2-5.8 2.2-2.2 5.8-2.2-5.8-5.8-2.2 5.8-2.2z" fill="#E3350D" />
        <path class="spark s3" d="M220 150l2.6 7 7 2.6-7 2.6-2.6 7-2.6-7-7-2.6 7-2.6z" fill="#F5B83D" />
        <circle class="spark s4" cx="38" cy="150" r="4" fill="#E3350D" fill-opacity="0.8" />
        <circle class="spark s2" cx="200" cy="96" r="3" fill="#F5B83D" fill-opacity="0.9" />
      </svg>
    </div>

    <h1 class="mt-4 text-2xl font-extrabold text-ink dark:text-white">Welcome to Pro!</h1>
    <p class="mt-2 text-ink-muted dark:text-zinc-400">
      Your subscription is now active. Enjoy unlimited card scans.
    </p>

    <div class="mt-8 flex flex-col gap-2 px-4 sm:px-0">
      <NuxtLink
        to="/collection"
        class="press flex items-center justify-center min-h-[48px] rounded-full text-sm font-semibold bg-ink text-white dark:bg-white dark:text-ink"
      >
        Scan cards in Collection
      </NuxtLink>
      <NuxtLink
        to="/account"
        class="press flex items-center justify-center min-h-[48px] rounded-full text-sm font-semibold text-ink dark:text-white"
      >
        Back to your account
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Welcome to Pro | TCGo' });

definePageMeta({ layout: 'default' });
</script>

<style scoped>
.glow {
  background: radial-gradient(closest-side, rgb(227 53 13 / 0.16), rgb(245 184 61 / 0.08) 60%, transparent);
}
:global(.dark) .glow {
  background: radial-gradient(closest-side, rgb(227 53 13 / 0.26), rgb(245 184 61 / 0.08) 60%, transparent);
}

.card {
  transform-box: fill-box;
  transform-origin: 50% 100%;
}
/* Resting pose: back cards fanned, front card upright. */
.card-left { transform: rotate(-14deg) translateX(-14px); }
.card-right { transform: rotate(14deg) translateX(14px); }

.spark {
  transform-box: fill-box;
  transform-origin: center;
}

@media (prefers-reduced-motion: no-preference) {
  .card-left { animation: fan-left 700ms cubic-bezier(0.22, 1, 0.36, 1) 120ms both; }
  .card-right { animation: fan-right 700ms cubic-bezier(0.22, 1, 0.36, 1) 120ms both; }
  .card-front { animation: rise 600ms cubic-bezier(0.22, 1, 0.36, 1) both; }
  .spark { animation: pop 500ms cubic-bezier(0.22, 1, 0.36, 1) both, twinkle 2.8s ease-in-out 900ms infinite; }
  .s1 { animation-delay: 380ms, 900ms; }
  .s2 { animation-delay: 460ms, 1300ms; }
  .s3 { animation-delay: 540ms, 1700ms; }
  .s4 { animation-delay: 620ms, 2100ms; }
}

@keyframes fan-left {
  from { transform: rotate(0deg) translateX(0); }
  to { transform: rotate(-14deg) translateX(-14px); }
}
@keyframes fan-right {
  from { transform: rotate(0deg) translateX(0); }
  to { transform: rotate(14deg) translateX(14px); }
}
@keyframes rise {
  from { transform: translateY(16px) scale(0.94); opacity: 0; }
  to { transform: translateY(0) scale(1); opacity: 1; }
}
@keyframes pop {
  from { transform: scale(0); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
@keyframes twinkle {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(0.7); opacity: 0.55; }
}

.press {
  transition: transform 160ms cubic-bezier(0.22, 1, 0.36, 1);
  -webkit-tap-highlight-color: transparent;
}
.press:active {
  transform: scale(0.97);
}
</style>
