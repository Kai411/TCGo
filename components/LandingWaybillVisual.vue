<template>
  <div ref="root" class="relative">
    <div
      ref="label"
      class="surface rounded-2xl p-5 sm:p-6 max-w-sm mx-auto lg:mx-0"
    >
      <!-- Header -->
      <div class="wb-row flex items-center justify-between pb-3">
        <span class="text-sm font-extrabold tracking-tightest text-ink">TCGo</span>
        <span class="chip">J&amp;T Express</span>
      </div>

      <div ref="rule1" class="h-px bg-black/[0.09] origin-left" />

      <!-- Addresses -->
      <div class="py-4 space-y-3">
        <div class="wb-row">
          <p class="eyebrow !text-[9px] !tracking-[0.14em]">From</p>
          <p class="mt-1 text-xs font-semibold text-ink">Kai's Cards</p>
          <p class="text-xs text-ink-muted">Georgetown, 10200 Penang</p>
        </div>
        <div class="wb-row">
          <p class="eyebrow !text-[9px] !tracking-[0.14em]">To</p>
          <p class="mt-1 text-xs font-semibold text-ink">Ahmad Rizal</p>
          <p class="text-xs text-ink-muted">Seksyen 7, 40000 Shah Alam</p>
        </div>
      </div>

      <div ref="rule2" class="h-px bg-black/[0.09] origin-left" />

      <!-- Barcode -->
      <div class="pt-4">
        <div class="flex items-end gap-[2px] h-12" aria-hidden="true">
          <div
            v-for="(w, i) in bars"
            :key="i"
            class="bar h-full origin-bottom bg-ink"
            :style="{ width: `${w}px` }"
          />
        </div>
        <p
          ref="tracking"
          class="mt-2.5 text-[13px] font-bold tabular-price tracking-[0.12em] text-ink"
        >
          &nbsp;
        </p>
      </div>

      <div class="wb-row mt-4 pt-3 border-t border-black/[0.06] flex items-center justify-between text-[11px]">
        <span class="text-ink-muted">Order #TCG-2841</span>
        <span class="font-semibold text-ink tabular-price">0.35 kg</span>
      </div>
    </div>

    <!-- Action -->
    <div
      ref="cta"
      class="mt-4 max-w-sm mx-auto lg:mx-0 rounded-xl bg-ink text-white text-xs font-semibold text-center py-3 flex items-center justify-center gap-2"
    >
      <svg class="w-4 h-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path
          d="M10 3v9m0 0l-3.2-3.2M10 12l3.2-3.2M4 14.5V16a1 1 0 001 1h10a1 1 0 001-1v-1.5"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      Download AWB (PDF)
    </div>
  </div>
</template>

<script setup lang="ts">
// Fixed pattern rather than Math.random() — a random barcode would differ
// between renders and makes the staggered draw-in look inconsistent.
const bars = [
  2, 1, 3, 1, 1, 2, 4, 1, 2, 1, 3, 2, 1, 1, 4, 2, 1, 3, 1, 2, 2, 1, 4, 1, 2, 3,
  1, 1, 2, 4, 1, 2, 1, 3, 1, 2, 2, 1, 3, 1,
];

const TRACKING = "MY 8241 9930 4471";
// Non-breaking space, written as an escape so a formatter can't silently
// collapse it. Reserves the line's height before any characters have been
// typed, so the card doesn't reflow as the number appears.
const BLANK = "\u00A0";

const root = ref<HTMLElement>();
const label = ref<HTMLElement>();
const rule1 = ref<HTMLElement>();
const rule2 = ref<HTMLElement>();
const tracking = ref<HTMLElement>();
const cta = ref<HTMLElement>();

useReveal(root, ({ gsap, reduced, root: el }) => {
  if (reduced) {
    tracking.value!.textContent = TRACKING;
    return;
  }

  // Tweened proxy for the typewriter effect, captured by the onUpdate closure.
  const typer = { i: 0 };

  const tl = gsap.timeline({
    scrollTrigger: { trigger: el, start: "top 78%", once: true },
  });

  tl.from(label.value!, { opacity: 0, y: 24, duration: 0.7 })
    .from([rule1.value!, rule2.value!], { scaleX: 0, duration: 0.6, stagger: 0.1 }, "-=0.4")
    .from(".wb-row", { opacity: 0, y: 8, stagger: 0.07, duration: 0.45 }, "-=0.5")
    // Barcode prints left to right.
    .from(".bar", { scaleY: 0, duration: 0.3, stagger: 0.012, ease: "power2.out" }, "-=0.2")
    // Tracking number types itself in under the barcode. `typer` is captured
    // by the closure rather than read back off the tween, so `this` binding in
    // the callback is irrelevant.
    .to(
      typer,
      {
        i: TRACKING.length,
        duration: 0.8,
        ease: "none",
        onUpdate: () => {
          tracking.value!.textContent =
            TRACKING.slice(0, Math.round(typer.i)) || BLANK;
        },
      },
      "-=0.1"
    )
    .from(cta.value!, { opacity: 0, y: 12, duration: 0.5 }, "-=0.3");
});
</script>
