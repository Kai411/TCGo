<template>
  <div ref="root" class="surface rounded-3xl p-5 sm:p-7">
    <div class="flex items-start justify-between gap-3">
      <div>
        <p class="eyebrow !text-[9px] !tracking-[0.14em]">Market price</p>
        <p class="mt-1.5 text-sm font-semibold text-ink">Charizard ex · 199/165</p>
      </div>
      <span class="chip chip-accent shrink-0 flex items-center gap-1.5">
        <span
          ref="liveDot"
          class="w-1.5 h-1.5 rounded-full bg-pokemon-red"
        />
        Live
      </span>
    </div>

    <!-- Headline price -->
    <div class="mt-5 flex items-end gap-3">
      <p
        ref="price"
        class="text-4xl sm:text-[2.75rem] font-bold text-ink tabular-price leading-none tracking-tightest"
      >
        RM 0.00
      </p>
      <span
        ref="delta"
        class="mb-1 inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-bold text-emerald-600 tabular-price"
      >
        <svg class="w-3 h-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path
            d="M6 9.5V2.5M6 2.5L3 5.5M6 2.5l3 3"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        4.2%
      </span>
    </div>
    <p class="mt-1.5 text-xs text-ink-soft">30-day trend · 1,284 sales tracked</p>

    <!-- Sparkline -->
    <div class="mt-5 relative">
      <svg
        viewBox="0 0 320 96"
        class="w-full h-24 overflow-visible"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="tcgo-spark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#E3350D" stop-opacity="0.18" />
            <stop offset="100%" stop-color="#E3350D" stop-opacity="0" />
          </linearGradient>
          <!-- The reveal is a left-to-right wipe rather than a stroke-dash
               draw-on. Dash lengths are measured in screen space under
               `vector-effect: non-scaling-stroke`, but `pathLength` normalises
               in user space — and preserveAspectRatio="none" stretches x by
               ~1.7x, so a "full length" dash covered only ~60% of the rendered
               path and the line stopped dead mid-chart. A clip wipe has no
               such coupling, and reads the same: data filling in over time. -->
          <clipPath id="tcgo-spark-clip">
            <rect ref="clip" x="0" y="0" width="0" height="96" />
          </clipPath>
        </defs>
        <g clip-path="url(#tcgo-spark-clip)">
          <path :d="`${LINE} L320,96 L0,96 Z`" fill="url(#tcgo-spark)" />
          <path
            :d="LINE"
            fill="none"
            stroke="#E3350D"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            vector-effect="non-scaling-stroke"
          />
        </g>
      </svg>
      <!-- End marker sits on the last vertex of LINE (320,12 → top-right) -->
      <span
        ref="marker"
        class="absolute right-0 w-2.5 h-2.5 -mr-[5px] rounded-full bg-pokemon-red ring-4 ring-pokemon-red/15 opacity-0"
        :style="{ top: 'calc(12.5% - 5px)' }"
      />
    </div>

    <!-- Supporting rows -->
    <div class="mt-5 pt-4 border-t border-black/[0.06] space-y-2.5">
      <div
        v-for="row in rows"
        :key="row.label"
        class="row-item flex items-center justify-between text-xs"
      >
        <span class="text-ink-muted">{{ row.label }}</span>
        <span class="font-semibold text-ink tabular-price">{{ row.value }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Single source of truth for the sparkline geometry — the area fill reuses it
// and the end marker is positioned off its final vertex (320,12).
const LINE =
  "M0,74 L27,68 L53,72 L80,55 L107,61 L133,44 L160,49 L187,32 L213,38 L240,26 L267,30 L293,18 L320,12";

const rows = [
  { label: "Last sold", value: "RM 240.00 · 2h ago" },
  { label: "Active listings", value: "18 · from RM 232" },
  { label: "Your cost", value: "RM 188.00" },
];

// Sparkline viewBox width — the wipe animates the clip rect out to this.
const SPARK_W = 320;

const root = ref<HTMLElement>();
const price = ref<HTMLElement>();
const delta = ref<HTMLElement>();
const clip = ref<SVGRectElement>();
const marker = ref<HTMLElement>();
const liveDot = ref<HTMLElement>();

useReveal(root, ({ gsap, reduced, countUp, root: el }) => {
  const fmt = (v: number) =>
    `RM ${v.toLocaleString("en-MY", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  if (reduced) {
    price.value!.textContent = fmt(245);
    gsap.set(clip.value!, { attr: { width: SPARK_W } });
    gsap.set(marker.value!, { opacity: 1 });
    return;
  }

  countUp(price.value!, 245, fmt, { trigger: el, duration: 1.4 });
  gsap.set(delta.value!, { opacity: 0, scale: 0.8 });

  const tl = gsap.timeline({
    scrollTrigger: { trigger: el, start: "top 80%", once: true },
  });

  tl.to(clip.value!, {
    attr: { width: SPARK_W },
    duration: 1.4,
    ease: "power2.inOut",
  })
    .to(marker.value!, { opacity: 1, scale: 1, duration: 0.4, ease: "back.out(2)" }, "-=0.2")
    .to(delta.value!, { opacity: 1, scale: 1, duration: 0.4, ease: "back.out(2)" }, "-=0.3")
    // Selector string, not querySelectorAll — gsap.context scopes bare
    // selectors to the component root for us.
    .from(".row-item", { opacity: 0, y: 10, stagger: 0.08, duration: 0.5 }, "-=0.3");

  // "Live" heartbeat. Only the chip dot — the sparkline marker is owned by the
  // reveal timeline above, and a second repeating tween on its opacity would
  // fight that one whenever the section scrolls into view late.
  gsap.to(liveDot.value!, {
    opacity: 0.3,
    duration: 0.9,
    repeat: -1,
    yoyo: true,
    ease: "sine.inOut",
  });
});
</script>
