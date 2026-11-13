<template>
  <div class="max-w-4xl mx-auto">
    <div v-if="!isAdmin" class="text-center py-12">
      <p class="text-gray-500 dark:text-zinc-400 text-lg">
        Your role doesn't include access to reports.
      </p>
      <p class="text-[13px] text-ink-soft dark:text-zinc-500 mt-1.5">
        Ask an admin to grant it if you need it.
      </p>
    </div>

    <template v-else>
      <h1 class="text-2xl font-bold mb-6">Reports</h1>

      <div v-if="loading" class="flex justify-center py-12">
        <div
          class="animate-spin rounded-full h-6 w-6 border-b-2 border-pokemon-red"
        ></div>
      </div>

      <template v-else>
        <!-- Tabs -->
        <div class="flex gap-1 mb-6 bg-gray-100 dark:bg-white/[0.04] rounded-lg p-1 w-fit">
          <button
            @click="tab = 'pending'"
            class="px-4 py-2 rounded-md text-sm font-medium transition-colors"
            :class="
              tab === 'pending'
                ? 'bg-white dark:bg-white/[0.10] text-gray-900 dark:text-zinc-100 shadow-sm'
                : 'text-gray-500 dark:text-zinc-400'
            "
          >
            Pending ({{ pendingReports.length }})
          </button>
          <button
            @click="tab = 'reviewed'"
            class="px-4 py-2 rounded-md text-sm font-medium transition-colors"
            :class="
              tab === 'reviewed'
                ? 'bg-white dark:bg-white/[0.10] text-gray-900 dark:text-zinc-100 shadow-sm'
                : 'text-gray-500 dark:text-zinc-400'
            "
          >
            Reviewed ({{ reviewedReports.length }})
          </button>
          <button
            v-if="canModerate"
            @click="tab = 'takedowns'"
            class="px-4 py-2 rounded-md text-sm font-medium transition-colors"
            :class="
              tab === 'takedowns'
                ? 'bg-white dark:bg-white/[0.10] text-gray-900 dark:text-zinc-100 shadow-sm'
                : 'text-gray-500 dark:text-zinc-400'
            "
          >
            Taken down
          </button>
        </div>

        <p v-if="loadError" class="text-sm text-red-600 dark:text-red-400 mb-4" role="alert">{{ loadError }}</p>

        <!-- Pending Reports -->
        <div v-if="tab === 'pending'" class="space-y-4">
          <div
            v-if="pendingReports.length === 0"
            class="text-gray-400 dark:text-zinc-500 text-sm py-8 text-center"
          >
            No pending reports.
          </div>
          <div
            v-for="report in pendingReports"
            :key="report.id"
            class="bg-white dark:bg-white/[0.04] rounded-xl border border-gray-200 dark:border-white/[0.08] p-5 space-y-3"
          >
            <div class="flex items-start justify-between">
              <div>
                <span
                  class="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700"
                >
                  {{ getTypeLabel(report.type) }}
                </span>
                <p class="text-sm mt-2">
                  <strong>{{ report.reporterName }}</strong> reported
                  <template v-if="listingOf(report)">
                    a {{ report.relatedItemType === "auction" ? "auction" : "listing" }} by
                  </template>
                  <strong>{{ report.reportedName }}</strong>
                </p>
                <NuxtLink
                  v-if="listingOf(report)"
                  :to="listingHref(listingOf(report)!.kind, listingOf(report)!.id)"
                  target="_blank"
                  class="mt-1 inline-flex items-center gap-1 text-sm font-medium text-ink dark:text-white underline underline-offset-2"
                >
                  {{ report.relatedItemName || "Open the listing" }}
                  <span aria-hidden="true">↗</span>
                </NuxtLink>
                <AdminIdentityPanel
                  :uid="report.reportedUid"
                  :name="report.reportedName"
                />
              </div>
              <span class="text-xs text-gray-400 dark:text-zinc-500">{{
                formatDate(report.createdAt)
              }}</span>
            </div>

            <p class="text-sm text-gray-700 dark:text-zinc-200 bg-gray-50 dark:bg-white/[0.02] rounded-lg p-3">
              {{ report.description }}
            </p>

            <!-- Evidence -->
            <div
              v-if="report.evidenceUrls.length > 0"
              class="grid grid-cols-4 gap-2"
            >
              <a
                v-for="(url, i) in report.evidenceUrls"
                :key="i"
                :href="url"
                target="_blank"
                class="block"
              >
                <img
                  :src="url"
                  class="w-full aspect-square object-cover rounded-lg border hover:opacity-80 transition-opacity"
                />
              </a>
            </div>

            <!-- Admin Actions -->
            <div class="border-t border-gray-200 dark:border-white/[0.08] pt-3 space-y-3">
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
              <div>
                <label class="block text-xs text-gray-500 dark:text-zinc-400 mb-1"
                  >Penalty points</label
                >
                <input
                  v-model.number="penaltyInputs[report.id]"
                  type="number"
                  min="0"
                  max="50"
                  :placeholder="getSuggestedPenalty(report.type).toString()"
                  class="w-32 border border-gray-300 dark:border-white/[0.10] rounded-lg px-3 py-1.5 text-sm"
                />
                <span class="text-xs text-gray-400 dark:text-zinc-500 ml-2">
                  Suggested: {{ getSuggestedPenalty(report.type) }}
                </span>
              </div>
              <div>
                <label class="block text-xs text-gray-500 dark:text-zinc-400 mb-1"
                  >Admin note (optional)</label
                >
                <input
                  v-model="noteInputs[report.id]"
                  type="text"
                  placeholder="Internal note..."
                  class="w-full border border-gray-300 dark:border-white/[0.10] rounded-lg px-3 py-1.5 text-sm"
                />
              </div>
              <div class="flex gap-2">
                <button
                  @click="handleApprove(report.id)"
                  :disabled="processing === report.id"
                  class="bg-red-600 text-white text-sm px-4 py-1.5 rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  Approve & Penalize
                </button>
                <button
                  @click="handleDismiss(report.id)"
                  :disabled="processing === report.id"
                  class="bg-gray-200 dark:bg-white/[0.08] text-gray-700 dark:text-zinc-200 text-sm px-4 py-1.5 rounded-lg font-medium hover:bg-gray-300 transition-colors disabled:opacity-50"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Reviewed Reports -->
        <div v-if="tab === 'reviewed'" class="space-y-4">
          <div
            v-if="reviewedReports.length === 0"
            class="text-gray-400 dark:text-zinc-500 text-sm py-8 text-center"
          >
            No reviewed reports yet.
          </div>
          <div
            v-for="report in reviewedReports"
            :key="report.id"
            class="bg-white dark:bg-white/[0.04] rounded-xl border border-gray-200 dark:border-white/[0.08] p-5 space-y-2"
          >
            <div class="flex items-start justify-between">
              <div>
                <span
                  class="text-xs font-medium px-2 py-0.5 rounded-full"
                  :class="
                    report.status === 'approved'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-gray-100 dark:bg-white/[0.04] text-gray-600 dark:text-zinc-300'
                  "
                >
                  {{
                    report.status === "approved"
                      ? `Approved (-${report.penalty})`
                      : "Dismissed"
                  }}
                </span>
                <p class="text-sm mt-2">
                  <strong>{{ report.reporterName }}</strong> →
                  <strong>{{ report.reportedName }}</strong> ·
                  {{ getTypeLabel(report.type) }}
                </p>
              </div>
              <span class="text-xs text-gray-400 dark:text-zinc-500">{{
                formatDate(report.createdAt)
              }}</span>
            </div>
            <p v-if="report.adminNote" class="text-xs text-gray-500 dark:text-zinc-400 italic">
              Note: {{ report.adminNote }}
            </p>
            <p v-if="report.actionsTaken?.length" class="text-xs text-red-600 dark:text-red-400">
              {{ report.actionsTaken.map(actionLabel).join(" · ") }}
            </p>
          </div>
        </div>

        <!-- Taken down: hidden listings and suspended sellers, to undo -->
        <div v-if="tab === 'takedowns' && canModerate" class="space-y-6">
          <form
            class="bg-white dark:bg-white/[0.04] rounded-xl border border-gray-200 dark:border-white/[0.08] p-5 space-y-3"
            @submit.prevent="findListing"
          >
            <p class="text-sm font-semibold">Hide a listing without a report</p>
            <div class="flex flex-col sm:flex-row gap-2">
              <input
                v-model="listingLink"
                type="text"
                inputmode="url"
                placeholder="Paste the listing link, e.g. tcgo.shop/cards/…"
                class="flex-1 border border-gray-300 dark:border-white/[0.10] bg-transparent rounded-lg px-3 py-1.5 text-sm"
              />
              <button
                type="submit"
                class="text-sm px-4 py-1.5 rounded-lg font-medium bg-gray-200 dark:bg-white/[0.08] text-gray-700 dark:text-zinc-200 hover:bg-gray-300 dark:hover:bg-white/[0.12]"
              >
                Find
              </button>
            </div>
            <p v-if="listingLinkError" class="text-xs text-red-600 dark:text-red-400">{{ listingLinkError }}</p>
            <div v-if="foundListing" class="space-y-2">
              <p class="text-sm">
                <NuxtLink :to="listingHref(foundListing.kind, foundListing.id)" target="_blank" class="font-medium underline underline-offset-2">
                  {{ foundListing.title }}</NuxtLink>
                by <strong>{{ foundListing.seller }}</strong>
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

          <section>
            <h2 class="text-sm font-semibold mb-2">Suspended sellers ({{ takedowns.sellers.length }})</h2>
            <p v-if="!takedowns.sellers.length" class="text-sm text-gray-400 dark:text-zinc-500">Nobody is suspended.</p>
            <ul class="space-y-2">
              <li
                v-for="s in takedowns.sellers"
                :key="s.uid"
                class="bg-white dark:bg-white/[0.04] rounded-xl border border-gray-200 dark:border-white/[0.08] p-4 flex flex-wrap items-center justify-between gap-3"
              >
                <div class="min-w-0">
                  <NuxtLink :to="`/profile/${s.uid}`" target="_blank" class="text-sm font-semibold underline underline-offset-2">{{ s.name }}</NuxtLink>
                  <p class="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">{{ s.reason }}</p>
                  <p class="text-[11px] text-gray-400 dark:text-zinc-500 mt-0.5">{{ formatDate(s.at) }} · {{ s.by }}</p>
                </div>
                <button
                  type="button"
                  :disabled="undoing === s.uid"
                  class="text-sm px-3 py-1.5 rounded-lg font-medium border border-gray-300 dark:border-white/[0.12] hover:bg-gray-50 dark:hover:bg-white/[0.04] disabled:opacity-50"
                  @click="liftSuspension(s.uid)"
                >
                  {{ undoing === s.uid ? "Lifting…" : "Lift suspension" }}
                </button>
              </li>
            </ul>
          </section>

          <section>
            <h2 class="text-sm font-semibold mb-2">Hidden listings ({{ takedowns.listings.length }})</h2>
            <p v-if="!takedowns.listings.length" class="text-sm text-gray-400 dark:text-zinc-500">No listings are hidden.</p>
            <ul class="space-y-2">
              <li
                v-for="l in takedowns.listings"
                :key="`${l.kind}:${l.id}`"
                class="bg-white dark:bg-white/[0.04] rounded-xl border border-gray-200 dark:border-white/[0.08] p-4 flex flex-wrap items-center gap-3"
              >
                <img v-if="l.imageUrl" :src="l.imageUrl" alt="" class="w-10 h-14 rounded object-cover shrink-0" />
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-semibold truncate">
                    {{ l.title }}
                    <span class="text-xs font-normal text-gray-500 dark:text-zinc-400">· {{ l.kind === "auction" ? "Auction" : "Shop" }} · {{ l.seller }}</span>
                  </p>
                  <p class="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">{{ listingReasonLabel(l.hiddenReason) }}<template v-if="l.hiddenMessage"> · {{ l.hiddenMessage }}</template></p>
                  <p class="text-[11px] text-gray-400 dark:text-zinc-500 mt-0.5">{{ formatDate(l.hiddenAt) }} · {{ l.hiddenBy }}</p>
                </div>
                <button
                  v-if="l.hiddenVia !== 'suspension'"
                  type="button"
                  :disabled="undoing === l.id"
                  class="text-sm px-3 py-1.5 rounded-lg font-medium border border-gray-300 dark:border-white/[0.12] hover:bg-gray-50 dark:hover:bg-white/[0.04] disabled:opacity-50"
                  @click="restoreListing(l)"
                >
                  {{ undoing === l.id ? "Restoring…" : "Restore" }}
                </button>
                <span v-else class="text-xs text-gray-500 dark:text-zinc-400">Comes back when the suspension is lifted</span>
              </li>
            </ul>
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

const pendingReports = computed(() => reports.value.filter((r) => r.status === "pending"));
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

const handleApprove = async (reportId: string) => {
  processing.value = reportId;
  const report = pendingReports.value.find((r: any) => r.id === reportId);
  const penalty =
    penaltyInputs.value[reportId] || getSuggestedPenalty(report?.type || "");
  const note = noteInputs.value[reportId] || "";
  try {
    await approveReport(reportId, penalty, note);
  } finally {
    processing.value = null;
  }
};

const handleDismiss = async (reportId: string) => {
  processing.value = reportId;
  const note = noteInputs.value[reportId] || "";
  try {
    await dismissReport(reportId, note);
  } finally {
    processing.value = null;
  }
};

const formatDate = (ts: number) =>
  new Date(ts).toLocaleDateString("en-MY", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
</script>
