<template>
  <p class="text-[11px] text-ink-soft dark:text-zinc-500">
    <span :class="online ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : ''">{{ seen }}</span>
    <span aria-hidden="true"> · </span>
    <span>{{ reply }}</span>
  </p>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { doc, getDoc } from "firebase/firestore";
import { isOnlineNow, lastSeenLabel, replyTimeLabel, type ReplyStats } from "~/shared/chat";

// Last online and average reply time, for a profile page. The chat header
// shows the same thing live.
const props = defineProps<{ uid: string; lastSeenAt?: number | null }>();

const { firestore } = useFirebase();
const { user } = useAuth();
const stats = ref<Partial<ReplyStats> | null>(null);

onMounted(async () => {
  // userStats is readable when signed in, like the rest of a profile.
  if (!user.value) return;
  try {
    const snap = await getDoc(doc(firestore!, "userStats", props.uid));
    stats.value = (snap.data() as ReplyStats) ?? null;
  } catch {}
});

const online = computed(() => isOnlineNow(props.lastSeenAt));
const seen = computed(() => lastSeenLabel(props.lastSeenAt));
const reply = computed(() => replyTimeLabel(stats.value));
</script>
