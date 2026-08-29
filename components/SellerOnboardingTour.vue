<template>
  <Teleport to="body">
    <Transition name="tour-fade">
      <div
        v-if="active"
        class="fixed inset-0 z-[100]"
        role="dialog"
        aria-modal="true"
        :aria-label="`Seller dashboard tour, step ${index + 1} of ${steps.length}`"
      >
        <!-- Click-blocker. Sits under the tooltip so nothing behind the tour
             can be clicked mid-walkthrough; clicking the dim area = skip. -->
        <div class="absolute inset-0" @click="skip" />

        <!-- Spotlight. The huge box-shadow paints the dimmed backdrop, so the
             cut-out around the target stays crisp and animates between steps. -->
        <div
          class="absolute pointer-events-none rounded-2xl ring-2 transition-[top,left,width,height] duration-300 ease-out"
          :class="rect ? 'ring-pokemon-red/80' : 'ring-transparent'"
          :style="spotlightStyle"
        />

        <!-- Tooltip -->
        <div
          ref="tipEl"
          class="absolute w-[calc(100vw-2rem)] max-w-[340px] surface rounded-2xl p-5 shadow-2xl transition-all duration-300 ease-out"
          :style="tipStyle"
          @click.stop
        >
          <div class="flex items-center justify-between gap-3 mb-3">
            <span class="eyebrow">Step {{ index + 1 }} of {{ steps.length }}</span>
            <button
              type="button"
              @click="skip"
              class="text-xs font-semibold text-ink-muted dark:text-zinc-400 hover:text-ink dark:hover:text-white transition-colors"
            >
              Skip tour
            </button>
          </div>

          <h3 class="text-base font-bold text-ink dark:text-white tracking-tight">
            {{ step.title }}
          </h3>
          <p class="mt-1.5 text-sm leading-relaxed text-ink-muted dark:text-zinc-400">
            {{ step.body }}
          </p>

          <!-- Progress dots -->
          <div class="mt-4 flex items-center gap-1">
            <span
              v-for="(s, i) in steps"
              :key="s.id"
              class="h-1 rounded-full transition-all duration-300"
              :class="i === index ? 'w-4 bg-pokemon-red' : i < index ? 'w-1.5 bg-ink/40 dark:bg-white/40' : 'w-1.5 bg-black/10 dark:bg-white/15'"
            />
          </div>

          <div class="mt-4 flex items-center justify-between gap-2">
            <button
              type="button"
              @click="prev"
              :disabled="index === 0"
              class="px-3 py-2 rounded-lg text-sm font-semibold text-ink-muted dark:text-zinc-400 hover:text-ink dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Back
            </button>
            <button
              ref="nextBtn"
              type="button"
              @click="next"
              class="px-4 py-2 rounded-lg text-sm font-semibold bg-ink text-white dark:bg-white dark:text-ink hover:opacity-90 transition-opacity"
            >
              {{ isLast ? "Finish" : "Next" }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * Spotlight walkthrough of the seller area.
 *
 * Each step points at a `[data-tour="<id>"]` element. The layout renders the
 * same nav twice (desktop sidebar, mobile bottom bar) so a selector may match
 * two nodes — we pick whichever is actually visible. Steps whose target is not
 * on the current page (e.g. the dashboard stat tiles while on /seller/orders)
 * are skipped automatically, so the tour works from any seller page.
 */
const { active, stop } = useSellerTour();

type Step = { id: string; target?: string; title: string; body: string };

const allSteps: Step[] = [
  {
    id: "welcome",
    title: "Welcome to your Seller Dashboard",
    body: "This is where you run your shop — stock, sales, orders and payouts all in one place. Let's take a quick look around. It only takes a minute.",
  },
  {
    id: "attention",
    target: "dashboard-attention",
    title: "What needs doing today",
    body: "These tiles count the orders waiting on you — to pack, to ship, or to resolve. Tap any tile to jump straight to that queue in Orders.",
  },
  {
    id: "sales",
    target: "dashboard-sales",
    title: "Your sales at a glance",
    body: "Completed sales, the trend over time, and how much has been paid out or is still on hold. Direct POS sales are folded in too.",
  },
  {
    id: "pos",
    target: "nav-pos",
    title: "POS — sell over the counter",
    body: "Ring up a walk-in customer with your phone's camera. Scan the card, take the money, and stock comes off both the counter and your online listings at once.",
  },
  {
    id: "orders",
    target: "nav-orders",
    title: "Orders",
    body: "Every online order lands here. Confirm, pack, print the waybill, and mark shipped. Orders to the same buyer are merged so they share one parcel.",
  },
  {
    id: "items",
    target: "nav-items",
    title: "Inventory",
    body: "Your single stock count. Add cards one at a time, scan them in, or bulk import a whole collection. Each item can then be listed or sold at the till.",
  },
  {
    id: "listings",
    target: "nav-listings",
    title: "Listings",
    body: "The items you've put up for sale on the marketplace, with live market prices next to yours so you can see what's worth repricing.",
  },
  {
    id: "auctions",
    target: "nav-auctions",
    title: "Auctions",
    body: "Run timed auctions for your rarer cards. Set a starting bid and an end time, then let buyers compete.",
  },
  {
    id: "funds",
    target: "nav-funds",
    title: "Funds & payouts",
    body: "Track what's available, what's locked while an order is in transit, and request a payout to your bank.",
  },
  {
    id: "settings",
    target: "settings",
    title: "Shop settings",
    body: "Your shop profile, verification, shipping preferences and payment details all live behind the gear icon.",
  },
  {
    id: "pricing",
    target: "nav-pricing",
    title: "Plans & pricing",
    body: "Curious what else TCGo can do, or what it costs? This page walks through every feature and the plans available. You can replay this tour anytime from \"Take the tour\".",
  },
];

// Only steps whose target exists in the DOM right now (or which have none).
const steps = ref<Step[]>([]);
const index = ref(0);
const step = computed(() => steps.value[index.value] ?? allSteps[0]);
const isLast = computed(() => index.value >= steps.value.length - 1);

const rect = ref<DOMRect | null>(null);
const tipEl = ref<HTMLElement>();
const nextBtn = ref<HTMLButtonElement>();
const tipSize = ref({ w: 340, h: 220 });

const PAD = 8;

const findTarget = (id?: string): HTMLElement | null => {
  if (!id) return null;
  const nodes = Array.from(
    document.querySelectorAll<HTMLElement>(`[data-tour="${id}"]`),
  );
  return nodes.find((n) => n.getClientRects().length > 0) ?? null;
};

const measure = () => {
  const el = findTarget(step.value.target);
  rect.value = el ? el.getBoundingClientRect() : null;
  if (tipEl.value) {
    tipSize.value = { w: tipEl.value.offsetWidth, h: tipEl.value.offsetHeight };
  }
};

const focusTarget = async () => {
  const el = findTarget(step.value.target);
  if (el) {
    el.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
  }
  await nextTick();
  measure();
  // Smooth scroll keeps moving after this frame; the scroll listener keeps the
  // spotlight glued to the target, and this catches the settled position.
  setTimeout(measure, 350);
  nextBtn.value?.focus({ preventScroll: true });
};

// The spotlight is the *only* thing painting the dim backdrop (via its giant
// box-shadow), on every step. On a target-less step it simply sits under the
// centred tooltip. Swapping dim sources between steps, or collapsing the box
// to 0×0, is what made the backdrop visibly "shrink" on the first Next.
const DIM = "0 0 0 200vmax rgba(0,0,0,0.62)";

const centred = () => {
  const { w, h } = tipSize.value;
  return {
    top: Math.max(16, (window.innerHeight - h) / 2),
    left: Math.max(16, (window.innerWidth - w) / 2),
  };
};

const spotlightStyle = computed(() => {
  if (!rect.value) {
    const c = centred();
    return {
      top: `${c.top}px`,
      left: `${c.left}px`,
      width: `${tipSize.value.w}px`,
      height: `${tipSize.value.h}px`,
      boxShadow: DIM,
    };
  }
  const r = rect.value;
  return {
    top: `${r.top - PAD}px`,
    left: `${r.left - PAD}px`,
    width: `${r.width + PAD * 2}px`,
    height: `${r.height + PAD * 2}px`,
    boxShadow: DIM,
  };
});

const tipStyle = computed(() => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const { w, h } = tipSize.value;
  const GAP = 14;
  const clampX = (x: number) => Math.min(Math.max(16, x), vw - w - 16);
  const clampY = (y: number) => Math.min(Math.max(16, y), vh - h - 16);

  if (!rect.value) {
    const c = centred();
    return { top: `${c.top}px`, left: `${c.left}px` };
  }
  const r = rect.value;
  // Sidebar items sit at the far left — put the card beside them.
  if (r.right + GAP + w < vw && r.left < vw * 0.35) {
    return { top: `${clampY(r.top + r.height / 2 - h / 2)}px`, left: `${r.right + GAP + PAD}px` };
  }
  // Otherwise below if there's room, else above.
  const below = r.bottom + GAP + PAD + h < vh;
  const top = below ? r.bottom + GAP + PAD : r.top - GAP - PAD - h;
  return { top: `${clampY(top)}px`, left: `${clampX(r.left + r.width / 2 - w / 2)}px` };
});

