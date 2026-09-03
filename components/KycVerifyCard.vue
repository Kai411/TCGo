<template>
  <div
    class="surface rounded-2xl border p-5"
    :class="tone.border"
  >
    <div class="flex items-start justify-between gap-3 flex-wrap">
      <div class="min-w-0">
        <p class="text-sm font-bold text-ink dark:text-white">
          Identity verification
          <span
            class="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide"
            :class="tone.badge"
            >{{ tone.label }}</span
          >
        </p>
        <p class="text-[13px] leading-relaxed text-gray-500 dark:text-zinc-400 mt-1.5 max-w-md">
          {{ tone.body }}
        </p>
      </div>

      <button
        v-if="tone.canStart"
        type="button"
        :disabled="starting"
        class="shrink-0 px-4 py-2 rounded-lg text-sm font-semibold bg-ink text-white dark:bg-white dark:text-ink hover:opacity-90 disabled:opacity-60 transition-opacity"
        @click="start"
      >
        {{ starting ? "Opening…" : tone.cta }}
      </button>
    </div>

    <p
      v-if="error"
      class="mt-3 text-[13px] text-red-600 dark:text-red-400"
    >
      {{ error }}
    </p>

    <!-- Consent has to be shown before the flow opens, not after. -->
    <p
      v-if="tone.canStart"
      class="mt-4 text-[11px] leading-relaxed text-gray-400 dark:text-zinc-500"
    >
      Continuing opens our verification partner, Didit, who will ask for your
      MyKad and a short face scan to confirm it's you. They process
      and store the documents; TCGo keeps only the result and your verified
      name. Required under Malaysian PDPA — don't continue if you'd rather not.
    </p>
  </div>
</template>

<script setup lang="ts">
import { KYC_REQUIRED, type KycStatus } from "~/shared/didit";

const { profile } = useMyProfile();
const { authedFetch } = useAuthedFetch();

const starting = ref(false);
const error = ref("");

const status = computed<KycStatus>(
  () => (profile.value?.kycStatus as KycStatus) || "none",
);

// One place deciding copy, colour and whether the button shows, so a state
// can't render as "verified green" while still offering a Verify button.
const tone = computed(() => {
  switch (status.value) {
    case "verified":
      return {
        label: "Verified",
        badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
        border: "border-emerald-200 dark:border-emerald-500/20",
        body: profile.value?.kycVerifiedName
          ? `Verified as ${profile.value.kycVerifiedName}. Make sure your payout account is in the same name.`
          : "Your identity has been verified.",
        canStart: false,
        cta: "",
      };
    case "pending_review":
      return {
        label: "In review",
        badge: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
        border: "border-blue-200 dark:border-blue-500/20",
        body: "Someone is checking your submission by hand. This usually takes a few minutes, and you don't need to do anything.",
        canStart: false,
        cta: "",
      };
    case "in_progress":
      return {
        label: "In progress",
        badge: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
        border: "border-amber-200 dark:border-amber-500/20",
        body: "You've started verifying but haven't finished. Pick up where you left off.",
        canStart: true,
        cta: "Continue",
      };
    case "declined":
      return {
        label: "Not approved",
        badge: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
        border: "border-red-200 dark:border-red-500/20",
        body: "We couldn't verify your identity from what was submitted. You can try again with a clearer photo of your document, in good light.",
        canStart: true,
        cta: "Try again",
      };
    case "expired":
      return {
        label: "Re-verify",
        badge: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
        border: "border-amber-200 dark:border-amber-500/20",
        body: KYC_REQUIRED
          ? "Your verification has aged out and needs renewing before you can keep selling."
          : "Your verification has aged out. Renewing takes about a minute.",
        canStart: true,
        cta: "Re-verify",
      };
    default:
      return {
        // Don't say "Required" while the gate is off — a badge that overstates
        // the consequence is the kind of thing people stop believing.
        label: KYC_REQUIRED ? "Required" : "Optional",
        badge: "bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-zinc-300",
        border: "border-black/[0.06] dark:border-white/[0.08]",
        body: KYC_REQUIRED
          ? "Confirm who you are with your MyKad. It takes about a minute and only needs doing once."
          : "Not needed to start selling yet. Verifying now with your MyKad takes about a minute, shows buyers you're a real seller, and saves doing it later.",
        canStart: true,
        cta: "Verify identity",
      };
  }
});

const route = useRoute();

// Kept from the dynamic import so teardown can reach the SDK without loading
// it again — and without loading it at all for the users who never verify.
let sdk: typeof import("@didit-protocol/sdk-web").DiditSdk | null = null;

/**
 * Take the modal down and let the next attempt start clean.
 *
 * reset() is the whole job: it calls destroy(), which calls close(), then
 * drops the singleton so a later DiditSdk.shared builds a fresh instance.
 * Without the drop, a second verification attempt would be handed the
 * destroyed one. (Checked in the SDK source rather than assumed — calling
 * all three would just be the same work twice.)
 *
 * Wrapped because it runs on unmount, where a throw would surface as an
 * unhandled error during navigation rather than anything actionable.
 */
const teardown = () => {
  try {
    sdk?.reset();
  } catch {
    // Already gone, which is the state we wanted.
  }
  sdk = null;
};

// Navigating away mid-verification must not leave the overlay behind. It is
// position-fixed with its own z-index, so it would sit over whatever page
// came next with no way to dismiss it.
onUnmounted(teardown);

const start = async () => {
  if (starting.value) return;
  starting.value = true;
  error.value = "";
  try {
    const res = await authedFetch<{ url: string | null; alreadyVerified?: boolean }>(
      "/api/kyc/session",
      // Come back to whichever page launched this. Onboarding and the seller
      // verify page both mount this card, and each wants the user returned to
      // itself. The server only honours a same-site path.
      { method: "POST", body: { returnTo: route.path } },
    );
    if (!res.url) return; // already verified — the profile listener reflects it

    // Loaded on demand: the SDK is only needed by the handful of users who
    // actually verify, and it has no business in the main bundle.
    const mod = await import("@didit-protocol/sdk-web");
    sdk = mod.DiditSdk;

    sdk.shared.onComplete = () => {
      // The webhook is the only thing that may set kycStatus — onComplete
      // fires in the user's own browser and says the flow ENDED, not that it
      // passed. The profile listener picks the real result up on its own.
      //
      // What this must do is take the modal down. closeModalOnComplete below
      // already asks for that; calling close() as well costs nothing and
      // covers the cancelled and failed paths, which that flag does not.
      teardown();
    };

    sdk.shared.startVerification({
      url: res.url,
      configuration: {
        // Defaults to FALSE, which is the whole bug: the modal stayed mounted
        // after verification finished, leaving a stray close button floating
        // over the page that asked "exit verification?" for a flow that had
        // already ended.
        closeModalOnComplete: true,
        // Left on (its default). Mid-flow it is right to confirm — losing a
        // half-finished document scan to a stray tap is worse than one extra
        // dialog. It only read as wrong when the modal outlived the flow.
        showExitConfirmation: true,
      },
    });
  } catch (e: any) {
    error.value =
      e?.data?.message || e?.message || "Couldn't start verification. Try again shortly.";
  } finally {
    starting.value = false;
  }
};
</script>
