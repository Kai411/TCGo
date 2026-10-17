<template>
  <!-- The banner staff set in Mint Condition → Content. Hidden renders
       nothing and keeps no space. Pass `banner` instead of `placement` for
       the console's preview, which never navigates. -->
  <Transition
    enter-active-class="transition-opacity duration-200 ease-out"
    enter-from-class="opacity-0"
  >
    <component
      :is="linkTo ? NuxtLinkComp : 'div'"
      v-if="shown"
      v-bind="linkTo ? { to: linkTo } : {}"
      class="group relative mb-3 block select-none overflow-hidden rounded-xl bg-black/[0.04] dark:bg-white/[0.06]"
      :class="[
        linkTo ? 'transition-transform duration-150 ease-out active:scale-[0.985]' : '',
        b.imageUrl ? '' : 'bg-gradient-to-br from-pokemon-red to-[#b8290a] dark:from-[#c22d0b] dark:to-[#7a1c06]',
      ]"
      :aria-label="ariaLabel"
      @click="onClick"
    >
      <img
        v-if="b.imageUrl"
        :src="cdnUrl(b.imageUrl, 1600)"
        :alt="b.headline ? '' : 'Banner'"
        class="block aspect-[3/1] w-full object-cover lg:aspect-[4/1]"
        draggable="false"
      />

      <div
        v-if="b.headline || b.subtext"
        class="flex items-end gap-3"
        :class="
          b.imageUrl
            ? 'absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent p-3 sm:p-5'
            : 'min-h-[88px] px-4 py-3.5 sm:px-5 sm:py-4'
        "
      >
        <div class="min-w-0 flex-1 text-white">
          <p
            v-if="b.headline"
            class="text-[15px] font-bold leading-tight sm:text-xl [text-wrap:balance]"
          >
            {{ b.headline }}
          </p>
          <p
            v-if="b.subtext"
            class="mt-0.5 text-[12px] leading-snug text-white/85 line-clamp-2 sm:text-sm"
          >
            {{ b.subtext }}
          </p>
        </div>
        <span
          v-if="b.linkPath"
          class="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm"
          aria-hidden="true"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
        </span>
      </div>
    </component>
  </Transition>
</template>

<script setup lang="ts">
import { cdnUrl } from "~/composables/useStorage";
import { emptyBanner, type Banner, type BannerPlacement } from "~/shared/site-content";

const props = defineProps<{
  placement?: BannerPlacement;
  /** Preview: render this content as is (shown even when hidden), no navigation. */
  banner?: Banner;
}>();

const NuxtLinkComp = resolveComponent("NuxtLink");
const live = props.placement ? useListingBanner(props.placement) : null;
if (live && !props.banner) onMounted(live.load);

const b = computed<Banner>(() => props.banner ?? live?.banner.value ?? emptyBanner());
const shown = computed(() =>
  (props.banner ? true : b.value.visible) && !!(b.value.imageUrl || b.value.headline),
);
// The preview keeps the link look but stays on the console.
const linkTo = computed(() => (b.value.linkPath && !props.banner ? b.value.linkPath : ""));
const ariaLabel = computed(() => (linkTo.value ? b.value.headline || "Open promotion" : undefined));
const onClick = (e: Event) => {
  if (props.banner) e.preventDefault();
};
</script>
