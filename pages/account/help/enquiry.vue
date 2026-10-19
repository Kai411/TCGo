<template>
  <!-- Drop us an enquiry: what it's about, an optional order number, and the
       question. Staff answer in Mint Condition > Enquiries; the reply shows in
       Enquiry history. See shared/enquiries.ts. -->
  <div class="max-w-xl mx-auto">
    <SubpageHeader
      title="Drop us an enquiry"
      back="/account/help?tab=contact"
      back-label="Help Center"
      desktop-title
    />

    <div v-if="!user && !authLoading" class="py-12 text-center space-y-4">
      <p class="text-sm text-ink-muted dark:text-zinc-400">
        Sign in to send an enquiry, or email us at
        <a :href="`mailto:${HELP_EMAIL}`" class="font-semibold text-pokemon-red">{{ HELP_EMAIL }}</a>.
      </p>
      <button
        type="button"
        @click="goToLogin"
        class="inline-flex items-center min-h-[44px] px-6 rounded-full text-sm font-semibold bg-ink text-white dark:bg-white dark:text-ink transition-transform duration-150 active:scale-[0.97]"
      >
        Sign in
      </button>
    </div>

    <form v-else class="space-y-6" novalidate @submit.prevent="send">
      <fieldset>
        <legend class="text-sm font-semibold text-ink dark:text-white">What's it about?</legend>
        <div class="mt-3 flex flex-wrap gap-2">
          <label
            v-for="t in ENQUIRY_TOPICS"
            :key="t.code"
            class="topic-chip"
            :class="topic === t.code ? 'topic-chip-on' : ''"
          >
            <input v-model="topic" type="radio" name="topic" :value="t.code" class="sr-only" />
            {{ t.label }}
          </label>
        </div>
      </fieldset>

      <div>
        <label for="enq-order" class="text-sm font-semibold text-ink dark:text-white">
          Order number <span class="font-normal text-ink-soft dark:text-zinc-500">(optional)</span>
        </label>
        <input
          id="enq-order"
          v-model="orderRef"
          type="text"
          inputmode="text"
          autocapitalize="characters"
          autocomplete="off"
          :maxlength="ENQUIRY_ORDER_REF_MAX"
          placeholder="e.g. #A1B2C3D4"
          class="enq-field mt-2 h-12"
        />
      </div>

      <div>
        <label for="enq-message" class="text-sm font-semibold text-ink dark:text-white">Your question</label>
        <textarea
          id="enq-message"
          v-model="message"
          rows="6"
          :maxlength="ENQUIRY_MESSAGE_MAX"
          placeholder="Tell us what happened and what you need. The more detail, the faster we can help."
          class="enq-field mt-2 py-3 resize-none leading-relaxed"
        />
        <p
          v-if="message.length > ENQUIRY_MESSAGE_MAX - 200"
          class="mt-1 text-right text-xs tabular-nums text-ink-soft dark:text-zinc-500"
        >
          {{ message.length }} / {{ ENQUIRY_MESSAGE_MAX }}
        </p>
      </div>

      <p v-if="error" role="alert" class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>

      <div>
        <button
          type="submit"
          :disabled="sending"
          class="w-full min-h-[48px] rounded-full text-[15px] font-semibold bg-pokemon-red text-white transition-[transform,opacity] duration-150 active:scale-[0.97] disabled:opacity-60"
        >
          {{ sending ? "Sending…" : "Send enquiry" }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { HELP_EMAIL } from "~/shared/help";
import {
  ENQUIRY_MESSAGE_MAX,
  ENQUIRY_ORDER_REF_MAX,
  ENQUIRY_TOPICS,
  validateEnquiry,
  type EnquiryTopic,
} from "~/shared/enquiries";

useHead({ title: "Drop us an enquiry | TCGo" });

const { user, authLoading } = useAuth();
const { goToLogin } = useSignInGate();
const { authedFetch } = useAuthedFetch();

const route = useRoute();
const topic = ref<EnquiryTopic | "">(route.query.order ? "order" : "");
const orderRef = ref(typeof route.query.order === "string" ? route.query.order : "");
const message = ref("");
const error = ref("");
const sending = ref(false);

const send = async () => {
  error.value = "";
  // Same checks the server makes, so a slip is caught before the round trip.
  const valid = validateEnquiry({ topic: topic.value, message: message.value, orderRef: orderRef.value });
  if ("error" in valid) {
    error.value = valid.error;
    return;
  }
  sending.value = true;
  try {
    await authedFetch("/api/enquiries", {
      method: "POST",
      body: { topic: valid.topic, message: valid.text, orderRef: valid.orderRef },
    });
    await navigateTo({ path: "/account/help/enquiries", query: { sent: "1" } }, { replace: true });
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || "Couldn't send that. Try again.";
  } finally {
    sending.value = false;
  }
};
</script>

<style scoped>
.topic-chip {
  @apply inline-flex items-center min-h-[40px] px-4 rounded-full text-sm font-medium cursor-pointer select-none
    border border-black/[0.10] dark:border-white/[0.12] text-ink dark:text-zinc-200
    transition-[transform,background-color,border-color,color] duration-150 active:scale-[0.97];
  -webkit-tap-highlight-color: transparent;
}
.topic-chip-on {
  @apply bg-ink text-white border-ink dark:bg-white dark:text-ink dark:border-white;
}
.topic-chip:has(input:focus-visible) {
  @apply ring-2 ring-pokemon-red/60 ring-offset-2 ring-offset-canvas dark:ring-offset-canvas-inverse;
}
.enq-field {
  @apply block w-full px-4 rounded-xl text-base text-ink dark:text-white
    bg-black/[0.04] dark:bg-white/[0.06] !border-0
    placeholder:text-ink-soft dark:placeholder:text-zinc-500
    outline-none focus:ring-1 focus:ring-black/[0.15] dark:focus:ring-white/[0.2];
}
</style>
