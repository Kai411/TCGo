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
          Five systems most shops stitch together from spreadsheets, a card
          machine and a courier portal. Here they're one product.
        </p>
      </div>
    </section>

    <LandingFeatureRow
      index="01"
      eyebrow="Point of sale"
      title="A till that runs on the phone in your pocket."
      body="Ring up a walk-in customer with the camera you already own. Scan the card, take the money, print the price tag — no card reader, no separate terminal, no extra hardware to buy."
      :points="[
        'Scan cards with your phone — no scanner or extra equipment',
        'Print item labels and price tags straight from the platform',
        'Take payment on the spot with your own QR code',
        'Or tap-to-pay on the same phone (additional charge applies)',
      ]"
    >
      <LandingPosVisual />
    </LandingFeatureRow>

    <LandingFeatureRow
      index="02"
      eyebrow="Inventory"
      title="One stock count. Counter and online, always in sync."
      body="Sell the last copy at the till and it comes off your storefront before anyone can order it. One ledger behind both channels means no double entry and nothing oversold."
      reverse
      tinted
      :points="[
        'One stock count across the counter and your storefront',
        'Sell in-store and the online listing updates in the same second',
        'Stock held automatically the moment an online order is paid',
        'Every movement traceable back to the sale that caused it',
      ]"
    >
      <LandingInventoryVisual />
    </LandingFeatureRow>

    <LandingFeatureRow
      index="03"
      eyebrow="Live market data"
      title="Know what a card is worth before you price it."
      body="Real-time market pricing on every card you hold, drawn from live sales and active listings — so you're pricing on today's market, not last season's guide."
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
      index="04"
      eyebrow="Reporting"
      title="Every sale in one dashboard, wherever it happened."
      body="Counter takings and online orders land in the same report. See which channel is carrying the month, what's actually moving, and what your shelves are worth today."
      reverse
      tinted
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
      index="05"
      eyebrow="Fulfilment"
      title="Waybills generated the moment an order is paid."
      body="Pick a courier and get a printable AWB with tracking already attached. No copying addresses into a courier portal, no third account to reconcile at month end."
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
            <LandingFeatureIcon :name="item.icon" />
            <h3 class="mt-4 text-sm font-semibold text-ink">{{ item.title }}</h3>
            <p class="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
              {{ item.body }}
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- Pricing teaser -->
    <section id="pricing" class="scroll-mt-20 px-4 py-20 sm:py-24">
      <div ref="pricing" class="container mx-auto max-w-5xl">
        <div
          class="reveal-init surface rounded-3xl px-6 py-12 text-center sm:px-10 sm:py-14"
        >
          <span class="eyebrow">Pricing</span>
          <h2
            class="mt-4 text-display font-bold tracking-tightest text-ink"
          >
            4% a sale. 3% with Vendor.
          </h2>
          <p
            class="mx-auto mt-4 max-w-lg text-base leading-relaxed text-ink-muted"
          >
            No listing fees, no minimum order, nothing to pay until a card
            sells. Run your counter on TCGo and every online sale drops to 3%.
          </p>

          <div
            class="mx-auto mt-9 grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-3"
          >
            <div
              v-for="stat in pricingStats"
              :key="stat.label"
              class="rounded-2xl bg-ink/[0.03] px-4 py-5"
            >
              <p class="text-2xl font-bold tabular-nums text-ink">
                {{ stat.value }}
              </p>
              <p class="mt-1 text-xs text-ink-soft">{{ stat.label }}</p>
            </div>
          </div>

          <NuxtLink
            to="/pricing"
            class="mt-9 inline-flex items-center gap-1.5 rounded-xl bg-ink px-7 py-3 text-sm font-semibold text-white transition-transform duration-200 ease-premium hover:-translate-y-0.5"
          >
            See full pricing
            <span aria-hidden="true">→</span>
          </NuxtLink>
          <p class="mt-4 text-xs text-ink-soft">
            2% while we're in beta — 4% at public launch.
          </p>
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
    "TCGo — Malaysia's TCG Marketplace, POS & Inventory for Card Shops",
  meta: [
    {
      name: "description",
      content:
        "TCGo is Malaysia's trading card marketplace, backed by a point-of-sale and inventory system for card shops. Sell at the counter and online from one stock ledger, take payment by QR or tap-to-pay, check live market prices, and print shipping waybills instantly.",
    },
  ],
});

const secondaryItems = [
  {
    icon: "auction" as const,
    title: "Live auctions",
    body: "Real-time bidding with anti-snipe protection and automatic proxy bids.",
  },
  {
    icon: "trust" as const,
    title: "Trust system",
    body: "Every buyer and seller carries a trust score, so both sides know who they're dealing with.",
  },
  {
    icon: "graded" as const,
    title: "Graded & raw",
    body: "PSA, CGC, TAG and Beckett slabs alongside raw cards in any condition.",
  },
  {
    icon: "local" as const,
    title: "Local by default",
    body: "Prices in RM, FPX online banking at checkout, and domestic courier rates.",
  },
];

// Headline numbers only — the full breakdown lives on /pricing.
const pricingStats = [
  { value: "4%", label: "per sale, or 3% on Vendor" },
  { value: "RM0", label: "listing fees" },
  { value: "RM0", label: "buyer platform fee" },
];

const intro = ref<HTMLElement>();
const secondary = ref<HTMLElement>();
const pricing = ref<HTMLElement>();
const cta = ref<HTMLElement>();

// Each block gets its own context so its ScrollTrigger fires on its own
// position rather than the whole page's.
for (const section of [intro, secondary, pricing, cta]) {
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
