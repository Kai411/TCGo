<template>
  <!-- Help Center: an FAQ tab (the guide in shared/help.ts) and a Contact us
       tab. Reachable signed out too, since help is most useful before someone
       has an account. -->
  <div class="max-w-xl mx-auto select-none">
    <!-- Desktop keeps its "‹ Account" link and title. -->
    <div class="hidden lg:block">
      <SubpageHeader title="Help Center" desktop-title />
    </div>
    <h1 class="sr-only lg:hidden">Help Center</h1>

    <!-- Phones: the back arrow sits beside the search bar, no title row. -->
    <div class="flex items-center gap-1">
      <NuxtLink
        to="/account"
        aria-label="Back to Account"
        @click.prevent="goBack"
        class="lg:hidden -ml-3 w-11 h-11 shrink-0 inline-flex items-center justify-center rounded-full text-ink dark:text-white transition-transform duration-150 active:scale-90"
      >
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m15 18-6-6 6-6" />
        </svg>
      </NuxtLink>
      <label class="flex-1 min-w-0 flex items-center gap-2 h-11 px-4 rounded-full bg-black/[0.05] dark:bg-white/[0.08] text-ink-soft dark:text-zinc-500">
        <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <span class="sr-only">Search help</span>
        <input
          v-model="query"
          type="search"
          enterkeyhint="search"
          placeholder="Search help"
          class="flex-1 min-w-0 !bg-transparent text-base text-ink dark:text-white placeholder:text-ink-soft dark:placeholder:text-zinc-500 outline-none [&::-webkit-search-cancel-button]:appearance-none"
        />
      </label>
    </div>

    <!-- Tabs -->
    <div class="mt-2 border-b border-black/[0.06] dark:border-white/[0.08]">
      <div ref="containerEl" role="tablist" aria-label="Help Center" class="relative grid grid-cols-2 -mb-px">
        <button
          v-for="t in TABS"
          :key="t.id"
          :id="`help-tab-${t.id}`"
          type="button"
          role="tab"
          :aria-selected="tab === t.id"
          :aria-controls="`help-panel-${t.id}`"
          @click="setTab(t.id)"
          class="h-12 flex items-center justify-center transition-colors duration-150"
          :class="tab === t.id ? 'text-ink dark:text-white' : 'text-ink-soft dark:text-zinc-500'"
        >
          <span :ref="(el) => setTabRef(t.id, el)" class="text-[15px] font-semibold">{{ t.label }}</span>
        </button>
        <span
          aria-hidden="true"
          class="absolute left-0 bottom-0 h-[2px] bg-pokemon-red rounded-full transition-[transform,width,opacity] duration-300 ease-premium"
          :style="indicatorStyle"
        />
      </div>
    </div>

    <!-- FAQ -->
    <div
      v-if="tab === 'faq'"
      id="help-panel-faq"
      role="tabpanel"
      aria-labelledby="help-tab-faq"
      class="pt-4 space-y-4"
    >
      <!-- Search results replace the topic list while there is a query. -->
      <section
        v-if="query.trim()"
        class="panel surface rounded-2xl border border-black/[0.06] dark:border-white/[0.08] overflow-hidden"
      >
        <p
          v-if="!results.length"
          class="lg:px-4 py-6 text-sm text-ink-muted dark:text-zinc-400"
        >
          Nothing matches “{{ query.trim() }}”. Try another word, like order, bid or payout, or
          <button type="button" class="font-semibold text-pokemon-red" @click="setTab('contact')">ask us</button>.
        </p>
        <div v-else class="divide-y divide-black/[0.05] dark:divide-white/[0.06]">
          <HelpArticleRow v-for="a in results" :key="a.slug" :article="a" />
        </div>
      </section>

      <template v-else>
        <section
          v-for="topic in HELP_TOPICS"
          :key="topic.id"
          :aria-labelledby="`help-${topic.id}`"
          class="panel surface rounded-2xl border border-black/[0.06] dark:border-white/[0.08] overflow-hidden lg:pt-3"
        >
          <h2
            :id="`help-${topic.id}`"
            class="lg:px-4 pb-1 text-base font-bold text-ink dark:text-white"
          >
            {{ topic.title }}
          </h2>
          <div class="divide-y divide-black/[0.05] dark:divide-white/[0.06]">
            <HelpArticleRow v-for="a in topic.articles" :key="a.slug" :article="a" />
          </div>
        </section>
      </template>
    </div>

    <!-- Contact us -->
    <div
      v-else
      id="help-panel-contact"
      role="tabpanel"
      aria-labelledby="help-tab-contact"
      class="pt-2"
    >
      <HelpWelcomeArt class="max-w-[320px] mx-auto" />

      <h2 class="mt-1 text-xl font-bold text-ink dark:text-white">We're here to help</h2>
      <p class="mt-1 text-[15px] leading-relaxed text-ink-muted dark:text-zinc-400">
        Stuck on an order, a listing or your account? Send us an enquiry and we'll reply right here, or email us.
      </p>

      <section
        aria-label="Ways to contact us"
        class="surface mt-5 rounded-2xl overflow-hidden"
      >
        <button type="button" class="row press" @click="openEnquiry">
          <span class="row-icon"><IconPencil class="w-[18px] h-[18px]" /></span>
          <span class="flex-1 min-w-0">
            <span class="block text-sm font-medium text-ink dark:text-white">Drop us an enquiry</span>
            <span class="block mt-0.5 text-xs text-ink-soft dark:text-zinc-500">
              {{ signedIn ? "Ask us anything about TCGo" : "Sign in to send one" }}
            </span>
          </span>
          <IconChevron class="w-4 h-4 shrink-0 text-ink-soft dark:text-zinc-500" />
        </button>
        <a :href="`mailto:${HELP_EMAIL}`" class="row press border-t border-black/[0.05] dark:border-white/[0.06]">
          <span class="row-icon"><IconMail class="w-[18px] h-[18px]" /></span>
          <span class="flex-1 min-w-0">
            <span class="block text-sm font-medium text-ink dark:text-white">Email us</span>
            <span class="block mt-0.5 text-xs text-ink-soft dark:text-zinc-500 select-text">{{ HELP_EMAIL }}</span>
          </span>
          <IconChevron class="w-4 h-4 shrink-0 text-ink-soft dark:text-zinc-500" />
        </a>
        <!-- The divider kai asked for: sending above, looking back below. -->
        <div class="h-2 bg-black/[0.03] dark:bg-white/[0.03] border-y border-black/[0.05] dark:border-white/[0.06]" role="separator" />
        <button type="button" class="row press" @click="openHistory">
          <span class="row-icon"><IconHistory class="w-[18px] h-[18px]" /></span>
          <span class="flex-1 min-w-0">
            <span class="block text-sm font-medium text-ink dark:text-white">Enquiry history</span>
            <span class="block mt-0.5 text-xs text-ink-soft dark:text-zinc-500">
              {{ signedIn ? "Your enquiries and our replies" : "Sign in to see yours" }}
            </span>
          </span>
          <IconChevron class="w-4 h-4 shrink-0 text-ink-soft dark:text-zinc-500" />
        </button>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, h, nextTick, onMounted, ref, watch } from "vue";