const next = () => {
  if (isLast.value) return finish();
  index.value++;
  focusTarget();
};
const prev = () => {
  if (index.value === 0) return;
  index.value--;
  focusTarget();
};
const finish = () => stop();
const skip = () => stop();

const onKey = (e: KeyboardEvent) => {
  if (e.key === "Escape") skip();
  else if (e.key === "ArrowRight" || e.key === "Enter") next();
  else if (e.key === "ArrowLeft") prev();
};

const begin = async () => {
  await nextTick();
  steps.value = allSteps.filter((s) => !s.target || findTarget(s.target));
  index.value = 0;
  window.addEventListener("resize", measure);
  window.addEventListener("scroll", measure, true);
  window.addEventListener("keydown", onKey);
  document.body.style.overflow = "hidden";
  focusTarget();
};
const teardown = () => {
  window.removeEventListener("resize", measure);
  window.removeEventListener("scroll", measure, true);
  window.removeEventListener("keydown", onKey);
  document.body.style.overflow = "";
};

watch(active, (on) => (on ? begin() : teardown()), { immediate: true });
onBeforeUnmount(teardown);
</script>

<style scoped>
.tour-fade-enter-active,
.tour-fade-leave-active {
  transition: opacity 0.25s ease;
}
.tour-fade-enter-from,
.tour-fade-leave-to {
  opacity: 0;
}
</style>
