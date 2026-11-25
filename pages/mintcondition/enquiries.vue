<template>
  <div class="mc-page">
    <div class="mc-page-head">
      <div>
        <p class="mc-eyebrow mb-1">Trust and safety</p>
        <h1 class="mc-h1">Enquiries</h1>
        <p class="mc-meta mt-1">
          <template v-if="view === 'active' && !loading && enquiries.length">
            {{ needsReply.length }} {{ needsReply.length === 1 ? "needs" : "need" }} a reply,
            {{ replied.length }} waiting on the member.
          </template>
          <template v-else>Questions members sent from the Help Center.</template>
        </p>
      </div>
      <button type="button" :disabled="loading" class="mc-btn" @click="load">
        {{ loading ? "Loading…" : "Refresh" }}
      </button>
    </div>

    <p v-if="error" class="mc-callout mb-6" data-tone="bad" role="alert">{{ error }}</p>

    <div class="mc-tabs mb-5" role="tablist" aria-label="Enquiry status">
      <button
        v-for="v in VIEWS"
        :key="v.id"
        type="button"
        role="tab"
        :aria-selected="view === v.id"
        @click="setView(v.id)"
      >
        {{ v.label }}
      </button>
    </div>

    <div v-if="loading && !enquiries.length" class="grid gap-3" aria-busy="true" aria-label="Loading">
      <div class="mc-skel h-[160px]" />
      <div class="mc-skel h-[120px]" />
    </div>

    <p v-else-if="!enquiries.length" class="mc-card mc-empty">
      {{ view === "closed" ? "No closed enquiries." : "No open enquiries." }}
    </p>

    <div v-else class="grid gap-8">
      <section v-for="g in groups" v-show="g.items.length" :key="g.key" :aria-label="g.title">
        <h2 v-if="view === 'active'" class="mc-h2 mb-3">
          {{ g.title }}<span class="mc-tab-count">{{ g.items.length }}</span>
        </h2>
        <ul class="mc-card mc-list">
          <li v-for="e in g.items" :key="e.id" class="mc-item">
            <div class="mc-item-head">
              <div>
                <p class="mc-list-title">
                  {{ e.topic }}
                  <span v-if="e.orderRef" class="mc-mono mc-ink-3 font-normal"> · #{{ e.orderRef }}</span>
                </p>
                <p class="mc-small mt-0.5">
                  <NuxtLink :to="`/profile/${e.userUid}`" target="_blank" class="mc-link">{{ e.userName || "Member" }}</NuxtLink>
                  <span v-if="e.userEmail"> · {{ e.userEmail }}</span> · sent {{ fmt(e.createdAt) }}
                </p>
              </div>
              <span class="mc-tag">
                <span class="mc-dot" :data-tone="TONE[e.status]" aria-hidden="true" />
                {{ STAFF_LABEL[e.status] }}
              </span>
            </div>

            <ul class="mc-thread">
              <li v-for="(m, i) in e.messages" :key="i">
                <span class="mc-thread-by">{{ m.by === "tcgo" ? `TCGo${m.staffName ? ` (${m.staffName})` : ""}` : "Member" }}</span>{{ m.text }}<span class="mc-thread-at">{{ fmt(m.at) }}</span>
              </li>
            </ul>

            <div v-if="e.status !== 'closed'" class="mc-divider mt-4 pt-4 grid gap-3">
              <label class="mc-field">
                <span>Reply</span>
                <textarea
                  v-model="drafts[e.id]"
                  rows="3"
                  :maxlength="ENQUIRY_MESSAGE_MAX"
                  class="mc-input"
                  placeholder="Shows in their enquiry history and rings their bell."
                />
              </label>
              <div class="flex flex-wrap gap-2">
                <button
                  type="button"
                  class="mc-btn mc-btn-sm mc-btn-primary"
                  :disabled="busy === e.id || !(drafts[e.id] || '').trim()"
                  @click="act(e, { reply: true })"
                >
                  Send reply
                </button>
                <button
                  type="button"
                  class="mc-btn mc-btn-sm"
                  :disabled="busy === e.id || !(drafts[e.id] || '').trim()"
                  @click="act(e, { reply: true, close: true })"
                >
                  Reply and close
                </button>
                <button
                  type="button"
                  class="mc-btn mc-btn-sm mc-btn-ghost"
                  :disabled="busy === e.id"
                  @click="act(e, { close: true })"
                >
                  Close
                </button>
              </div>
            </div>
          </li>
        </ul>
      </section>
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
const TONE: Record<EnquiryStatus, "warn" | "good" | undefined> = {
  open: "warn",
  answered: "good",
  closed: undefined,
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

// Waiting on us first, oldest first, so the longest wait is at the top.
const needsReply = computed(() =>
  enquiries.value.filter((e) => e.status === "open").sort((a, b) => a.updatedAt - b.updatedAt),
);
const replied = computed(() => enquiries.value.filter((e) => e.status === "answered"));
const groups = computed(() =>
  view.value === "closed"
    ? [{ key: "closed", title: "Closed", items: enquiries.value }]
    : [
        { key: "open", title: "Needs reply", items: needsReply.value },
        { key: "answered", title: "Replied, waiting on the member", items: replied.value },
      ],
);

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