import { HELP_EMAIL, HELP_TOPICS, searchHelp } from "~/shared/help";

useHead({ title: "Help Center | TCGo" });

const route = useRoute();
const router = useRouter();
const { user, authLoading } = useAuth();
// While auth is still restoring, treat the visitor as signed in: the rows'
// pages show their own sign-in prompt if that turns out wrong.
const signedIn = computed(() => !!user.value || authLoading.value);
const goBack = useGoBack("/account");

const TABS = [
  { id: "faq", label: "FAQ" },
  { id: "contact", label: "Contact us" },
] as const;
type Tab = (typeof TABS)[number]["id"];

// The tab lives in the URL (?tab=contact) so coming back from the enquiry
// form or history lands on Contact us, not FAQ.
const tab = computed<Tab>(() => (route.query.tab === "contact" ? "contact" : "faq"));
const setTab = (t: Tab) => {
  if (t === tab.value) return;
  router.replace({ query: { ...route.query, tab: t === "faq" ? undefined : t } });
};

const query = ref("");
const results = computed(() => searchHelp(query.value));
// Searching only means anything on FAQ, so typing switches to it.
watch(query, (q) => {
  if (q.trim()) setTab("faq");
});

const { containerEl, setTabRef, indicatorStyle, measure } = useTabIndicator();
onMounted(() => nextTick(() => measure(tab.value)));
watch(tab, () => nextTick(() => measure(tab.value)));

// Signed out, both rows go to sign in and come back to this tab.
const { goToLogin } = useSignInGate();
const open = (path: string) => (signedIn.value ? navigateTo(path) : goToLogin());
const openEnquiry = () => open("/account/help/enquiry");
const openHistory = () => open("/account/help/enquiries");

const icon =
  (...children: ReturnType<typeof h>[]) =>
  () =>
    h(
      "svg",
      {
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        "stroke-width": "2",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        "aria-hidden": "true",
      },
      children,
    );
const p = (d: string) => h("path", { d });
const IconPencil = icon(p("M12 20h9"), p("M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"));
const IconMail = icon(h("rect", { x: "3", y: "5", width: "18", height: "14", rx: "2" }), p("m3 7 9 6 9-6"));
const IconHistory = icon(p("M3 12a9 9 0 1 0 3-6.7L3 8"), p("M3 3v5h5"), p("M12 7v5l3 2"));
const IconChevron = icon(p("m9 18 6-6-6-6"));
</script>

<style scoped>
.row {
  @apply w-full flex items-center gap-4 px-4 min-h-[60px] py-2 text-left;
}
.row-icon {
  @apply w-9 h-9 shrink-0 rounded-xl border border-black/[0.08] dark:border-white/[0.10] text-ink dark:text-zinc-200 flex items-center justify-center;
}
/* Same pressed feedback as the Account rows: scale on press, never on hover. */
.press {
  transition: transform 160ms cubic-bezier(0.22, 1, 0.36, 1);
  -webkit-tap-highlight-color: transparent;
}
.press:active {
  transform: scale(0.97);
}
</style>
