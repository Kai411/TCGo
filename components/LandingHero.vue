<template>
  <section
    ref="root"
    class="relative overflow-hidden px-4 pt-24 sm:pt-32 pb-16 sm:pb-24"
  >
    <div class="container relative mx-auto max-w-4xl text-center">
      <h1
        class="font-bold text-ink text-[2.5rem] sm:text-[3.5rem] lg:text-hero leading-[1.04] tracking-hero"
      >
        <span class="block overflow-hidden pb-1">
          <span ref="line1" class="block [text-wrap:balance]">Sell at the counter.</span>
        </span>
        <span class="block overflow-hidden pb-1">
          <span ref="line2" class="block [text-wrap:balance]">Sell online. Count once.</span>
        </span>
      </h1>

      <p
        ref="sub"
        class="mx-auto mt-6 max-w-xl text-base sm:text-lg leading-relaxed text-ink-muted [text-wrap:pretty]"
      >
        TCGo is Malaysia's marketplace for trading cards, backed by a
        point-of-sale and inventory system that keeps your counter sales and
        online orders on one stock ledger, with live market pricing and
        shipping labels built in.
      </p>

      <div
        ref="ctas"
        class="mt-9 flex flex-col sm:flex-row gap-3 justify-center"
      >
        <NuxtLink
          to="/"
          class="rounded-xl bg-pokemon-red px-7 py-3.5 text-base font-semibold text-white transition-colors duration-200 ease-premium hover:bg-pokemon-red-dark"
        >
          Start selling free
        </NuxtLink>
        <button
          type="button"
          class="rounded-xl border border-black/[0.10] bg-white px-7 py-3.5 text-base font-semibold text-ink transition-colors hover:border-black/20"
          @click="scrollToFeatures"
        >
          See how it works
        </button>
      </div>

      <!-- Plain facts under the actions: no pill, no status dot, no rotating
           word (2026-11 design audit). -->
      <p ref="facts" class="mx-auto mt-8 max-w-md text-sm text-ink-soft [text-wrap:balance]">
        Now in beta, built in Malaysia. Works with Pokémon, One Piece,
        Lorcana, <span class="whitespace-nowrap">Yu-Gi-Oh!</span> and Digimon cards, graded or raw.
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
const root = ref<HTMLElement>();
const line1 = ref<HTMLElement>();
const line2 = ref<HTMLElement>();
const sub = ref<HTMLElement>();
const ctas = ref<HTMLElement>();
const facts = ref<HTMLElement>();

const scrollToFeatures = () => {
  const el = document.getElementById("features");
  if (!el) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
};

// One entrance, from a visible page: the headline lines rise into place and
// the rest follows. Nothing loops (the old rail pulse and rotating game name
// ran forever with no pause control).
useReveal(root, ({ gsap, reduced }) => {
  if (reduced) return;
  gsap
    .timeline({ defaults: { ease: "power3.out" } })
    .from([line1.value!, line2.value!], { yPercent: 110, duration: 0.95, stagger: 0.09 })
    .from([sub.value!, ctas.value!, facts.value!], { opacity: 0, y: 12, duration: 0.6, stagger: 0.08 }, "-=0.55");
});
</script>
