<template>
  <Teleport to="body">
    <!-- Bottom card on mobile; right-anchored toast on lg+. Each modal
         gets its own <Transition> — they can't share one because Vue's
         Transition requires a single child. -->
    <Transition
      enter-active-class="transition-all duration-300 ease-premium"
      enter-from-class="opacity-0 translate-y-4"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition-all duration-200 ease-premium"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-4"
    >
      <div
        v-if="visible && !showIosSheet"
        class="fixed left-0 right-0 bottom-24 px-3 z-50 sm:left-auto sm:right-4 sm:bottom-4 sm:px-0 sm:max-w-sm pointer-events-none"
      >
        <div
          class="pointer-events-auto rounded-2xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl shadow-black/10 p-4 flex items-center gap-3"
        >
          <img
            src="/tcgo_sprites.png"
            alt=""
            class="w-10 h-10 rounded-xl shrink-0"
          />
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-ink dark:text-white truncate">
              Install TCGo
            </p>
            <p class="text-xs text-ink-muted dark:text-zinc-400">
              {{ subline }}
            </p>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <button
              @click="dismissPrompt"
              class="text-xs font-semibold text-ink-muted dark:text-zinc-400 px-2 py-1.5"
            >
              Later
            </button>
            <button
              @click="onInstall"
              class="text-xs font-bold bg-pokemon-red text-white px-3 py-1.5 rounded-lg"
            >
              {{ canPromptNatively ? "Install" : "How" }}
            </button>
          </div>
        </div>
      </div>

    </Transition>

    <!-- iOS instructions sheet (separate Transition because Vue allows
         only one child per <Transition>). -->
    <Transition
      enter-active-class="transition-all duration-300 ease-premium"
      enter-from-class="opacity-0 translate-y-4"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition-all duration-200 ease-premium"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-4"
    >
      <div
        v-if="showIosSheet"
        class="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      >
        <div
          class="absolute inset-0 bg-black/50"
          @click="showIosSheet = false"
        />
        <div
          class="relative w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 p-5 shadow-2xl"
        >
          <div class="flex items-center gap-3 mb-4">
            <img src="/tcgo_sprites.png" alt="" class="w-10 h-10 rounded-xl" />
            <div>
              <p class="text-base font-bold text-ink dark:text-white">
                Add TCGo to Home Screen
              </p>
              <p class="text-xs text-ink-muted dark:text-zinc-400">
                Open like a real app, no app store needed.
              </p>
            </div>
          </div>
          <ol
            class="space-y-3 text-sm text-ink dark:text-zinc-200 list-decimal pl-5"
          >
            <li>
              Tap the
              <span class="inline-flex items-center gap-1 align-middle">
                <svg
                  class="w-4 h-4 inline"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
                  <polyline points="16 6 12 2 8 6" />
                  <line x1="12" y1="2" x2="12" y2="15" />
                </svg>
                <span class="font-semibold">Share</span>
              </span>
              icon in your Safari toolbar.
            </li>
            <li>
              Scroll down and tap
              <span class="font-semibold">Add to Home Screen</span>.
            </li>
            <li>Tap <span class="font-semibold">Add</span> in the top right.</li>
          </ol>
          <div
            class="mt-5 flex items-center justify-end gap-2 pt-4 border-t border-gray-100 dark:border-zinc-800"
          >
            <button
              @click="dismissForever"
              class="text-xs font-semibold text-ink-muted dark:text-zinc-400 px-3 py-2"
            >
              Don't show again
            </button>
            <button
              @click="showIosSheet = false"
              class="text-sm font-bold bg-pokemon-red text-white px-4 py-2 rounded-lg"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
const {
  shouldOfferInstall,
  canPromptNatively,
  isIosSafari,
  promptInstall,
  dismiss,
} = useInstallPrompt();

const visible = ref(false);
const showIosSheet = ref(false);

// Wait a beat before showing so we don't flash a banner over a freshly
// painted page. Also gives `beforeinstallprompt` time to fire on Chrome.
onMounted(() => {
  setTimeout(() => {
    if (shouldOfferInstall.value) visible.value = true;
  }, 2500);
});

watch(shouldOfferInstall, (v) => {
  if (!v) {
    visible.value = false;
    showIosSheet.value = false;
  }
});

const subline = computed(() => {
  if (canPromptNatively.value) return "One-tap install, then open from home.";
  if (isIosSafari.value) return "Tap Share → Add to Home Screen.";
  return "Quick to install, no app store.";
});

const onInstall = async () => {
  if (canPromptNatively.value) {
    const outcome = await promptInstall();
    if (outcome === "accepted") visible.value = false;
    return;
  }
  // iOS path — show the walkthrough sheet.
  if (isIosSafari.value) {
    showIosSheet.value = true;
  }
};

const dismissPrompt = () => {
  dismiss();
  visible.value = false;
};

const dismissForever = () => {
  dismiss();
  visible.value = false;
  showIosSheet.value = false;
};
</script>
