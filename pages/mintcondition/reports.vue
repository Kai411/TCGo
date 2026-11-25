<template>
  <div class="mc-page">
    <div v-if="!isAdmin" class="mc-card mc-card-pad">
      <p class="mc-h2">Your role doesn't include access to reports.</p>
      <p class="mc-small mt-1">Ask an admin to grant it if you need it.</p>
    </div>

    <template v-else>
      <div class="mc-page-head">
        <div>
          <p class="mc-eyebrow mb-1">Trust and safety</p>
          <h1 class="mc-h1">Reports</h1>
          <p class="mc-meta mt-1">
            <template v-if="!loading && pendingReports.length">
              {{ pendingReports.length }} waiting for review.
            </template>
            <template v-else>Members reporting other members and listings.</template>
          </p>
        </div>
        <button type="button" :disabled="loading" class="mc-btn" @click="reloadAll">
          {{ loading ? "Loading…" : "Refresh" }}
        </button>
      </div>

      <p v-if="loadError" class="mc-callout mb-6" data-tone="bad" role="alert">{{ loadError }}</p>

      <div class="mc-tabs mb-5" role="tablist" aria-label="Reports">
        <button type="button" role="tab" :aria-selected="tab === 'pending'" @click="tab = 'pending'">
          To review<span class="mc-tab-count">{{ pendingReports.length }}</span>
        </button>
        <button type="button" role="tab" :aria-selected="tab === 'reviewed'" @click="tab = 'reviewed'">
          Reviewed<span class="mc-tab-count">{{ reviewedReports.length }}</span>
        </button>
        <button
          v-if="canModerate"
          type="button"
          role="tab"
          :aria-selected="tab === 'takedowns'"
          @click="tab = 'takedowns'"
        >
          Taken down<span class="mc-tab-count">{{ takedowns.sellers.length + takedowns.listings.length }}</span>
        </button>
      </div>

      <div v-if="loading" class="grid gap-3" aria-busy="true" aria-label="Loading">
        <div class="mc-skel h-[200px]" />
        <div class="mc-skel h-[200px]" />
      </div>

      <template v-else>
        <!-- To review: oldest first, so nothing waits forever. -->
        <template v-if="tab === 'pending'">
          <p v-if="!pendingReports.length" class="mc-card mc-empty">No reports waiting.</p>
          <ul v-else class="mc-card mc-list">
            <li v-for="report in pendingReports" :key="report.id" class="mc-item">
              <div class="mc-item-head">
                <div>
                  <p class="mc-list-title">{{ getTypeLabel(report.type) }}</p>
                  <p class="mc-meta mt-0.5">
                    {{ report.reporterName }} reported
                    <template v-if="listingOf(report)">
                      a {{ report.relatedItemType === "auction" ? "auction" : "listing" }} by
                    </template>
                    <span class="font-semibold text-[var(--ink)]">{{ report.reportedName }}</span>
                  </p>
                  <NuxtLink
                    v-if="listingOf(report)"
                    :to="listingHref(listingOf(report)!.kind, listingOf(report)!.id)"
                    target="_blank"
                    class="mc-link text-[13px] mt-1 inline-block"
                  >
                    {{ report.relatedItemName || "Open the listing" }} ↗
                  </NuxtLink>
                </div>
                <span class="mc-small">{{ formatDate(report.createdAt) }}</span>
              </div>

              <p class="mc-quote">{{ report.description }}</p>

              <div v-if="report.evidenceUrls.length > 0" class="mt-3 grid grid-cols-4 sm:grid-cols-6 gap-2">
                <a
                  v-for="(url, i) in report.evidenceUrls"
                  :key="i"
                  :href="url"
                  target="_blank"
                  class="block"
                  :aria-label="`Evidence ${i + 1}`"
                >
                  <img
                    :src="url"
                    alt=""
                    class="w-full aspect-square object-cover rounded-[var(--radius-s)] border border-[var(--line)]"
                  />
                </a>
              </div>

              <AdminIdentityPanel :uid="report.reportedUid" :name="report.reportedName" />

              <!-- Decide -->
              <div class="mc-divider mt-4 pt-4 grid gap-3">
                <McModerationActions
                  v-if="canModerate && report.reportedUid"
                  :report-id="report.id"
                  :report-type="report.type"
                  :seller-uid="report.reportedUid"
                  :seller-name="report.reportedName"
                  :listing="listingOf(report)"
                  :actions-taken="report.actionsTaken"
                  @done="loadTakedowns"
                />
                <div class="grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
                  <label class="mc-field">
                    <span>Penalty points</span>
                    <input
                      v-model.number="penaltyInputs[report.id]"
                      type="number"
                      min="0"
                      max="50"
                      :placeholder="getSuggestedPenalty(report.type).toString()"
                      class="mc-input mc-num"
                    />
                  </label>
                  <label class="mc-field">
                    <span>Internal note (optional)</span>
                    <input
                      v-model="noteInputs[report.id]"
                      type="text"
                      placeholder="Only staff see this"
                      class="mc-input"
                    />
                  </label>
                </div>
                <div class="flex flex-wrap gap-2">
                  <button
                    class="mc-btn mc-btn-sm mc-btn-primary"
                    :disabled="processing === report.id"
                    @click="handleApprove(report.id)"
                  >
                    Uphold and add {{ penaltyFor(report) }} {{ penaltyFor(report) === 1 ? "point" : "points" }}
                  </button>
                  <button
                    class="mc-btn mc-btn-sm"
                    :disabled="processing === report.id"
                    @click="handleDismiss(report.id)"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </li>
          </ul>
        </template>

        <!-- Reviewed -->
        <template v-if="tab === 'reviewed'">
          <p v-if="!reviewedReports.length" class="mc-card mc-empty">No reviewed reports yet.</p>
          <ul v-else class="mc-card mc-list">
            <li v-for="report in reviewedReports" :key="report.id" class="mc-list-row">
              <span
                class="mc-dot"
                :data-tone="report.status === 'approved' ? 'bad' : undefined"
                aria-hidden="true"
              />
              <div class="min-w-0">
                <p class="mc-list-title">
                  {{ report.reporterName }} reported {{ report.reportedName }}
                </p>
                <p class="mc-small mt-0.5">
                  {{ getTypeLabel(report.type) }} ·
                  {{ report.status === "approved" ? `Upheld, ${report.penalty} points` : "Dismissed" }}
                  <template v-if="report.actionsTaken?.length"> · {{ report.actionsTaken.map(actionLabel).join(", ") }}</template>
                  <template v-if="report.adminNote"> · Note: {{ report.adminNote }}</template>
                </p>
              </div>
              <span class="mc-small whitespace-nowrap">{{ formatDate(report.createdAt) }}</span>
            </li>
          </ul>
        </template>

        <!-- Taken down: hidden listings and suspended sellers, to undo -->
        <div v-if="tab === 'takedowns' && canModerate" class="grid gap-8">
          <section aria-labelledby="mc-susp">
            <h2 id="mc-susp" class="mc-h2 mb-3">
              Suspended sellers<span class="mc-tab-count">{{ takedowns.sellers.length }}</span>
            </h2>
            <p v-if="!takedowns.sellers.length" class="mc-card mc-empty">Nobody is suspended.</p>
            <ul v-else class="mc-card mc-list">
              <li v-for="s in takedowns.sellers" :key="s.uid" class="mc-list-row !grid-cols-[minmax(0,1fr)_auto]">
                <div class="min-w-0">
                  <NuxtLink :to="`/profile/${s.uid}`" target="_blank" class="mc-link">{{ s.name }}</NuxtLink>
                  <p class="mc-meta mt-0.5">{{ s.reason }}</p>
                  <p class="mc-small mt-0.5">{{ formatDate(s.at) }} · {{ s.by }}</p>
                </div>
                <button
                  type="button"
                  class="mc-btn mc-btn-sm"
                  :disabled="undoing === s.uid"
                  @click="liftSuspension(s.uid)"
                >
                  {{ undoing === s.uid ? "Lifting…" : "Lift suspension" }}
                </button>
              </li>
            </ul>
          </section>

          <section aria-labelledby="mc-hidden">
            <h2 id="mc-hidden" class="mc-h2 mb-3">
              Hidden listings<span class="mc-tab-count">{{ takedowns.listings.length }}</span>
            </h2>
            <p v-if="!takedowns.listings.length" class="mc-card mc-empty">No listings are hidden.</p>
            <ul v-else class="mc-card mc-list">
              <li v-for="l in takedowns.listings" :key="`${l.kind}:${l.id}`" class="mc-list-row">
                <img v-if="l.imageUrl" :src="l.imageUrl" alt="" class="w-9 h-[50px] rounded object-cover" />
                <span v-else class="w-9 h-[50px] rounded bg-[var(--surface-2)]" />
                <div class="min-w-0">
                  <p class="mc-list-title truncate">{{ l.title }}</p>
                  <p class="mc-meta mt-0.5">
                    {{ l.kind === "auction" ? "Auction" : "Shop" }} · {{ l.seller }} ·
                    {{ listingReasonLabel(l.hiddenReason) }}<template v-if="l.hiddenMessage"> · {{ l.hiddenMessage }}</template>
                  </p>
                  <p class="mc-small mt-0.5">{{ formatDate(l.hiddenAt) }} · {{ l.hiddenBy }}</p>
                </div>
                <button
                  v-if="l.hiddenVia !== 'suspension'"
                  type="button"
                  class="mc-btn mc-btn-sm"
                  :disabled="undoing === l.id"
                  @click="restoreListing(l)"
                >
                  {{ undoing === l.id ? "Restoring…" : "Restore" }}
                </button>
                <span v-else class="mc-small max-w-[9rem] text-right">Back when the suspension is lifted</span>
              </li>
            </ul>
          </section>

          <section aria-labelledby="mc-hide">
            <h2 id="mc-hide" class="mc-h2">Hide a listing without a report</h2>
            <p class="mc-small mt-0.5 mb-3">Paste its link, check it's the right one, then hide it.</p>
            <form class="mc-card mc-card-pad grid gap-3" @submit.prevent="findListing">
              <div class="flex flex-col sm:flex-row gap-2">
                <input
                  v-model="listingLink"
                  type="text"
                  inputmode="url"
                  aria-label="Listing link"
                  placeholder="tcgo.shop/cards/…"
                  class="mc-input flex-1"
                  :aria-invalid="!!listingLinkError"
                />
                <button type="submit" class="mc-btn">Find</button>
              </div>
              <p v-if="listingLinkError" class="mc-small !text-[var(--danger)]">{{ listingLinkError }}</p>
              <div v-if="foundListing" class="grid gap-2">
                <p class="mc-meta">
                  <NuxtLink :to="listingHref(foundListing.kind, foundListing.id)" target="_blank" class="mc-link">
                    {{ foundListing.title }}</NuxtLink>
                  by <span class="font-semibold text-[var(--ink)]">{{ foundListing.seller }}</span>
                </p>
                <McModerationActions
                  :key="foundListing.id"
                  :seller-uid="foundListing.sellerUid"
                  :seller-name="foundListing.seller"
                  :listing="{ kind: foundListing.kind, id: foundListing.id }"
                  @done="onFoundDone"
                />
              </div>
            </form>
          </section>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: "admin", middleware: "mintcondition" });
