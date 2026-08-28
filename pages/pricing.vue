<template>
  <div>
    <!-- Hero -->
    <section class="px-4 pt-16 pb-4 sm:pt-24">
      <div ref="hero" class="container mx-auto max-w-3xl text-center">
        <span class="reveal-init eyebrow">Pricing</span>
        <h1
          class="reveal-init mt-4 text-display font-bold tracking-tightest text-ink"
        >
          4% a sale. Nothing until you sell.
        </h1>
        <p
          class="reveal-init mx-auto mt-5 max-w-xl text-base leading-relaxed text-ink-muted sm:text-lg"
        >
          Selling online costs 4% of a sale and nothing else — no listing fees,
          no minimum order, nothing to pay until a card actually sells. Add the
          POS only when you want a till.
        </p>
        <p
          class="reveal-init mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1.5 text-[13px] font-semibold text-emerald-700"
        >
          <span class="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Free while we're in beta — 4% starts at public launch
        </p>
      </div>
    </section>

    <!-- Plans -->
    <section class="px-4 py-10">
      <div ref="plansSection" class="container mx-auto max-w-5xl">
        <div class="grid gap-4 lg:grid-cols-3">
          <div
            v-for="plan in plans"
            :key="plan.name"
            class="reveal-init surface relative flex flex-col rounded-2xl p-6 sm:p-7"
            :class="plan.featured ? 'ring-2 ring-pokemon-red' : ''"
          >
            <span
              v-if="plan.featured"
              class="absolute -top-2.5 left-6 rounded-md bg-pokemon-red px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
              >Most shops</span
            >
            <h2 class="text-sm font-semibold text-ink">{{ plan.name }}</h2>
            <p class="mt-3 flex items-baseline gap-1">
              <span class="text-3xl font-bold tracking-tightest text-ink">{{
                plan.price
              }}</span>
              <span class="text-sm text-ink-soft">{{ plan.period }}</span>
            </p>
            <p class="mt-1 text-xs font-medium text-ink-muted">
              {{ plan.plus }}
            </p>
            <p class="mt-4 text-[13px] leading-relaxed text-ink-muted">
              {{ plan.who }}
            </p>
            <ul class="mt-5 flex-1 space-y-2.5">
              <li
                v-for="f in plan.features"
                :key="f"
                class="flex items-start gap-2 text-[13px] leading-snug text-ink"
              >
                <svg
                  class="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {{ f }}
              </li>
            </ul>
          </div>
        </div>
        <p class="reveal-init mt-4 text-center text-xs text-ink-soft">
          Every plan pays the same 4% on marketplace sales. The subscription
          buys the counter — in-store sales through the POS are never charged a
          percentage.
        </p>
      </div>
    </section>

    <!-- Calculator -->
    <section class="px-4 py-10">
      <div ref="calc" class="container mx-auto max-w-5xl">
        <div class="reveal-init surface rounded-2xl p-6 sm:p-8">
          <h2 class="text-sm font-semibold text-ink">
            Work out what you'd pay
          </h2>
          <p class="mt-1.5 text-xs text-ink-soft">
            Drag to match your shop. Nothing is sent anywhere — this runs in
            your browser.
          </p>

          <div class="mt-7 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
            <!-- Inputs -->
            <div class="space-y-6">
              <div>
                <div class="flex items-baseline justify-between gap-4">
                  <label for="calc-avg" class="text-sm font-medium text-ink"
                    >Average sale price</label
                  >
                  <span class="text-sm font-semibold tabular-nums text-ink"
                    >RM{{ avgSale }}</span
                  >
                </div>
                <input
                  id="calc-avg"
                  v-model.number="avgSale"
                  type="range"
                  min="5"
                  max="500"
                  step="5"
                  class="mt-3 w-full accent-pokemon-red"
                />
              </div>

              <div>
                <div class="flex items-baseline justify-between gap-4">
                  <label for="calc-count" class="text-sm font-medium text-ink"
                    >Online sales a month</label
                  >
                  <span class="text-sm font-semibold tabular-nums text-ink">{{
                    salesPerMonth
                  }}</span>
                </div>
                <input
                  id="calc-count"
                  v-model.number="salesPerMonth"
                  type="range"
                  min="1"
                  max="300"
                  step="1"
                  class="mt-3 w-full accent-pokemon-red"
                />
              </div>

              <div>
                <div class="flex items-baseline justify-between gap-4">
                  <label for="calc-wd" class="text-sm font-medium text-ink"
                    >Withdrawals a month</label
                  >
                  <span class="text-sm font-semibold tabular-nums text-ink">{{
                    withdrawals
                  }}</span>
                </div>
                <input
                  id="calc-wd"
                  v-model.number="withdrawals"
                  type="range"
                  min="1"
                  max="30"
                  step="1"
                  class="mt-3 w-full accent-pokemon-red"
                />
                <p class="mt-2 text-xs text-ink-soft">
                  RM1.25 each, however many orders it covers.
                </p>
              </div>

              <div>
                <span class="text-sm font-medium text-ink">Plan</span>
                <div class="mt-3 flex flex-wrap gap-2">
                  <button
                    v-for="p in plans"
                    :key="p.name"
                    type="button"
                    class="rounded-xl border px-3.5 py-2 text-[13px] font-semibold transition-colors"
                    :class="
                      selectedPlan === p.name
                        ? 'border-pokemon-red bg-pokemon-red/[0.06] text-pokemon-red'
                        : 'border-ink/10 text-ink-muted hover:border-ink/25'
                    "
                    @click="selectedPlan = p.name"
                  >
                    {{ p.name }}
                  </button>
                </div>
              </div>
            </div>

            <!-- Result -->
            <div class="rounded-2xl bg-ink p-6 text-white">
              <p class="text-xs uppercase tracking-wider text-white/50">
                You keep each month
              </p>
              <p class="mt-2 text-[34px] font-bold leading-none tracking-tightest">
                RM{{ money(keepAmount) }}
              </p>
              <p class="mt-2 text-xs text-white/50">
                from RM{{ money(revenue) }} in online sales
              </p>

              <dl class="mt-6 space-y-2.5 border-t border-white/10 pt-5 text-[13px]">
                <div class="flex justify-between gap-3">
                  <dt class="text-white/60">Marketplace fee (4%)</dt>
                  <dd class="tabular-nums">−RM{{ money(marketplaceFee) }}</dd>
                </div>
                <div class="flex justify-between gap-3">
                  <dt class="text-white/60">Withdrawals</dt>
                  <dd class="tabular-nums">−RM{{ money(withdrawalFee) }}</dd>
                </div>
                <div v-if="subscription" class="flex justify-between gap-3">
                  <dt class="text-white/60">{{ selectedPlan }} plan</dt>
                  <dd class="tabular-nums">−RM{{ money(subscription) }}</dd>
                </div>
                <div
                  class="flex justify-between gap-3 border-t border-white/10 pt-2.5 font-semibold"
                >
                  <dt>Total cost</dt>
                  <dd class="tabular-nums">RM{{ money(totalCost) }}</dd>
                </div>
              </dl>

              <p class="mt-5 rounded-xl bg-white/[0.07] px-4 py-3 text-xs text-white/70">
                That's
                <span class="font-bold text-white"
                  >{{ effectiveRate }}%</span
                >
                of your online revenue, all in.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Breakdown + worked example -->
    <section class="px-4 py-10">
      <div ref="breakdown" class="container mx-auto max-w-5xl">
        <div class="grid gap-4 lg:grid-cols-2">
          <div class="reveal-init surface rounded-2xl p-6 sm:p-7">
            <h2 class="text-sm font-semibold text-ink">What 4% is made of</h2>
            <dl class="mt-5 space-y-3.5">
              <div
                v-for="line in feeLines"
                :key="line.label"
                class="flex items-baseline justify-between gap-4"
              >
                <dt class="min-w-0">
                  <span class="text-sm text-ink">{{ line.label }}</span>
                  <span class="block text-xs text-ink-soft">{{ line.note }}</span>
                </dt>
                <dd class="shrink-0 text-sm font-semibold tabular-nums text-ink">
                  {{ line.rate }}
                </dd>
              </div>
            </dl>
            <div
              class="mt-5 flex items-baseline justify-between gap-4 border-t border-ink/[0.08] pt-4"
            >
              <span class="text-sm font-bold text-ink">Total per sale</span>
              <span class="text-lg font-bold tabular-nums text-pokemon-red"
                >4.0%</span
              >
            </div>
          </div>

          <div class="reveal-init surface rounded-2xl p-6 sm:p-7">
            <h2 class="text-sm font-semibold text-ink">
              On an RM84 sale, you keep
            </h2>
            <p
              class="mt-4 text-[40px] font-bold leading-none tracking-tightest text-ink"
            >
              RM80.64
            </p>
            <dl class="mt-6 space-y-2.5 text-sm">
              <div class="flex justify-between gap-4">
                <dt class="text-ink-muted">Card sold for</dt>
                <dd class="tabular-nums text-ink">RM84.00</dd>
              </div>
              <div class="flex justify-between gap-4">
                <dt class="text-ink-muted">TCGo fee (4%)</dt>
                <dd class="tabular-nums text-ink">−RM3.36</dd>
              </div>
              <div
                class="flex justify-between gap-4 border-t border-ink/[0.08] pt-2.5 font-semibold"
              >
                <dt class="text-ink">Paid to you</dt>
                <dd class="tabular-nums text-ink">RM80.64</dd>
              </div>
            </dl>
            <p class="mt-5 text-xs leading-relaxed text-ink-soft">
              Withdraw to your bank whenever you like — RM1.25 per withdrawal,
              not per order. Cash out weekly and it's about 12 sen a sale.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- Fee at every price point -->
    <section class="px-4 py-10">
      <div ref="table" class="container mx-auto max-w-5xl">
        <div class="reveal-init surface rounded-2xl p-6 sm:p-7">
          <h2 class="text-sm font-semibold text-ink">
            What you keep, at any price
          </h2>
          <p class="mt-1.5 text-xs text-ink-soft">
            The same 4% whether you're moving a bulk common or a graded slab.
          </p>
          <div class="-mx-6 mt-5 overflow-x-auto px-6 sm:-mx-7 sm:px-7">
            <table class="w-full min-w-[380px] text-sm">
              <thead>
                <tr
                  class="text-left text-xs uppercase tracking-wider text-ink-soft"
                >
                  <th class="pb-3 font-semibold">Sale price</th>
                  <th class="pb-3 text-right font-semibold">TCGo fee</th>
                  <th class="pb-3 text-right font-semibold">You receive</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in examples"
                  :key="row.price"
                  class="border-t border-ink/[0.06]"
                >
                  <td class="py-3 tabular-nums text-ink">{{ row.price }}</td>
                  <td class="py-3 text-right tabular-nums text-ink-muted">
                    {{ row.fee }}
                  </td>
                  <td class="py-3 text-right font-semibold tabular-nums text-ink">
                    {{ row.keep }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>

    <!-- Included free -->
    <section class="px-4 py-10">
      <div ref="included" class="container mx-auto max-w-5xl">
        <h2
          class="reveal-init text-center text-xl font-bold tracking-tight text-ink sm:text-2xl"
        >
          Included at no extra cost
        </h2>
        <div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div
            v-for="item in includedFree"
            :key="item.title"
            class="reveal-init surface rounded-2xl p-5"
          >
            <svg
              class="h-5 w-5 text-emerald-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <h3 class="mt-3.5 text-sm font-semibold text-ink">
              {{ item.title }}
            </h3>
            <p class="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
              {{ item.body }}
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- Comparison -->
    <section class="px-4 py-10">
      <div ref="compare" class="container mx-auto max-w-5xl">
        <div class="reveal-init surface rounded-2xl p-6 sm:p-7">
          <h2 class="text-sm font-semibold text-ink">
            What the same RM84 sale costs elsewhere
          </h2>
          <div class="-mx-6 mt-5 overflow-x-auto px-6 sm:-mx-7 sm:px-7">
            <table class="w-full min-w-[440px] text-sm">
              <thead>
                <tr
                  class="text-left text-xs uppercase tracking-wider text-ink-soft"
                >
                  <th class="pb-3 font-semibold">Platform</th>
                  <th class="pb-3 text-right font-semibold">Take rate</th>
                  <th class="pb-3 text-right font-semibold">Fee on RM84</th>
                  <th class="pb-3 text-right font-semibold">You keep</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in comparison"
                  :key="row.name"
                  class="border-t border-ink/[0.06]"
                  :class="row.us ? 'font-semibold text-ink' : 'text-ink-muted'"
                >
                  <td class="py-3">
                    {{ row.name }}
                    <span
                      v-if="row.us"
                      class="ml-1.5 rounded-md bg-pokemon-red/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-pokemon-red"
                      >You</span
                    >
                  </td>
                  <td class="py-3 text-right tabular-nums">{{ row.rate }}</td>
                  <td class="py-3 text-right tabular-nums">{{ row.fee }}</td>
                  <td class="py-3 text-right tabular-nums">{{ row.keep }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="mt-4 text-xs leading-relaxed text-ink-soft">
            Comparison rates are indicative, taken from each platform's published
            or itemised seller fees in 2026, and include their service tax where
            it applies. Category rates and seller tiers vary — check your own
            rate card before switching.
          </p>
        </div>
      </div>
    </section>

    <!-- FAQ -->
    <section class="px-4 py-10">
      <div ref="faq" class="container mx-auto max-w-3xl">
        <h2
          class="reveal-init text-center text-xl font-bold tracking-tight text-ink sm:text-2xl"
        >
          Questions sellers ask
        </h2>
        <dl class="mt-8 space-y-3">
          <div
            v-for="item in faqs"
            :key="item.q"
            class="reveal-init surface rounded-2xl p-5 sm:p-6"
          >
            <dt class="text-sm font-semibold text-ink">{{ item.q }}</dt>
            <dd class="mt-2 text-[13px] leading-relaxed text-ink-muted">
              {{ item.a }}
            </dd>
          </div>
        </dl>
      </div>
    </section>

    <!-- CTA -->
    <section class="px-4 pb-24 pt-10">
      <div
        ref="cta"
        class="container mx-auto max-w-4xl rounded-3xl bg-ink px-6 py-16 text-center sm:py-20"
      >
        <h2
          class="reveal-init text-display font-bold tracking-tightest text-white"
        >
          Keep more of every sale
        </h2>
        <p class="reveal-init mx-auto mt-4 max-w-lg text-base text-white/60">
          Set up your shop, import your stock, and list your first card today.
          Free while we're in beta.
        </p>
        <div
          class="reveal-init mt-9 flex flex-col justify-center gap-3 sm:flex-row"
        >
          <NuxtLink
            to="/"
            class="rounded-xl bg-pokemon-red px-8 py-3.5 text-base font-semibold text-white shadow-glow transition-transform duration-200 ease-premium hover:-translate-y-0.5"
          >
            Start selling free
          </NuxtLink>
          <NuxtLink
            to="/landing"
            class="rounded-xl border border-white/15 px-8 py-3.5 text-base font-semibold text-white transition-colors hover:border-white/35"
          >
            See how it works
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
  title: "Pricing — 4% flat, no listing or monthly fees | TCGo",
  meta: [
    {
      name: "description",
      content:
        "TCGo charges Malaysian card sellers a flat 4% per sale — 2.5% payment processing plus a 1.5% platform fee. No listing fees, no minimum order, and buyers pay no platform fee. The in-store POS is RM99 a month.",
    },
  ],
});

