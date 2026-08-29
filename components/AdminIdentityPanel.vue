<template>
  <div class="mt-3 rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.015] dark:bg-white/[0.03] p-3">
    <button
      type="button"
      class="flex items-center gap-2 text-xs font-semibold text-ink-muted dark:text-zinc-400 hover:text-ink dark:hover:text-white transition-colors"
      @click="toggle"
    >
      <svg
        class="w-3.5 h-3.5 transition-transform"
        :class="open ? 'rotate-90' : ''"
        viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
        stroke-linecap="round" stroke-linejoin="round"
      ><path d="m9 18 6-6-6-6" /></svg>
      Who is {{ name }}?
      <span
        v-if="data"
        class="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide"
        :class="badge.cls"
      >{{ badge.text }}</span>
    </button>

    <div v-if="open" class="mt-3">
      <p v-if="loading" class="text-xs text-ink-soft dark:text-zinc-500">Loading…</p>
      <p v-else-if="error" class="text-xs text-red-600 dark:text-red-400">{{ error }}</p>
      <p v-else-if="data && !data.found" class="text-xs text-ink-soft dark:text-zinc-500">
        No profile found for this account.
      </p>

      <dl v-else-if="data" class="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
        <div v-for="row in rows" :key="row.label" class="flex justify-between gap-3">
          <dt class="text-ink-soft dark:text-zinc-500 shrink-0">{{ row.label }}</dt>
          <dd class="text-right text-ink dark:text-zinc-200 min-w-0 break-words">
            {{ row.value }}
          </dd>
        </div>

        <p
          v-if="nameMismatch"
          class="sm:col-span-2 mt-1 rounded-lg bg-amber-50 dark:bg-amber-500/10 px-2.5 py-2 text-[11px] leading-relaxed text-amber-800 dark:text-amber-300"
        >
          The payout account is in a different name from the verified document.
          Not proof of anything on its own — a joint or business account looks
          the same — but worth asking about.
        </p>
        <p
          v-if="data.kyc.status !== 'verified'"
          class="sm:col-span-2 mt-1 text-[11px] leading-relaxed text-ink-soft dark:text-zinc-500"
        >
          This account has not completed identity verification, so we have no
          confirmed real-world identity behind it.
        </p>
      </dl>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ uid: string; name: string }>();

const { mcFetch } = useMcFetch();

interface Identity {
  found: boolean;
  displayName?: string | null;
  createdAt?: number | null;
  trustScore?: number | null;
  payoutNameOnFile?: string | null;
  kyc: {
    status: string;
    verifiedName: string | null;
    verifiedAt: number | null;
    documentType: string | null;
    issuingState: string | null;
    sessionId: string | null;
    declineReason: string | null;
  };
}

const open = ref(false);
const loading = ref(false);
const error = ref("");
const data = ref<Identity | null>(null);

// Fetched on expand, not on render: a page of twenty reports shouldn't pull
// twenty identity records nobody looked at.
const toggle = async () => {
  open.value = !open.value;
  if (!open.value || data.value || loading.value) return;
  loading.value = true;
  error.value = "";
  try {
    data.value = await mcFetch<Identity>(
      `/api/admin/identity?uid=${encodeURIComponent(props.uid)}`,
    );
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || "Couldn't load identity.";
  } finally {
    loading.value = false;
  }
};

const badge = computed(() => {
  const s = data.value?.kyc?.status;
  if (s === "verified")
    return { text: "Verified", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" };
  if (s === "pending_review")
    return { text: "In review", cls: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" };
  if (s === "declined")
    return { text: "Declined", cls: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300" };
  return { text: "Unverified", cls: "bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-zinc-300" };
});

const fmtDate = (ms?: number | null) =>
  ms ? new Date(ms).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" }) : "—";

const rows = computed(() => {
  const d = data.value;
  if (!d) return [];
  return [
    { label: "Verified name", value: d.kyc.verifiedName || "—" },
    { label: "Document", value: d.kyc.documentType ? `${d.kyc.documentType}${d.kyc.issuingState ? ` (${d.kyc.issuingState})` : ""}` : "—" },
    { label: "Verified on", value: fmtDate(d.kyc.verifiedAt) },
    { label: "Account since", value: fmtDate(d.createdAt) },
    { label: "Payout account name", value: d.payoutNameOnFile || "—" },
    { label: "Trust score", value: d.trustScore ?? "—" },
    { label: "Didit session", value: d.kyc.sessionId || "—" },
    ...(d.kyc.declineReason ? [{ label: "Decline reason", value: d.kyc.declineReason }] : []),
  ];
});

// Compared loosely — case and spacing differ constantly between a document
// and what someone typed into a bank form, and flagging those would train the
// reviewer to ignore the warning.
const nameMismatch = computed(() => {
  const d = data.value;
  const a = d?.kyc?.verifiedName?.toLowerCase().replace(/\s+/g, " ").trim();
  const b = d?.payoutNameOnFile?.toLowerCase().replace(/\s+/g, " ").trim();
  return !!a && !!b && a !== b;
});
</script>
