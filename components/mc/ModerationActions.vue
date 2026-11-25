<template>
  <!-- Hide listing / Suspend selling for one report. Each opens a short form
       that asks for the line the seller will read; nothing happens until
       Confirm. Both can be undone from the Taken down tab. -->
  <div class="grid gap-2">
    <div class="flex flex-wrap gap-2">
      <button
        v-if="listing && !done.includes('listing_hidden')"
        type="button"
        class="mc-btn mc-btn-sm mc-btn-danger"
        :aria-expanded="mode === 'hide'"
        @click="toggle('hide')"
      >
        Hide listing
      </button>
      <span v-else-if="listing" class="mc-tag">
        <span class="mc-dot" data-tone="bad" aria-hidden="true" />Listing hidden
      </span>

      <button
        v-if="!done.includes('seller_suspended')"
        type="button"
        class="mc-btn mc-btn-sm mc-btn-danger"
        :aria-expanded="mode === 'suspend'"
        @click="toggle('suspend')"
      >
        Suspend selling
      </button>
      <span v-else class="mc-tag">
        <span class="mc-dot" data-tone="bad" aria-hidden="true" />Selling suspended
      </span>
    </div>

    <div v-if="mode" class="mc-callout grid gap-3" data-tone="bad">
      <div>
        <p class="font-semibold">
          {{ mode === "hide" ? "Hide this listing" : `Suspend selling for ${sellerName}` }}
        </p>
        <p class="mc-meta mt-0.5">
          <template v-if="mode === 'hide'">
            It comes off the marketplace and can't be paid for. The seller can't bring it back.
          </template>
          <template v-else>
            They can't list, edit or take payments, and all their live listings are hidden. Buying and chat still work.
          </template>
        </p>
      </div>

      <label v-if="mode === 'hide'" class="mc-field">
        <span>Reason</span>
        <select v-model="reason" class="mc-input sm:max-w-[20rem]">
          <option v-for="r in LISTING_REPORT_REASONS" :key="r.value" :value="r.value">{{ r.label }}</option>
        </select>
      </label>

      <label class="mc-field">
        <span>Message to the seller (they see this in their notifications)</span>
        <textarea v-model="message" rows="2" :maxlength="MODERATION_MESSAGE_MAX" class="mc-input" />
      </label>

      <p v-if="error" class="mc-small !text-[var(--danger)]" role="alert">{{ error }}</p>

      <div class="flex gap-2">
        <button
          type="button"
          :disabled="busy || !message.trim()"
          class="mc-btn mc-btn-sm mc-btn-primary"
          @click="confirm"
        >
          {{ busy ? "Working…" : mode === "hide" ? "Hide listing" : "Suspend selling" }}
        </button>
        <button type="button" :disabled="busy" class="mc-btn mc-btn-sm mc-btn-ghost" @click="mode = null">
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  LISTING_REPORT_REASONS,
  MODERATION_MESSAGE_MAX,
  isListingReportType,
  listingReasonLabel,
  type ListingKind,
} from "~/shared/moderation";

const props = defineProps<{
  reportId?: string;
  reportType?: string;
  sellerUid: string;
  sellerName: string;
  listing?: { kind: ListingKind; id: string } | null;
  actionsTaken?: string[];
}>();

const emit = defineEmits<{ done: [] }>();

const { mcFetch } = useMcFetch();

const mode = ref<"hide" | "suspend" | null>(null);
const reason = ref<string>(isListingReportType(props.reportType) ? props.reportType! : "listing_counterfeit");
const message = ref("");
const busy = ref(false);
const error = ref("");
const done = ref<string[]>([...(props.actionsTaken ?? [])]);

const suggestion = (m: "hide" | "suspend") =>
  m === "hide"
    ? `A member reported this listing as "${listingReasonLabel(reason.value).toLowerCase()}" and we agree after checking it.`
    : "We're reviewing reports about your listings. While we do, you can't sell on TCGo.";

const toggle = (m: "hide" | "suspend") => {
  error.value = "";
  if (mode.value === m) {
    mode.value = null;
    return;
  }
  mode.value = m;
  message.value = suggestion(m);
};

const confirm = async () => {
  if (!mode.value || busy.value) return;
  busy.value = true;
  error.value = "";
  try {
    if (mode.value === "hide" && props.listing) {
      await mcFetch("/api/mc/listings/hide", {
        method: "POST",
        body: {
          kind: props.listing.kind,
          id: props.listing.id,
          hidden: true,
          reason: reason.value,
          message: message.value,
          reportId: props.reportId,
        },
      });
      done.value.push("listing_hidden");
    } else if (mode.value === "suspend") {
      await mcFetch("/api/mc/users/suspend", {
        method: "POST",
        body: {
          uid: props.sellerUid,
          suspended: true,
          message: message.value,
          reportId: props.reportId,
        },
      });
      // Suspending hides their listings too, this one included.
      done.value.push("seller_suspended", "listing_hidden");
    }
    mode.value = null;
    emit("done");
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || "That didn't work. Try again.";
  } finally {
    busy.value = false;
  }
};
</script>
