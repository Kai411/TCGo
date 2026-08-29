<template>
  <div class="max-w-md mx-auto">
    <h1 class="text-2xl font-bold mb-1">Your account</h1>
    <p class="text-[13px] text-ink-muted dark:text-zinc-400 mb-6">
      {{ me?.staffId }} · {{ me?.roleName }}
    </p>

    <div
      v-if="first"
      class="mb-5 rounded-xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-[13px] leading-relaxed text-amber-800 dark:text-amber-300"
    >
      Whoever created this account knows the password you just used. Set your
      own before you do anything else.
    </div>

    <form
      class="surface rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-5 space-y-4"
      @submit.prevent="submit"
    >
      <h2 class="text-sm font-bold">Change password</h2>

      <div>
        <label class="block text-xs font-semibold mb-1.5">Current password</label>
        <input
          v-model="current"
          type="password"
          autocomplete="current-password"
          class="w-full px-3 py-2.5 rounded-lg border border-black/[0.08] dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-sm"
        />
      </div>

      <div>
        <label class="block text-xs font-semibold mb-1.5">New password</label>
        <input
          v-model="next"
          type="password"
          autocomplete="new-password"
          class="w-full px-3 py-2.5 rounded-lg border border-black/[0.08] dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-sm"
        />
        <p class="mt-1.5 text-[11px] text-ink-soft dark:text-zinc-500">
          At least {{ MIN_PASSWORD_LENGTH }} characters. A few unrelated words
          beats a short one with symbols in it.
        </p>
      </div>

      <p v-if="error" class="text-[13px] text-red-600 dark:text-red-400">{{ error }}</p>
      <p v-if="done" class="text-[13px] text-emerald-600 dark:text-emerald-400">
        Password changed. Any other browser you were signed in on has been signed out.
      </p>

      <button
        type="submit"
        :disabled="busy || !current || !next"
        class="w-full py-2.5 rounded-lg text-sm font-semibold bg-ink text-white dark:bg-white dark:text-ink disabled:opacity-50"
      >
        {{ busy ? "Saving…" : "Change password" }}
      </button>
    </form>

    <div class="mt-6">
      <h2 class="text-sm font-bold mb-2">What you can do</h2>
      <ul class="space-y-1.5">
        <li
          v-for="p in myPermissions"
          :key="p.key"
          class="text-[13px] text-ink-muted dark:text-zinc-400 flex gap-2"
        >
          <span class="text-emerald-500 shrink-0">✓</span>{{ p.label }}
        </li>
      </ul>
      <p v-if="!myPermissions.length" class="text-[13px] text-ink-soft dark:text-zinc-500">
        Your role currently carries no permissions. Ask an admin.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { MIN_PASSWORD_LENGTH, PERMISSIONS, hasPermission } from "~/shared/staff";

definePageMeta({ layout: "admin", middleware: "mintcondition" });
useHead({ title: "Your account — Mint Condition" });

const route = useRoute();
const { me, refresh } = useStaffAuth();
const { mcFetch } = useMcFetch();

const first = computed(() => route.query.first === "1");
const current = ref("");
const next = ref("");
const busy = ref(false);
const error = ref("");
const done = ref(false);

const myPermissions = computed(() =>
  PERMISSIONS.filter((p) => hasPermission(me.value?.permissions, p.key)),
);

const submit = async () => {
  busy.value = true;
  error.value = "";
  done.value = false;
  try {
    await mcFetch("/api/mc/password", {
      method: "POST",
      body: { current: current.value, next: next.value },
    });
    done.value = true;
    current.value = "";
    next.value = "";
    await refresh();
    if (first.value) await navigateTo("/mintcondition");
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || "Couldn't change it.";
  } finally {
    busy.value = false;
  }
};
</script>
