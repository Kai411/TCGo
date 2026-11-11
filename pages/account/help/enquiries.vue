<template>
  <!-- Enquiry history: the member's own enquiries, newest activity first.
       Tap one to read the conversation and, while it's open, answer back. -->
  <div class="max-w-xl mx-auto">
    <SubpageHeader
      title="Enquiry history"
      back="/account/help?tab=contact"
      back-label="Help Center"
      desktop-title
    />

    <div v-if="!user && !authLoading" class="py-12 text-center space-y-4">
      <p class="text-sm text-ink-muted dark:text-zinc-400">Sign in to see your enquiries.</p>
      <button
        type="button"
        @click="goToLogin"
        class="inline-flex items-center min-h-[44px] px-6 rounded-full text-sm font-semibold bg-ink text-white dark:bg-white dark:text-ink transition-transform duration-150 active:scale-[0.97]"
      >
        Sign in
      </button>
    </div>

    <template v-else>
      <p
        v-if="sent"
        role="status"
        class="mb-4 rounded-2xl bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 px-4 py-3 text-sm"
      >
        Enquiry sent. We'll reply here, and you'll get a notification when we do.
      </p>

      <p v-if="error" role="alert" class="mb-4 text-sm text-red-600 dark:text-red-400">{{ error }}</p>

      <div v-if="loading && !enquiries.length" class="space-y-3" aria-busy="true">
        <div v-for="i in 3" :key="i" class="h-[76px] rounded-2xl bg-black/[0.04] dark:bg-white/[0.05] animate-pulse" />
      </div>

      <div v-else-if="!enquiries.length && !error" class="py-12 text-center space-y-4">
        <p class="text-sm text-ink-muted dark:text-zinc-400">No enquiries yet.</p>
        <NuxtLink
          to="/account/help/enquiry"
          class="inline-flex items-center min-h-[44px] px-6 rounded-full text-sm font-semibold bg-ink text-white dark:bg-white dark:text-ink transition-transform duration-150 active:scale-[0.97]"
        >
          Drop us an enquiry
        </NuxtLink>
      </div>

      <ul v-else class="space-y-3">
        <li
          v-for="e in enquiries"
          :key="e.id"
          class="surface rounded-2xl overflow-hidden"
        >
          <button
            type="button"
            class="press w-full flex items-start gap-3 px-4 py-3.5 text-left"
            :aria-expanded="openId === e.id"
            :aria-controls="`enq-${e.id}`"
            @click="toggle(e.id)"
          >
            <span class="flex-1 min-w-0">
              <span class="flex items-center gap-2">
                <span class="text-sm font-semibold text-ink dark:text-white truncate">{{ enquiryTopicLabel(e.topic) }}</span>
                <span class="pill" :class="PILL[e.status]">{{ ENQUIRY_STATUS_LABEL[e.status] }}</span>
              </span>
              <span class="block mt-0.5 text-xs text-ink-soft dark:text-zinc-500 truncate">
                {{ fmtDate(e.createdAt) }}<template v-if="e.orderRef"> · #{{ e.orderRef }}</template> · {{ e.messages[0]?.text }}
              </span>
            </span>
            <svg
              class="mt-1 w-4 h-4 shrink-0 text-ink-soft dark:text-zinc-500 transition-transform duration-200 ease-premium"
              :class="openId === e.id ? 'rotate-90' : ''"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>

          <div v-if="openId === e.id" :id="`enq-${e.id}`" class="px-4 pb-4 space-y-3 border-t border-black/[0.05] dark:border-white/[0.06] pt-3">
            <div
              v-for="(m, i) in e.messages"
              :key="i"
              class="flex flex-col"
              :class="m.by === 'member' ? 'items-end' : 'items-start'"
            >
              <p
                class="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line break-words select-text"
                :class="m.by === 'member'
                  ? 'bg-ink text-white dark:bg-white dark:text-ink rounded-br-md'
                  : 'bg-black/[0.05] dark:bg-white/[0.08] text-ink dark:text-zinc-100 rounded-bl-md'"
              >{{ m.text }}</p>
              <span class="mt-1 px-1 text-[11px] text-ink-soft dark:text-zinc-500">
                {{ m.by === "tcgo" ? "TCGo · " : "" }}{{ fmtDateTime(m.at) }}
              </span>
            </div>

            <p v-if="e.status === 'closed'" class="text-xs text-ink-soft dark:text-zinc-500 text-center pt-1">
              This enquiry is closed. Need more help?
              <NuxtLink to="/account/help/enquiry" class="font-semibold text-pokemon-red">Send a new one</NuxtLink>.
            </p>
            <form v-else class="flex items-end gap-2 pt-1" @submit.prevent="reply(e)">
              <label :for="`enq-reply-${e.id}`" class="sr-only">Reply</label>
              <textarea
                :id="`enq-reply-${e.id}`"
                v-model="drafts[e.id]"
                rows="1"
                :maxlength="ENQUIRY_MESSAGE_MAX"
                placeholder="Add a reply"
                class="flex-1 min-w-0 min-h-[44px] max-h-40 px-4 py-2.5 rounded-2xl text-base leading-snug resize-none text-ink dark:text-white bg-black/[0.04] dark:bg-white/[0.06] placeholder:text-ink-soft dark:placeholder:text-zinc-500 outline-none"
                style="field-sizing: content"
              />
              <button
                type="submit"
                :disabled="busy === e.id || !(drafts[e.id] || '').trim()"
                class="h-11 px-4 shrink-0 rounded-full text-sm font-semibold bg-pokemon-red text-white transition-[transform,opacity] duration-150 active:scale-[0.97] disabled:opacity-50"
              >
                {{ busy === e.id ? "Sending…" : "Send" }}
              </button>
            </form>
          </div>
        </li>
      </ul>
    </template>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from "vue";
