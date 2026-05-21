<template>
  <div class="max-w-4xl mx-auto">
    <div v-if="!isAdmin" class="text-center py-12">
      <p class="text-gray-500 dark:text-zinc-400 text-lg">Access denied.</p>
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
                ? 'bg-white text-gray-900 dark:text-zinc-100 shadow-sm'
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
                ? 'bg-white text-gray-900 dark:text-zinc-100 shadow-sm'
                : 'text-gray-500 dark:text-zinc-400'
            "
          >
            Reviewed ({{ reviewedReports.length }})
          </button>
        </div>

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
                  <strong>{{ report.reportedName }}</strong>
                </p>
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
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { REPORT_TYPES } from "~/composables/useReports";

const { isAdmin } = useAdmin();
const {
  pendingReports,
  reviewedReports,
  loading,
  approveReport,
  dismissReport,
} = useAdminReports();

const tab = ref<"pending" | "reviewed">("pending");
const penaltyInputs = ref<Record<string, number>>({});
const noteInputs = ref<Record<string, string>>({});
const processing = ref<string | null>(null);

const getTypeLabel = (type: string) => {
  return REPORT_TYPES.find((t) => t.value === type)?.label || type;
};

const getSuggestedPenalty = (type: string) => {
  return REPORT_TYPES.find((t) => t.value === type)?.penalty || 5;
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
