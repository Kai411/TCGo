<template>
  <section
    ref="root"
    class="relative overflow-hidden px-4 pt-24 sm:pt-32 pb-16 sm:pb-24"
  >
    <!-- Ambient wash. Purely decorative, sits behind everything and never
         intercepts pointer events. -->
    <div
      class="pointer-events-none absolute inset-x-0 -top-40 h-[520px] opacity-[0.55]"
      style="
        background: radial-gradient(
          50% 50% at 50% 50%,
          rgba(227, 53, 13, 0.13) 0%,
          rgba(227, 53, 13, 0) 100%
        );
      "
      aria-hidden="true"
    />

    <div class="container relative mx-auto max-w-3xl text-center">
      <div ref="badge" class="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white/80 px-3 py-1.5 shadow-pill">
        <span class="relative flex h-1.5 w-1.5">
          <span
            class="absolute inline-flex h-full w-full animate-ping rounded-full bg-pokemon-red opacity-60"
          />
          <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-pokemon-red" />
        </span>
        <span class="text-[11px] font-semibold tracking-wide text-ink-subtle">
          Now in beta · Built in Malaysia
        </span>
      </div>

      <h1
        class="mt-7 font-bold text-ink text-[2.5rem] sm:text-[3.5rem] lg:text-hero leading-[1.04] tracking-hero"
      >
        <span class="block overflow-hidden pb-1">
          <span ref="line1" class="block">Sell at the counter.</span>
        </span>
        <span class="block overflow-hidden pb-1">
          <span ref="line2" class="block">
            Sell online.
            <span class="text-pokemon-red">Count once.</span>
          </span>
        </span>
      </h1>

      <p
        ref="sub"
        class="mx-auto mt-6 max-w-xl text-base sm:text-lg leading-relaxed text-ink-muted"
      >
        TCGo is Malaysia's marketplace for trading cards — backed by a
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
          class="rounded-xl bg-pokemon-red px-7 py-3.5 text-base font-semibold text-white shadow-glow transition-transform duration-200 ease-premium hover:-translate-y-0.5"
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

      <!-- KV: the four pillars on one rail. This is the whole product in a
           single line — deliberately thin so it reads as a diagram, not a
           second hero. -->
      <div
        ref="rail"
        class="mt-14 flex flex-wrap items-center justify-center gap-x-3 gap-y-3 sm:gap-x-4"
      >
        <template v-for="(node, i) in nodes" :key="node">
          <div class="flex items-center gap-2">
            <span
              class="rail-dot h-1.5 w-1.5 rounded-full bg-ink-faint"
              aria-hidden="true"
            />
            <span class="text-[11px] sm:text-xs font-semibold tracking-wide text-ink-muted">
              {{ node }}
            </span>
          </div>
          <span
            v-if="i < nodes.length - 1"
            class="hidden sm:block h-px w-6 bg-black/[0.10]"
            aria-hidden="true"
          />
        </template>
      </div>

      <p class="mt-8 text-xs text-ink-soft">
        Works with
        <span ref="game" class="font-semibold text-ink-subtle">Pokémon</span>
        ·
        <span class="text-ink-soft">Graded &amp; raw</span>
        ·
        <span class="text-ink-soft">FPX &amp; cards</span>
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
const nodes = ["POS", "Inventory", "Pricing", "Reports", "Shipping"];
const games = ["Pokémon", "One Piece", "Lorcana", "Yu-Gi-Oh!", "Digimon"];

const root = ref<HTMLElement>();
const badge = ref<HTMLElement>();
const line1 = ref<HTMLElement>();
const line2 = ref<HTMLElement>();
const sub = ref<HTMLElement>();
const ctas = ref<HTMLElement>();
const rail = ref<HTMLElement>();
const game = ref<HTMLElement>();

const scrollToFeatures = () => {
  const el = document.getElementById("features");
  if (!el) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
};

useReveal(root, ({ gsap, reduced }) => {
  if (reduced) return;

  // Entrance — no ScrollTrigger, the hero is above the fold by definition.
  gsap
    .timeline({ defaults: { ease: "power3.out" } })
    .from(badge.value!, { opacity: 0, y: 12, duration: 0.6 })
    .from(
      [line1.value!, line2.value!],
      { yPercent: 110, duration: 0.95, stagger: 0.09 },
      "-=0.35"
    )
    .from(sub.value!, { opacity: 0, y: 16, duration: 0.7 }, "-=0.55")
    .from(ctas.value!, { opacity: 0, y: 16, duration: 0.7 }, "-=0.5")
    .from(rail.value!, { opacity: 0, y: 16, duration: 0.7 }, "-=0.5");

  // Signal travelling along the rail, forever — one pillar handing off to the
  // next is exactly what the product does.
  gsap.to(".rail-dot", {
    backgroundColor: "#E3350D",
    scale: 1.6,
    duration: 0.35,
    stagger: { each: 0.45, repeat: -1, repeatDelay: 1.4, yoyo: true },
    delay: 1.6,
  });

  // Keeps the original rotating-TCG character, demoted to a supporting line so
  // the key visual stays quiet. Built as a timeline rather than a setInterval
  // so gsap.context tears it down with everything else on unmount.
  const words = gsap.timeline({ repeat: -1, delay: 2.4 });
  games.forEach((_, idx) => {
    const next = games[(idx + 1) % games.length]!;
    words
      .to(game.value!, { opacity: 0, y: -6, duration: 0.22, ease: "power2.in" })
      .set(game.value!, { textContent: next, y: 6 })
      .to(game.value!, { opacity: 1, y: 0, duration: 0.28 })
      .to({}, { duration: 2.2 }); // hold before the next swap
  });
});
</script>
