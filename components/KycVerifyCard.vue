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
      MyKad or passport and a short face scan to confirm it's you. They process
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
          ? "Confirm who you are with your MyKad or passport. It takes about a minute and only needs doing once."
          : "Not needed to start selling yet. Verifying now with your MyKad or passport takes about a minute, shows buyers you're a real seller, and saves doing it later.",
        canStart: true,
        cta: "Verify identity",
      };
  }
});

const start = async () => {
  if (starting.value) return;
  starting.value = true;
  error.value = "";
  try {
    const res = await authedFetch<{ url: string | null; alreadyVerified?: boolean }>(
      "/api/kyc/session",
      { method: "POST", body: {} },
    );
    if (!res.url) return; // already verified — the profile listener reflects it

    // Loaded on demand: the SDK is only needed by the handful of users who
    // actually verify, and it has no business in the main bundle.
    const { DiditSdk } = await import("@didit-protocol/sdk-web");
    DiditSdk.shared.onComplete = () => {
      // Deliberately does nothing but close. `onComplete` fires in the user's
      // own browser and says the flow ended, NOT that it passed — the webhook
      // is the only thing that may set kycStatus, and the profile listener
      // picks that up on its own.
    };
    DiditSdk.shared.startVerification({ url: res.url });
  } catch (e: any) {
    error.value =
      e?.data?.message || e?.message || "Couldn't start verification. Try again shortly.";
  } finally {
    starting.value = false;
  }
};
</script>