useHead({ title: "Reports — TCGo Admin" });

import { doc, getDoc } from "firebase/firestore";
import { REPORT_TYPES } from "~/composables/useReports";
import {
  LISTING_REPORT_REASONS,
  listingHref,
  listingReasonLabel,
  parseListingRef,
  type ListingKind,
} from "~/shared/moderation";

const { me, can } = useStaffAuth();
const isAdmin = computed(() => can("reports.view"));
const canModerate = computed(() => can("listings.moderate"));
const { mcFetch } = useMcFetch();

// Loaded through the server rather than the live Firestore listener the
// marketplace admin used: a staff session has no Firebase identity, so the
// client-side query the composable runs is denied by the rules before it
// returns a single document.
const reports = ref<any[]>([]);
const loading = ref(true);
const loadError = ref("");

const load = async () => {
  if (!isAdmin.value) {
    loading.value = false;
    return;
  }
  loading.value = true;
  loadError.value = "";
  try {
    const res = await mcFetch<{ reports: any[] }>("/api/mc/reports");
    reports.value = res.reports;
  } catch (e: any) {
    loadError.value = e?.data?.message || e?.message || "Couldn't load reports.";
  } finally {
    loading.value = false;
  }
};
watch(() => me.value?.permissions, load, { immediate: true });

