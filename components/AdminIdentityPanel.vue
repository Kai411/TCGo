<template>
  <div class="mt-3 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5">
    <button type="button" class="flex items-center gap-2 mc-label w-full text-left" :aria-expanded="open" @click="toggle">
      <svg
        class="w-3.5 h-3.5 shrink-0 transition-transform duration-150"
        :class="open ? 'rotate-90' : ''"
        viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
        stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
      ><path d="m9 18 6-6-6-6" /></svg>
      <span class="min-w-0 truncate">Who is {{ name }}?</span>
      <span v-if="data" class="mc-tag ml-auto shrink-0">
        <span class="mc-dot" :data-tone="badge.tone" aria-hidden="true" />{{ badge.text }}
      </span>
    </button>

    <div v-if="open" class="mt-3">
      <p v-if="loading" class="mc-small">Loading…</p>
      <p v-else-if="error" class="mc-small !text-[var(--danger)]">{{ error }}</p>
      <p v-else-if="data && !data.found" class="mc-small">No profile found for this account.</p>

      <dl v-else-if="data" class="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-[12.5px]">
        <div v-for="row in rows" :key="row.label" class="flex justify-between gap-3">
          <dt class="mc-ink-3 shrink-0">{{ row.label }}</dt>
          <dd class="text-right min-w-0 break-words">{{ row.value }}</dd>
        </div>

        <div v-if="nameMismatch" class="sm:col-span-2 mt-2 mc-callout">
          The payout account is in a different name from the verified document.
          Not proof of anything on its own (a joint or business account looks
          the same), but payouts to it are held until someone approves it.
          Ask the seller whose account it is first.
          <button
            v-if="canApprove"
            type="button"
            class="mc-btn mc-btn-sm mc-btn-primary mt-2 !whitespace-normal !h-auto min-h-[var(--control-h-sm)] py-1 text-left"
            :disabled="approving"
            @click="approve"
          >
            {{ approving ? "Approving…" : `Approve payouts to ${data.payoutNameOnFile} (ending ${data.payoutAccountLast4})` }}
          </button>
          <span v-if="approveError" class="mt-1 block !text-[var(--danger)]">{{ approveError }}</span>
        </div>
        <p v-if="data.payoutNameApproved && data.payoutNameMatches === false" class="sm:col-span-2 mt-1 mc-small flex items-center gap-2">
          <span class="mc-dot" data-tone="good" aria-hidden="true" />
          Payout name approved{{ data.payoutNameApprovedByName ? ` by ${data.payoutNameApprovedByName}` : "" }} for the account ending {{ data.payoutAccountLast4 }}.
        </p>
        <p v-if="data.sellingSuspended" class="sm:col-span-2 mt-1 mc-small flex items-center gap-2">
          <span class="mc-dot" data-tone="bad" aria-hidden="true" />
          Selling is suspended, so no payout can be requested or sent.
        </p>
        <p v-if="data.kyc.status !== 'verified'" class="sm:col-span-2 mt-1 mc-small">
          This account has not completed identity verification, so we have no
          confirmed real-world identity behind it.
        </p>
      </dl>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ uid: string; name: string; startOpen?: boolean }>();
const emit = defineEmits<{ approved: [] }>();

const { mcFetch } = useMcFetch();
const { can } = useStaffAuth();

interface Identity {
  found: boolean;
  displayName?: string | null;
  createdAt?: number | null;
  trustScore?: number | null;
  payoutNameOnFile?: string | null;
  payoutAccountLast4?: string | null;
  payoutNameMatches?: boolean | null;
  payoutNameApproved?: boolean;
  payoutNameApprovedByName?: string | null;
  sellingSuspended?: boolean;
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
    return { text: "Verified", tone: "good" as const };
  if (s === "pending_review")
    return { text: "In review", tone: "info" as const };
  if (s === "declined")
    return { text: "Declined", tone: "bad" as const };
  return { text: "Unverified", tone: undefined };
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

// Worked out by the server with the same loose compare the payout routes use
// (shared/payout-identity.ts), so the warning here and the hold agree.
const nameMismatch = computed(() => {
  const d = data.value;
  return !!d?.payoutNameOnFile && d?.payoutNameMatches === false && !d?.payoutNameApproved;
});

const canApprove = computed(() => can("payouts.execute") && !!data.value?.payoutAccountLast4);
const approving = ref(false);
const approveError = ref("");

const approve = async () => {
  const d = data.value;
  if (!d || approving.value) return;
  if (
    !confirm(
      `Approve payouts to "${d.payoutNameOnFile}" (account ending ${d.payoutAccountLast4})?\n\n` +
        `The verified name is "${d.kyc.verifiedName || "not recorded"}". Only approve if you've confirmed the account is this seller's.`,
    )
  )
    return;
  approving.value = true;
  approveError.value = "";
  try {
    await mcFetch("/api/mc/payouts/approve-name", { method: "POST", body: { uid: props.uid } });
    data.value = { ...d, payoutNameApproved: true, payoutNameApprovedByName: "you" };
    emit("approved");
  } catch (e: any) {
    approveError.value = e?.data?.message || e?.message || "Couldn't approve.";
  } finally {
    approving.value = false;
  }
};

onMounted(() => {
  if (props.startOpen) toggle();
});
</script>
