<template>
  <!-- The banners staff set in Mint Condition → Content. Hidden (or none)
       renders nothing and keeps no space. Several banners rotate on their
       own every few seconds and can be swiped; the loop runs forward
       forever by ending on a copy of the first banner and jumping back to
       the real one without animation. Pass `banner` instead of `placement`
       for the console's preview, which never navigates. -->
  <Transition enter-active-class="transition-opacity duration-200 ease-out" enter-from-class="opacity-0">
    <section
      v-if="shown"
      class="mb-3 min-w-0 select-none"
      aria-roledescription="carousel"
      aria-label="Promotions"
      @mouseenter="hovering = true"
      @mouseleave="hovering = false"
      @focusin="hovering = true"
      @focusout="hovering = false"
    >
      <div
        ref="track"
        class="no-scrollbar flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-xl"
        @scroll.passive="onScroll"
        @pointerdown="touched"
        @wheel.passive="touched"
      >
        <component
          :is="linkFor(s) ? NuxtLinkComp : 'div'"
          v-for="(s, i) in rendered"
          :key="`${s.id}-${i}`"
          v-bind="linkFor(s) ? { to: linkFor(s) } : {}"
          class="relative block w-full shrink-0 snap-center snap-always overflow-hidden bg-black/[0.04] dark:bg-white/[0.06]"
          :class="[
            linkFor(s) ? 'transition-transform duration-150 ease-out active:scale-[0.985]' : '',
            s.imageUrl ? '' : 'bg-gradient-to-br from-pokemon-red to-[#b8290a] dark:from-[#c22d0b] dark:to-[#7a1c06]',
          ]"
          :aria-hidden="i >= slides.length ? 'true' : undefined"
          :tabindex="i >= slides.length ? -1 : undefined"
          :aria-label="linkFor(s) ? s.headline || 'Open promotion' : undefined"
          aria-roledescription="slide"
          draggable="false"
          @click="onClick"
        >
          <div class="aspect-[3/1] w-full lg:aspect-[4/1]">
            <img
              v-if="s.imageUrl"
              :src="cdnUrl(s.imageUrl, 1600)"
              :alt="s.headline ? '' : 'Banner'"
              :loading="i === 0 ? 'eager' : 'lazy'"
              class="block h-full w-full object-cover"
              draggable="false"
            />
          </div>

          <div
            v-if="s.headline || s.subtext || s.linkPath"
            class="absolute inset-0 flex items-end gap-3 p-3 sm:p-5"
            :class="s.imageUrl && (s.headline || s.subtext) ? 'bg-gradient-to-t from-black/65 via-black/20 to-transparent' : ''"
          >
            <div class="min-w-0 flex-1 text-white">
              <p v-if="s.headline" class="text-[15px] font-bold leading-tight sm:text-xl [text-wrap:balance]">
                {{ s.headline }}
              </p>
              <p v-if="s.subtext" class="mt-0.5 line-clamp-2 text-[12px] leading-snug text-white/85 sm:text-sm">
                {{ s.subtext }}
              </p>
            </div>
            <span
              v-if="s.linkPath"
              class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm"
              aria-hidden="true"
            >
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
            </span>
          </div>
        </component>
      </div>

      <!-- Where you are in the rotation; tap a dot to jump. -->
      <div v-if="slides.length > 1" class="mt-2 flex justify-center gap-1.5">
        <button
          v-for="(s, i) in slides"
          :key="s.id"
          type="button"
          class="-my-2 py-2"
          :aria-label="`Banner ${i + 1} of ${slides.length}`"
          :aria-current="i === index ? 'true' : undefined"
          @click="goTo(i, true)"
        >
          <span
            class="block h-1.5 rounded-full transition-all duration-300 ease-out"
            :class="i === index ? 'w-4 bg-ink dark:bg-white' : 'w-1.5 bg-black/20 dark:bg-white/25'"
          />
        </button>
      </div>
    </section>
  </Transition>
</template>

<script setup lang="ts">
import { cdnUrl } from "~/composables/useStorage";
import {
  BANNER_INTERVAL_MS,
  emptyBanner,
  slideHasContent,
  type Banner,
  type BannerPlacement,
  type BannerSlide,
} from "~/shared/site-content";

const props = defineProps<{
  placement?: BannerPlacement;
  /** Preview: render this content as is (shown even when hidden), no navigation. */
  banner?: Banner;
}>();

const NuxtLinkComp = resolveComponent("NuxtLink");
const live = props.placement ? useListingBanner(props.placement) : null;

const b = computed<Banner>(() => props.banner ?? live?.banner.value ?? emptyBanner());
const slides = computed(() => b.value.slides.filter(slideHasContent));
const shown = computed(() => (props.banner ? true : b.value.visible) && slides.value.length > 0);
// The copy of the first banner at the end is what makes the loop seamless.
const rendered = computed<BannerSlide[]>(() =>
  slides.value.length > 1 ? [...slides.value, slides.value[0]!] : slides.value,
);
// The preview keeps the link look but stays on the console.
const linkFor = (s: BannerSlide) => (s.linkPath && !props.banner ? s.linkPath : "");
const onClick = (e: Event) => {
  if (props.banner) e.preventDefault();
};

const track = ref<HTMLElement | null>(null);
const index = ref(0);
const hovering = ref(false);
let lastTouch = 0;
let settleTimer: ReturnType<typeof setTimeout> | undefined;
let tick: ReturnType<typeof setInterval> | undefined;

const touched = () => {
  lastTouch = Date.now();
};

const goTo = (i: number, smooth: boolean) => {
  const el = track.value;
  if (!el) return;
  if (smooth) touched();
  el.scrollTo({ left: i * el.clientWidth, behavior: smooth ? "smooth" : "instant" });
};

// Once a swipe or an automatic slide comes to rest: note where we are, and
// if that's the copy of the first banner, swap to the real one unseen.
const onScroll = () => {
  clearTimeout(settleTimer);
  settleTimer = setTimeout(() => {
    const el = track.value;
    if (!el || !el.clientWidth) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i >= slides.value.length) {
      el.scrollTo({ left: 0, behavior: "instant" });
      index.value = 0;
    } else {
      index.value = i;
    }
  }, 120);
};

const reducedMotion = () =>
  import.meta.client && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const advance = () => {
  const el = track.value;
  if (!el || slides.value.length < 2 || hovering.value || document.hidden) return;
  // Leave it alone for a full turn after someone swipes or taps a dot.
  if (Date.now() - lastTouch < BANNER_INTERVAL_MS) return;
  el.scrollTo({ left: (index.value + 1) * el.clientWidth, behavior: "smooth" });
};

onMounted(() => {
  if (live && !props.banner) live.load();
  if (!reducedMotion()) tick = setInterval(advance, BANNER_INTERVAL_MS);
});
onBeforeUnmount(() => {
  clearInterval(tick);
  clearTimeout(settleTimer);
});

// A different set of banners (console edits, or fresh data): start over.
watch(
  () => slides.value.map((s) => s.id).join(),
  () => {
    index.value = 0;
    nextTick(() => goTo(0, false));
  },
);
</script>