// Split the way a settlement statement reads, so the 4% is legible as cost
// recovery plus the platform's cut rather than one opaque number. Keep in
// sync with PLATFORM_FEE_PERCENT in shared/payouts.ts.
const feeLines = [
  {
    label: "Payment processing",
    note: "FPX online banking, charged at cost",
    rate: "2.5%",
  },
  {
    label: "Platform fee",
    note: "Listings, marketplace, support and market data",
    rate: "1.5%",
  },
];

// Marketplace selling is priced on the sale (4%); the counter is priced on the
// month. In-store takings never touch our payment rail, so there is nothing to
// take a percentage of — a subscription is the only honest way to charge for
// the POS. RM99 sits deliberately under the general-purpose Malaysian POS
// entry tier (StoreHub ~RM102, Qashier ~RM158) while bundling the card-shop
// specifics those don't have.
const POS_MONTHLY = 99;
const POS_MULTI_MONTHLY = 199;

const plans = [
  {
    name: "Marketplace",
    price: "RM0",
    period: "/month",
    plus: "+ 4% per online sale",
    who: "For sellers clearing a collection or running a shop that's online only.",
    featured: false,
    features: [
      "Unlimited listings",
      "Live market pricing",
      "Courier waybills at cost",
      "Auctions and offers",
    ],
  },
  {
    name: "Shop",
    price: `RM${POS_MONTHLY}`,
    period: "/month",
    plus: "+ 4% per online sale",
    who: "For a shop with a counter. Everything above, plus the till.",
    featured: true,
    features: [
      "Point-of-sale on your phone",
      "Scan cards with the camera",
      "One stock count, counter and online",
      "Price tags and label printing",
      "Daily takings and reports",
    ],
  },
  {
    name: "Multi-outlet",
    price: `RM${POS_MULTI_MONTHLY}`,
    period: "/month",
    plus: "+ 4% per online sale",
    who: "For more than one branch, or several tills on the floor.",
    featured: false,
    features: [
      "Everything in Shop",
      "Unlimited tills and outlets",
      "Per-outlet reporting",
      "Staff accounts and permissions",
      "Stock transfers between outlets",
    ],
  },
];