import {
  ENQUIRY_MESSAGE_MAX,
  ENQUIRY_STATUS_LABEL,
  checkEnquiryMessage,
  enquiryTopicLabel,
  type Enquiry,
  type EnquiryStatus,
} from "~/shared/enquiries";

useHead({ title: "Enquiry history | TCGo" });

const route = useRoute();
const { user, authLoading } = useAuth();
const { goToLogin } = useSignInGate();
const { authedFetch } = useAuthedFetch();

const sent = route.query.sent === "1";
const enquiries = ref<Enquiry[]>([]);
const loading = ref(true);
const error = ref("");
const openId = ref<string | null>(null);
const drafts = reactive<Record<string, string>>({});
const busy = ref<string | null>(null);

const PILL: Record<EnquiryStatus, string> = {
  open: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  answered: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  closed: "bg-black/[0.05] dark:bg-white/[0.08] text-ink-muted dark:text-zinc-400",
};

const load = async () => {
  if (!user.value) return;
  loading.value = true;
  error.value = "";
  try {
    const res = await authedFetch<{ enquiries: Enquiry[] }>("/api/enquiries");
    enquiries.value = res.enquiries;
    // Just sent one, or only have one: open it.
    if (openId.value === null && (sent || res.enquiries.length === 1)) openId.value = res.enquiries[0]?.id ?? null;
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || "Couldn't load your enquiries.";
  } finally {
    loading.value = false;
  }
};
watch(user, load, { immediate: true });

const toggle = (id: string) => {
  openId.value = openId.value === id ? null : id;
};

const reply = async (e: Enquiry) => {
  const msg = checkEnquiryMessage(drafts[e.id]);
  if ("error" in msg) {
    error.value = msg.error;
    return;
  }
  busy.value = e.id;
  error.value = "";
  try {
    await authedFetch("/api/enquiries/reply", { method: "POST", body: { enquiryId: e.id, message: msg.text } });
    drafts[e.id] = "";
    await load();
  } catch (err: any) {
    error.value = err?.data?.message || err?.message || "Couldn't send that. Try again.";
  } finally {
    busy.value = null;
  }
};

const fmtDate = (ms: number) =>
  new Date(ms).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
const fmtDateTime = (ms: number) =>
  new Date(ms).toLocaleString("en-MY", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
</script>

<style scoped>
.pill {
  @apply shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold;
}
.press {
  transition: transform 160ms cubic-bezier(0.22, 1, 0.36, 1);
  -webkit-tap-highlight-color: transparent;
}
.press:active {
  transform: scale(0.98);
}
</style>
