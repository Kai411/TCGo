<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-150"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 backdrop-blur-[2px] sm:items-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="whats-new-title"
        @click.self="dismiss"
      >
        <Transition
          enter-active-class="transition-transform duration-250 ease-out"
          enter-from-class="translate-y-full sm:translate-y-4"
          leave-active-class="transition-transform duration-150 ease-in"
          leave-to-class="translate-y-full sm:translate-y-4"
          appear
        >
          <div
            v-if="open"
            class="surface w-full max-w-md overflow-hidden rounded-t-2xl border border-black/[0.06] shadow-xl dark:border-white/[0.08] sm:rounded-2xl"
          >
            <!-- Grab handle, mobile only: this is a bottom sheet there. -->
            <div class="flex justify-center pt-2.5 sm:hidden">
              <span class="h-1 w-9 rounded-full bg-black/[0.14] dark:bg-white/[0.18]" />
            </div>

            <div class="px-5 pb-1 pt-4">
              <p
                class="text-[11px] font-semibold uppercase tracking-wide text-pokemon-red"
              >
                What's new
              </p>
              <h2
                id="whats-new-title"
                class="mt-1 text-lg font-bold leading-tight text-ink dark:text-white"
              >
                {{ headline }}
              </h2>
            </div>

            <!-- Scrolls on its own so a long history never pushes the button
                 off a short screen. -->
            <div class="max-h-[55vh] overflow-y-auto px-5 py-3">
              <section
                v-for="(release, i) in showing"
                :key="release.version"
                :class="
                  i > 0
                    ? 'mt-5 border-t border-black/[0.06] pt-5 dark:border-white/[0.08]'
                    : ''
                "
              >
                <!-- The version and date only matter when there is more than
                     one release on screen to tell apart. -->
                <div v-if="showing.length > 1" class="mb-2 flex items-baseline gap-2">
                  <p class="text-[13px] font-bold text-ink dark:text-white">
                    {{ release.title }}
                  </p>
                  <span class="text-[11px] text-gray-400 dark:text-zinc-500">
                    {{ formatDate(release.date) }}
                  </span>
                </div>

                <ul class="space-y-2.5">
                  <li
                    v-for="note in release.notes"
                    :key="note"
                    class="flex gap-2.5 text-[13.5px] leading-relaxed text-gray-600 dark:text-zinc-300"
                  >
                    <span
                      class="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-pokemon-red"
                      aria-hidden="true"
                    />
                    <span>{{ note }}</span>
                  </li>
                </ul>
              </section>
            </div>

            <div
              class="border-t border-black/[0.06] px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 dark:border-white/[0.08]"
            >
              <button
                ref="dismissButton"
                type="button"
                @click="dismiss"
                class="w-full rounded-xl bg-pokemon-red py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                Got it
              </button>
              <p class="mt-2 text-center text-[11px] text-gray-400 dark:text-zinc-500">
                Version {{ APP_VERSION }}
              </p>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { APP_VERSION } from "~/shared/releases";

const { open, showing, dismiss } = useWhatsNew();

const headline = computed(() =>
  showing.value.length > 1
    ? "Here's what you missed"
    : (showing.value[0]?.title ?? "What's new"),
);

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", year: "numeric" });

// Escape closes it, like every other overlay in the app.
const onKey = (e: KeyboardEvent) => {
  if (e.key === "Escape" && open.value) dismiss();
};
onMounted(() => window.addEventListener("keydown", onKey));
onBeforeUnmount(() => window.removeEventListener("keydown", onKey));

// Move focus to the one action when it opens, so a keyboard or screen-reader
// user lands inside the dialog rather than behind it.
const dismissButton = ref<HTMLButtonElement | null>(null);
watch(open, async (isOpen) => {
  if (!isOpen) return;
  await nextTick();
  dismissButton.value?.focus();
});
</script>