const pendingReports = computed(() =>
  reports.value
    .filter((r) => r.status === "pending")
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0)),
);
const reviewedReports = computed(() => reports.value.filter((r) => r.status !== "pending"));

const review = async (
  reportId: string,
  verdict: "approved" | "dismissed",
  penalty: number,
  note: string,
) => {
  await mcFetch("/api/mc/reports/review", {
    method: "POST",
    body: { reportId, verdict, penalty, note },
  });
  await load();
};

const approveReport = (reportId: string, penalty: number, note: string) =>
  review(reportId, "approved", penalty, note);
const dismissReport = (reportId: string, note: string) =>
  review(reportId, "dismissed", 0, note);

const tab = ref<"pending" | "reviewed" | "takedowns">("pending");

// ── Moderation ────────────────────────────────────────────────────────
const listingOf = (report: any): { kind: ListingKind; id: string } | null =>
  report.relatedItemId && (report.relatedItemType === "card" || report.relatedItemType === "auction")
    ? { kind: report.relatedItemType, id: report.relatedItemId }
    : null;

const ACTION_LABEL: Record<string, string> = {
  listing_hidden: "Listing hidden",
  listing_restored: "Listing restored",
  seller_suspended: "Selling suspended",
  seller_restored: "Suspension lifted",
};
const actionLabel = (a: string) => ACTION_LABEL[a] ?? a;