// ── Calculator ──────────────────────────────────────────────────────
const FEE_RATE = 0.04;
const WITHDRAWAL_FEE = 1.25;

const avgSale = ref(50);
const salesPerMonth = ref(40);
const withdrawals = ref(4);
const selectedPlan = ref<string>("Marketplace");

const money = (n: number) =>
  n.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const revenue = computed(() => avgSale.value * salesPerMonth.value);
const marketplaceFee = computed(() => revenue.value * FEE_RATE);
const withdrawalFee = computed(() => withdrawals.value * WITHDRAWAL_FEE);
const subscription = computed(() =>
  selectedPlan.value === "Shop"
    ? POS_MONTHLY
    : selectedPlan.value === "Multi-outlet"
      ? POS_MULTI_MONTHLY
      : 0,
);
const totalCost = computed(
  () => marketplaceFee.value + withdrawalFee.value + subscription.value,
);
const keepAmount = computed(() => revenue.value - totalCost.value);
const effectiveRate = computed(() =>
  revenue.value > 0 ? ((totalCost.value / revenue.value) * 100).toFixed(1) : "0.0",
);

const examples = [
  { price: "RM10", fee: "−RM0.40", keep: "RM9.60" },
  { price: "RM30", fee: "−RM1.20", keep: "RM28.80" },
  { price: "RM50", fee: "−RM2.00", keep: "RM48.00" },
  { price: "RM84", fee: "−RM3.36", keep: "RM80.64" },
  { price: "RM150", fee: "−RM6.00", keep: "RM144.00" },
  { price: "RM500", fee: "−RM20.00", keep: "RM480.00" },
];

