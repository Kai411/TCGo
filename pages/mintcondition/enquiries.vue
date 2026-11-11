<template>
  <div class="max-w-5xl">
    <div class="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div>
        <h1 class="text-xl font-bold text-ink dark:text-white">Enquiries</h1>
        <p class="text-sm text-ink-muted dark:text-zinc-400">
          Questions members sent from the Help Center. Your reply shows in their enquiry history and rings their bell.
          Close one when it's done.
        </p>
      </div>
      <div class="flex items-center gap-2">
        <div class="inline-flex rounded-lg border border-black/[0.10] dark:border-white/[0.12] p-0.5 text-sm font-semibold">
          <button
            v-for="v in VIEWS"
            :key="v.id"
            type="button"
            @click="setView(v.id)"
            class="px-3 py-1.5 rounded-md"
            :class="view === v.id ? 'bg-ink text-white dark:bg-white dark:text-ink' : 'text-ink-muted dark:text-zinc-400'"
          >
            {{ v.label }}
          </button>
        </div>
        <button
          type="button"
          @click="load"
          :disabled="loading"
          class="px-3 py-2 rounded-lg text-sm font-semibold border border-black/[0.10] dark:border-white/[0.12] text-ink dark:text-white disabled:opacity-50"
        >
          {{ loading ? "Loading…" : "Refresh" }}
        </button>
      </div>
    </div>

    <p v-if="error" class="mb-4 text-sm text-red-600 dark:text-red-400">{{ error }}</p>

    <div v-if="!loading && !enquiries.length" class="py-16 text-center text-sm text-ink-muted dark:text-zinc-400">
      {{ view === "closed" ? "No closed enquiries." : "No open enquiries." }}
    </div>

    <div class="space-y-3">
      <div
        v-for="e in enquiries"
        :key="e.id"
        class="rounded-xl border border-black/[0.08] dark:border-white/[0.10] bg-white dark:bg-white/[0.04] p-4"
      >
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p class="text-sm font-semibold text-ink dark:text-white">
              {{ e.topic }}<span v-if="e.orderRef" class="font-mono text-xs text-ink-muted dark:text-zinc-400"> · #{{ e.orderRef }}</span>
            </p>
            <p class="text-xs text-ink-muted dark:text-zinc-400">
              <NuxtLink :to="`/profile/${e.userUid}`" target="_blank" class="hover:underline">{{ e.userName || "Member" }}</NuxtLink>
              <span v-if="e.userEmail"> · {{ e.userEmail }}</span> · sent {{ fmt(e.createdAt) }}
            </p>
          </div>
          <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold" :class="PILL[e.status]">
            {{ STAFF_LABEL[e.status] }}
          </span>
        </div>

        <ul class="mt-3 space-y-1.5 text-sm">
          <li v-for="(m, i) in e.messages" :key="i" class="text-ink dark:text-zinc-200 whitespace-pre-line">
            <span class="font-semibold">{{ m.by === "tcgo" ? `TCGo${m.staffName ? ` (${m.staffName})` : ""}` : "Member" }}:</span>
            {{ m.text }}
            <span class="text-[11px] text-ink-soft dark:text-zinc-500">{{ fmt(m.at) }}</span>
          </li>
        </ul>

        <div v-if="e.status !== 'closed'" class="mt-3 flex flex-wrap items-end gap-2">
          <textarea
            v-model="drafts[e.id]"
            rows="2"
            :maxlength="ENQUIRY_MESSAGE_MAX"
            placeholder="Reply to the member"
            class="flex-1 min-w-[16rem] px-3 py-2 rounded-lg border border-black/[0.10] dark:border-white/[0.12] bg-transparent text-sm"
          />
          <button
            type="button"
            :disabled="busy === e.id || !(drafts[e.id] || '').trim()"
            @click="act(e, { reply: true })"
            class="px-3 py-2 rounded-lg text-sm font-semibold bg-pokemon-red text-white disabled:opacity-50"
          >
            Send reply
          </button>
          <button
            type="button"
            :disabled="busy === e.id || !(drafts[e.id] || '').trim()"
            @click="act(e, { reply: true, close: true })"
            class="px-3 py-2 rounded-lg text-sm font-semibold border border-black/[0.10] dark:border-white/[0.12] text-ink dark:text-white disabled:opacity-50"
          >
            Reply and close
          </button>
          <button
            type="button"
            :disabled="busy === e.id"
            @click="act(e, { close: true })"
            class="px-3 py-2 rounded-lg text-sm font-semibold text-ink-muted dark:text-zinc-400 disabled:opacity-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ENQUIRY_MESSAGE_MAX, type EnquiryStatus } from "~/shared/enquiries";

definePageMeta({ layout: "admin", middleware: "mintcondition" });
useHead({ title: "Enquiries — TCGo Admin" });

interface EnquiryRow {
  id: string;
  status: EnquiryStatus;
  topic: string;
  orderRef: string | null;
  userUid: string;
  userName: string | null;
  userEmail: string | null;
  messages: { by: "member" | "tcgo"; text: string; at: number; staffName: string | null }[];
  createdAt: number;
  updatedAt: number;
}

const VIEWS = [
  { id: "active", label: "Open" },
  { id: "closed", label: "Closed" },
] as const;

// Staff read the status from their side: "open" is waiting on us.
const STAFF_LABEL: Record<EnquiryStatus, string> = {
  open: "Needs reply",
  answered: "Replied",
  closed: "Closed",
};
const PILL: Record<EnquiryStatus, string> = {
  open: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  answered: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  closed: "bg-black/[0.05] dark:bg-white/[0.08] text-ink-muted dark:text-zinc-300",
};

const { mcFetch } = useMcFetch();
const view = ref<"active" | "closed">("active");
const enquiries = ref<EnquiryRow[]>([]);
const drafts = reactive<Record<string, string>>({});
const loading = ref(false);
const error = ref("");
const busy = ref<string | null>(null);

const load = async () => {
  loading.value = true;
  error.value = "";
  try {
    const res = await mcFetch<{ enquiries: EnquiryRow[] }>(
      `/api/mc/enquiries${view.value === "closed" ? "?status=closed" : ""}`,
    );
    enquiries.value = res.enquiries;
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || "Couldn't load enquiries.";
  } finally {
    loading.value = false;
  }
};

const setView = (v: "active" | "closed") => {
  if (view.value === v) return;
  view.value = v;
  enquiries.value = [];
  load();
};

const act = async (e: EnquiryRow, opts: { reply?: boolean; close?: boolean }) => {
  const message = opts.reply ? (drafts[e.id] || "").trim() : "";
  if (opts.close && !message && !confirm("Close this enquiry without replying?")) return;
  busy.value = e.id;
  error.value = "";
  try {
    await mcFetch("/api/mc/enquiries/reply", {
      method: "POST",
      body: { enquiryId: e.id, message, close: !!opts.close },
    });
    drafts[e.id] = "";
    await load();
  } catch (err: any) {
    error.value = err?.data?.message || err?.message || "Couldn't save that.";
  } finally {
    busy.value = null;
  }
};

const fmt = (ms?: number) =>
  ms ? new Date(ms).toLocaleString("en-MY", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";

onMounted(load);
</script>
