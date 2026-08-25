<template>
  <div>
    <LandingHero />

    <!-- Section intro -->
    <section id="features" class="scroll-mt-20 px-4 pt-8 pb-4">
      <div ref="intro" class="container mx-auto max-w-3xl text-center">
        <span class="reveal-init eyebrow">Core features</span>
        <h2
          class="reveal-init mt-4 text-display font-bold tracking-tightest text-ink"
        >
          Everything a card shop runs on
        </h2>
        <p class="reveal-init mt-4 text-base sm:text-lg text-ink-muted">
          Four systems most shops stitch together from spreadsheets, a card
          machine and a courier portal. Here they're one product.
        </p>
      </div>
    </section>

    <LandingFeatureRow
      index="01"
      eyebrow="Point of sale"
      title="One inventory. Counter and online, always in sync."
      body="Ring up a walk-in customer and your online listing updates in the same second. Sell the last copy at the till and it comes off the storefront before anyone can order it."
      :points="[
        'One stock count across the counter and your storefront',
        'Scan a card at the till and it leaves the shelf everywhere',
        'Stock held automatically the moment an online order is paid',
        'No double entry, no overselling what you already sold',
      ]"
    >
      <LandingPosVisual />
    </LandingFeatureRow>

    <LandingFeatureRow
      index="02"
      eyebrow="Live market data"
      title="Know what a card is worth before you price it."
      body="Real-time market pricing on every card you hold, drawn from live sales and active listings — so you're pricing on today's market, not last season's guide."
      reverse
      tinted
      :points="[
        'Live market price on every card in your inventory',
        '30-day trend and last-sold history',
        'Compare against active listings before you commit',
        'Spot the stock worth repricing this week',
      ]"
    >
      <LandingPriceVisual />
    </LandingFeatureRow>

    <LandingFeatureRow
      index="03"
      eyebrow="Reporting"
      title="Every sale in one dashboard, wherever it happened."
      body="Counter takings and online orders land in the same report. See which channel is carrying the month, what's actually moving, and what your shelves are worth today."
      :points="[
        'Online and in-store revenue side by side',
        'Daily, weekly and monthly breakdowns',
        'Best-selling sets and cards at a glance',
        'Inventory value tracked as the market moves',
      ]"
    >
      <LandingDashboardVisual />
    </LandingFeatureRow>

    <LandingFeatureRow
      index="04"
      eyebrow="Fulfilment"
      title="Waybills generated the moment an order is paid."
      body="Pick a courier and get a printable AWB with tracking already attached. No copying addresses into a courier portal, no third account to reconcile at month end."
      reverse
      tinted
      :points="[
        'Printable AWB generated straight from the order',
        'Live courier rates shown at checkout',
        'Tracking pushed to the buyer automatically',
        'West and East Malaysia rates built in',
      ]"
    >
      <LandingWaybillVisual />
    </LandingFeatureRow>

    <!-- Secondary: the marketplace side -->
    <section class="px-4 py-20 sm:py-28">
      <div ref="secondary" class="container mx-auto max-w-5xl">
        <div class="text-center">
          <span class="reveal-init eyebrow">And the marketplace</span>
          <h2
            class="reveal-init mt-4 text-display font-bold tracking-tightest text-ink"
          >
            Your shop, in front of every collector
          </h2>
        </div>

        <div class="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            v-for="item in secondaryItems"
            :key="item.title"
            class="reveal-init surface rounded-2xl p-5"
          >
            <div
              class="flex h-9 w-9 items-center justify-center rounded-xl bg-pokemon-red/[0.08]"
            >
              <span class="text-base">{{ item.icon }}</span>
            </div>
            <h3 class="mt-4 text-sm font-semibold text-ink">{{ item.title }}</h3>
            <p class="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
              {{ item.body }}
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="px-4 pb-24">
      <div
        ref="cta"
        class="container mx-auto max-w-4xl rounded-3xl bg-ink px-6 py-16 sm:py-20 text-center"
      >
        <h2
          class="reveal-init text-display font-bold tracking-tightest text-white"
        >
          Ready to run it all in one place?
        </h2>
        <p class="reveal-init mx-auto mt-4 max-w-lg text-base text-white/60">
          Set up your shop, import your stock, and take your first synced sale
          today. Free while we're in beta.
        </p>
        <div
          class="reveal-init mt-9 flex flex-col sm:flex-row gap-3 justify-center"
        >
          <NuxtLink
            to="/"
            class="rounded-xl bg-pokemon-red px-8 py-3.5 text-base font-semibold text-white shadow-glow transition-transform duration-200 ease-premium hover:-translate-y-0.5"
          >
            Start selling free
          </NuxtLink>
          <NuxtLink
            to="/beta"
            class="rounded-xl border border-white/15 px-8 py-3.5 text-base font-semibold text-white transition-colors hover:border-white/35"
          >
            Request beta access
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="hairline py-8">
      <div class="container mx-auto px-4 text-center text-sm text-ink-soft">
        <p>
          © {{ new Date().getFullYear() }} TCGo Marketplace. Built for the
          Malaysian TCG community.
        </p>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: "landing" });

useHead({
  title:
    "TCGo — POS, Inventory & Marketplace for Card Shops in Malaysia",
  meta: [
    {
      name: "description",
      content:
        "TCGo is the point-of-sale and inventory system for card shops in Malaysia. Sync counter and online sales on one stock ledger, check live market prices, track every sale in one dashboard, and generate shipping waybills instantly.",
    },
  ],
});

const secondaryItems = [
  {
    icon: "⚡",
    title: "Live auctions",
    body: "Real-time bidding with anti-snipe protection and automatic proxy bids.",
  },
  {
    icon: "🛡️",
    title: "Trust system",
    body: "Every buyer and seller carries a trust score, so both sides know who they're dealing with.",
  },
  {
    icon: "🎯",
    title: "Graded & raw",
    body: "PSA, CGC, TAG and Beckett slabs alongside raw cards in any condition.",
  },
  {
    icon: "🇲🇾",
    title: "Local by default",
    body: "Prices in RM, FPX online banking at checkout, and domestic courier rates.",
  },
];

const intro = ref<HTMLElement>();
const secondary = ref<HTMLElement>();
const cta = ref<HTMLElement>();

// Each block gets its own context so its ScrollTrigger fires on its own
// position rather than the whole page's.
for (const section of [intro, secondary, cta]) {
  useReveal(section, ({ reduced, settle, timeline }) => {
    const items = section.value?.querySelectorAll(".reveal-init");
    if (!items?.length) return;

    if (reduced) {
      settle(items);
      return;
    }
    timeline().to(items, { opacity: 1, y: 0, stagger: 0.08 });
  });
}
</script>
