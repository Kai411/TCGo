<template>
  <section
    ref="root"
    class="py-20 sm:py-28 px-4"
    :class="tinted ? 'bg-canvas-sunken' : 'bg-white'"
  >
    <div class="container mx-auto max-w-6xl">
      <div class="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
        <!-- Copy -->
        <div :class="reverse ? 'lg:order-2' : ''">
          <div ref="copy">
            <div class="reveal-init flex items-center gap-3 mb-5">
              <span
                class="text-[11px] font-bold tabular-price text-pokemon-red"
                >{{ index }}</span
              >
              <span class="h-px w-8 bg-pokemon-red/30" />
              <span class="eyebrow !text-ink-muted">{{ eyebrow }}</span>
            </div>

            <h2
              class="reveal-init text-[1.75rem] sm:text-4xl font-bold tracking-tightest text-ink leading-[1.1]"
            >
              {{ title }}
            </h2>

            <p class="reveal-init mt-5 text-base sm:text-lg text-ink-muted leading-relaxed">
              {{ body }}
            </p>

            <ul class="mt-8 space-y-3.5">
              <li
                v-for="point in points"
                :key="point"
                class="reveal-init flex items-start gap-3 text-sm text-ink-subtle"
              >
                <svg
                  class="w-[18px] h-[18px] mt-px shrink-0 text-pokemon-red"
                  viewBox="0 0 20 20"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle cx="10" cy="10" r="9" class="fill-pokemon-red/10" />
                  <path
                    d="M6 10.2l2.6 2.6L14 7.4"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
                <span>{{ point }}</span>
              </li>
            </ul>
          </div>
        </div>

        <!-- Visual -->
        <div ref="visual" :class="reverse ? 'lg:order-1' : ''">
          <slot />
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  index: string;
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  reverse?: boolean;
  tinted?: boolean;
}>();

const root = ref<HTMLElement>();
const copy = ref<HTMLElement>();
const visual = ref<HTMLElement>();

useReveal(root, ({ gsap, reduced, settle, timeline }) => {
  const items = copy.value?.querySelectorAll(".reveal-init");
  if (!items?.length) return;

  if (reduced) {
    settle(items);
    return;
  }

  timeline().to(items, { opacity: 1, y: 0, stagger: 0.08 });

  // Slow counter-scroll drift on the visual. Deliberately small (±28px) — this
  // is depth, not a parallax effect the user should consciously notice.
  if (visual.value) {
    gsap.fromTo(
      visual.value,
      { y: 28 },
      {
        y: -28,
        ease: "none",
        scrollTrigger: {
          trigger: root.value!,
          start: "top bottom",
          end: "bottom top",
          scrub: 0.6,
        },
      }
    );
  }
});
</script>