const includedFree = [
  {
    title: "Unlimited listings",
    body: "List your whole binder. Nothing is charged until a card sells.",
  },
  {
    title: "Online inventory",
    body: "Track what you hold, with stock coming off the shop as orders are paid.",
  },
  {
    title: "Live market pricing",
    body: "Current market values on every card so you price with the market.",
  },
  {
    title: "Courier waybills",
    body: "Book and print shipping labels at the courier rate we're quoted.",
  },
];

// Indicative competitor rates — see the footnote in the template. Deliberately
// unbranded for the TCG row: it comes from one seller's settlement statement,
// not a published rate card, so naming the platform would overstate it.
const comparison = [
  { name: "TCGo", rate: "4.0%", fee: "RM3.36", keep: "RM80.64", us: true },
  {
    name: "Other TCG marketplaces",
    rate: "~4.9%",
    fee: "RM4.08",
    keep: "RM79.92",
  },
  {
    name: "Global card marketplaces",
    rate: "~12.8%",
    fee: "RM10.71",
    keep: "RM73.29",
  },
  { name: "Social commerce", rate: "~18.9%", fee: "RM15.88", keep: "RM68.12" },
];

const faqs = [
  {
    q: "Why is the POS a subscription instead of a percentage?",
    a: "Money taken at your counter never passes through us — it goes straight from your customer to you, by cash or your own QR. There's nothing for us to take a cut of, so the till is priced by the month instead. Sell 100 cards over the counter or none at all, the price doesn't move.",
  },
  {
    q: "Do I need the Shop plan to sell online?",
    a: "No. Selling on the marketplace costs 4% a sale and nothing else — the subscription is only for the in-store till, card scanning and label printing.",
  },
  {
    q: "When am I charged?",
    a: "The fee comes out of the sale itself — there's nothing to pay upfront and no invoice at the end of the month. Your funds page shows the fee on every order before you withdraw.",
  },
  {
    q: "What does it cost to get paid?",
    a: "RM1.25 per withdrawal, charged once no matter how many orders it covers. Withdrawing once a week rather than after every sale keeps it to a few sen an order.",
  },
  {
    q: "Do buyers pay a fee?",
    a: "No. The price on the listing is what a buyer pays, plus shipping at the live courier rate. We don't add a checkout surcharge.",
  },
  {
    q: "How is shipping priced?",
    a: "We quote live rates from the courier when the buyer checks out, so they pay close to the real cost of the parcel rather than a flat guess. Buy several cards from one seller and they ship together on one waybill.",
  },
  {
    q: "What if a sale falls through?",
    a: "You're only charged on money that actually reaches you. If an order is cancelled before it's paid out, no fee is taken.",
  },
  {
    q: "Can I cancel the Shop plan?",
    a: "Any time, and it stops at the end of the month you've paid for. Your listings, stock and sales history stay exactly where they are — you just lose the till until you resubscribe.",
  },
  {
    q: "Is there SST on top?",
    a: "Not today. TCGo does not currently charge service tax on its fees. If that changes as the platform grows, we'll tell sellers before it takes effect.",
  },
];

const hero = ref<HTMLElement>();
const plansSection = ref<HTMLElement>();
const calc = ref<HTMLElement>();
const breakdown = ref<HTMLElement>();
const table = ref<HTMLElement>();
const included = ref<HTMLElement>();
const compare = ref<HTMLElement>();
const faq = ref<HTMLElement>();
const cta = ref<HTMLElement>();

// Each block gets its own context so its ScrollTrigger fires on its own
// position rather than the whole page's.
for (const section of [
  hero,
  plansSection,
  calc,
  breakdown,
  table,
  included,
  compare,
  faq,
  cta,
]) {
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
