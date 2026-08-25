<template>
  <div>
    <!-- Current state + ETA -->
    <div v-if="tracking" class="mb-3">
      <p class="text-sm font-semibold text-ink dark:text-white">
        {{ tracking.statusText || tracking.description || "In progress" }}
      </p>
      <p v-if="etaLabel" class="text-xs mt-0.5" :class="tracking.etaAccurate
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-gray-500 dark:text-zinc-400'">
        {{ etaLabel }}
      </p>
      <p v-if="tracking.origin && tracking.destination" class="text-[11px] text-gray-400 dark:text-zinc-500 mt-0.5">
        {{ tracking.origin }} → {{ tracking.destination }}
      </p>
    </div>

    <!-- Event timeline, newest first -->
    <ol v-if="events.length" class="relative">
      <li
        v-for="(e, i) in events"
        :key="`${e.createdAt}-${i}`"
        class="relative flex gap-3 pb-4 last:pb-0"
      >
        <!-- rail -->
        <span
          v-if="i !== events.length - 1"
          class="absolute left-[5px] top-3 bottom-0 w-px bg-gray-200 dark:bg-white/[0.12]"
        />
        <span
          class="relative z-10 mt-1 w-[11px] h-[11px] rounded-full shrink-0 ring-2 ring-white dark:ring-[#111]"
          :class="i === 0
            ? 'bg-emerald-500'
            : 'bg-gray-300 dark:bg-zinc-600'"
        />
        <div class="min-w-0 flex-1 -mt-0.5">
          <p
            class="text-sm"
            :class="i === 0
              ? 'font-semibold text-ink dark:text-white'
              : 'text-gray-600 dark:text-zinc-300'"
          >
            {{ e.statusText || e.description || "Update" }}
          </p>
          <p v-if="e.description && e.description !== e.statusText" class="text-xs text-gray-500 dark:text-zinc-400">
            {{ e.description }}
          </p>
          <p class="text-[11px] text-gray-400 dark:text-zinc-500 mt-0.5">
            {{ fmt(e.createdAt) }}<template v-if="e.location"> · {{ e.location }}</template>
          </p>
        </div>
      </li>
    </ol>

    <p v-else class="text-sm text-gray-500 dark:text-zinc-400">
      {{ emptyMessage }}
    </p>
  </div>
</template>

<script setup lang="ts">
interface TrackEvent {
  statusCode: number;
  statusText: string | null;
  description: string | null;
  location: string | null;
  createdAt: string;
}
interface Tracking {
  statusCode: number;
  statusText: string | null;
  description: string | null;
  origin: string | null;
  destination: string | null;
  events: TrackEvent[];
  etaSeconds: number | null;
  etaAccurate: boolean;
}

const props = defineProps<{
  tracking: Tracking | null;
  emptyMessage?: string;
}>();

// Delyva returns histories newest-first already, but don't rely on it.
const events = computed(() =>
  [...(props.tracking?.events ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  ),
);

const emptyMessage = computed(
  () => props.emptyMessage || "No courier updates yet.",
);

// Delyva gives a duration, not a date, and only while the parcel is moving.
// Anything else would be us inventing a delivery promise.
const etaLabel = computed(() => {
  const secs = props.tracking?.etaSeconds;
  if (!secs || secs <= 0) return "";
  const arrival = new Date(Date.now() + secs * 1000);
  const sameDay = arrival.toDateString() === new Date().toDateString();
  const when = sameDay
    ? `today, ${arrival.toLocaleTimeString("en-MY", { hour: "numeric", minute: "2-digit" })}`
    : arrival.toLocaleString("en-MY", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      });
  return props.tracking?.etaAccurate
    ? `Estimated arrival ${when}`
    : `Estimated arrival ${when} (rough estimate)`;
});

const fmt = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-MY", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
};
</script>