const takedowns = ref<{ listings: any[]; sellers: any[] }>({ listings: [], sellers: [] });
const undoing = ref<string | null>(null);

const loadTakedowns = async () => {
  if (!canModerate.value) return;
  try {
    takedowns.value = await mcFetch("/api/mc/moderation");
  } catch (e: any) {
    loadError.value = e?.data?.message || e?.message || "Couldn't load what's been taken down.";
  }
};
watch(canModerate, (v) => v && loadTakedowns(), { immediate: true });

const restoreListing = async (l: any) => {
  undoing.value = l.id;
  try {
    await mcFetch("/api/mc/listings/hide", { method: "POST", body: { kind: l.kind, id: l.id, hidden: false } });
    await loadTakedowns();
  } catch (e: any) {
    loadError.value = e?.data?.message || e?.message || "Couldn't restore it.";
  } finally {
    undoing.value = null;
  }
};

const liftSuspension = async (uid: string) => {
  undoing.value = uid;
  try {
    await mcFetch("/api/mc/users/suspend", { method: "POST", body: { uid, suspended: false } });
    await loadTakedowns();
  } catch (e: any) {
    loadError.value = e?.data?.message || e?.message || "Couldn't lift it.";
  } finally {
    undoing.value = null;
  }
};

// Hide a listing nobody reported: paste its link, check it's the right one.
const listingLink = ref("");
const listingLinkError = ref("");
const foundListing = ref<any | null>(null);
const findListing = async () => {
  listingLinkError.value = "";
  foundListing.value = null;
  const ref_ = parseListingRef(listingLink.value);
  if (!ref_) {
    listingLinkError.value = "That doesn't look like a listing link. It should contain /cards/ or /auctions/.";
    return;
  }
  const { firestore } = useFirebase();
  const snap = await getDoc(doc(firestore!, ref_.kind === "auction" ? "auctions" : "cards", ref_.id)).catch(() => null);
  if (!snap?.exists()) {
    listingLinkError.value = "No listing with that link.";
    return;
  }
  const d = snap.data() as any;
  if (d.hidden === true) {
    listingLinkError.value = "That listing is already hidden. It's in the list below.";
    return;
  }
  foundListing.value = {
    ...ref_,
    title: d.cardName || d.title || "Untitled",
    seller: d.seller || "",
    sellerUid: d.sellerUid || "",
  };
};
const onFoundDone = () => {
  listingLink.value = "";
  loadTakedowns();
};
const penaltyInputs = ref<Record<string, number>>({});
const noteInputs = ref<Record<string, string>>({});
const processing = ref<string | null>(null);

const ALL_TYPES: { value: string; label: string; penalty: number }[] = [
  ...REPORT_TYPES,
  ...LISTING_REPORT_REASONS.map((r) => ({ ...r, label: `Listing: ${r.label}` })),
];

const getTypeLabel = (type: string) => {
  return ALL_TYPES.find((t) => t.value === type)?.label || type;
};

const getSuggestedPenalty = (type: string) => {
  return ALL_TYPES.find((t) => t.value === type)?.penalty || 5;
};

// 0 is a real choice (uphold without points), so only an empty box falls
// back to the suggestion. `||` used to turn a typed 0 into the suggestion.
const penaltyFor = (report: any): number => {
  const typed = penaltyInputs.value[report.id];
  return typeof typed === "number" && Number.isFinite(typed)
    ? Math.max(0, Math.min(50, Math.round(typed)))
    : getSuggestedPenalty(report.type);
};

const runReview = async (reportId: string, fn: () => Promise<void>) => {
  processing.value = reportId;
  loadError.value = "";
  try {
    await fn();
  } catch (e: any) {
    loadError.value = e?.data?.message || e?.message || "Couldn't save the review.";
  } finally {
    processing.value = null;
  }
};

const handleApprove = (reportId: string) => {
  const report = pendingReports.value.find((r: any) => r.id === reportId);
  if (!report) return;
  return runReview(reportId, () =>
    approveReport(reportId, penaltyFor(report), noteInputs.value[reportId] || ""),
  );
};

const handleDismiss = (reportId: string) =>
  runReview(reportId, () => dismissReport(reportId, noteInputs.value[reportId] || ""));

const reloadAll = () => Promise.all([load(), loadTakedowns()]);

const formatDate = (ts: number) =>
  new Date(ts).toLocaleDateString("en-MY", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
</script>
