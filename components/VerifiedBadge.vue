<template>
  <span class="relative inline-flex">
    <button
      ref="trigger"
      type="button"
      @click.stop="open = !open"
      :aria-expanded="open"
      aria-haspopup="dialog"
      aria-label="Verified — what this means"
      class="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 transition-colors hover:bg-emerald-500/20 dark:text-emerald-300"
    >
      <svg class="h-3 w-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
        <path
          fill-rule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
          clip-rule="evenodd"
        />
      </svg>
      Verified
      <svg class="h-2.5 w-2.5 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4M12 8h.01" />
      </svg>
    </button>

    <Transition
      enter-active-class="transition duration-150 ease-out"
      leave-active-class="transition duration-100 ease-in"
      enter-from-class="opacity-0 scale-95 -translate-y-1"
      leave-to-class="opacity-0 scale-95 -translate-y-1"
    >
      <div
        v-if="open"
        ref="panel"
        role="dialog"
        aria-label="About verification"
        class="absolute left-0 top-full z-50 mt-2 w-[min(19rem,calc(100vw-2rem))] origin-top-left rounded-xl border border-black/[0.08] bg-white p-4 text-left shadow-xl dark:border-white/[0.10] dark:bg-[#1b1b21]"
      >
        <p class="text-[13px] font-bold text-ink dark:text-white">Identity verified</p>

        <p class="mt-1.5 text-[12.5px] leading-relaxed text-ink-muted dark:text-zinc-400">
          TCGo checked this member's MyKad against a live selfie, so the name
          on the account is the name on their IC.
        </p>

        <!-- The limit is stated as plainly as the claim. A badge that reads as
             "TCGo vouches for this seller" would be doing work identity
             verification cannot do, and the first bad trade would make it a
             promise we broke. -->
        <p class="mt-2.5 rounded-lg bg-black/[0.03] px-3 py-2 text-[12px] leading-relaxed text-ink-muted dark:bg-white/[0.05] dark:text-zinc-400">
          It confirms <span class="font-semibold text-ink dark:text-zinc-200">who they are</span>,
          not how they trade. Their ratings and sales history are the guide for that.
        </p>

        <p v-if="verifiedOn" class="mt-2.5 text-[11px] text-ink-soft dark:text-zinc-500">
          Verified {{ verifiedOn }}
        </p>

        <p class="mt-2 text-[11px] leading-relaxed text-ink-soft dark:text-zinc-500">
          Checks are run by
          <!-- rel is not optional here: noopener closes the window.opener
               handle a new tab would otherwise get, and this link sits in a
               panel about trust. -->
          <a
            href="https://didit.me"
            target="_blank"
            rel="noopener noreferrer"
            class="font-semibold text-ink-muted underline underline-offset-2 hover:text-pokemon-red dark:text-zinc-400"
          >Didit<span class="sr-only"> (opens in a new tab)</span></a>. TCGo never stores your ID document.
        </p>
      </div>
    </Transition>
  </span>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, computed } from "vue";

const props = defineProps<{
  /** When the check passed. Omitted rather than guessed if unknown. */
  verifiedAt?: number | null;
}>();

const open = ref(false);
const panel = ref<HTMLElement | null>(null);
const trigger = ref<HTMLElement | null>(null);

const verifiedOn = computed(() =>
  props.verifiedAt
    ? new Date(props.verifiedAt).toLocaleDateString("en-MY", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "",
);

const onDocClick = (e: MouseEvent) => {
  if (!open.value) return;
  const t = e.target as Node;
  if (panel.value?.contains(t) || trigger.value?.contains(t)) return;
  open.value = false;
};
const onEsc = (e: KeyboardEvent) => {
  if (e.key === "Escape") open.value = false;
};

onMounted(() => {
  document.addEventListener("click", onDocClick);
  document.addEventListener("keydown", onEsc);
});
onBeforeUnmount(() => {
  document.removeEventListener("click", onDocClick);
  document.removeEventListener("keydown", onEsc);
});
</script>
