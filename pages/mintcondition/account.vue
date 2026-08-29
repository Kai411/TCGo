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
      <h2 class="text-sm font-bold">{{ first ? "Set your password" : "Change password" }}</h2>

      <div>
        <!-- On first run this is the password an admin handed over, not one
             the holder chose. Calling it "current" there invites people to
             type the password they *want* into it. -->
        <label class="block text-xs font-semibold mb-1.5">
          {{ first ? "Temporary password (the one you were given)" : "Current password" }}
        </label>
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

      <div>
        <!-- A confirm field is what people expect the second box to be. Having
             a real one removes the ambiguity rather than explaining it away. -->
        <label class="block text-xs font-semibold mb-1.5">Confirm new password</label>
        <input
          v-model="confirm"
          type="password"
          autocomplete="new-password"
          class="w-full px-3 py-2.5 rounded-lg border text-sm bg-white dark:bg-white/[0.04]"
          :class="
            mismatch
              ? 'border-red-300 dark:border-red-500/40'
              : 'border-black/[0.08] dark:border-white/[0.10]'
          "
        />
        <p v-if="mismatch" class="mt-1.5 text-[11px] text-red-600 dark:text-red-400">
          These two don't match.
        </p>
      </div>

      <p v-if="error" class="text-[13px] text-red-600 dark:text-red-400">{{ error }}</p>
      <p v-if="done" class="text-[13px] text-emerald-600 dark:text-emerald-400">
        Password changed. Any other browser you were signed in on has been signed out.
      </p>

      <button
        type="submit"
        :disabled="busy || !current || !next || mismatch"
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
const confirm = ref("");

// Only complain once there's something to compare — flagging a mismatch
// against a half-typed field trains people to ignore the warning.
const mismatch = computed(() => !!confirm.value && confirm.value !== next.value);
const busy = ref(false);
const error = ref("");
const done = ref(false);

const myPermissions = computed(() =>
  PERMISSIONS.filter((p) => hasPermission(me.value?.permissions, p.key)),
);

const submit = async () => {
  if (mismatch.value) return;
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
    confirm.value = "";
    await refresh();
    if (first.value) await navigateTo("/mintcondition");
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || "Couldn't change it.";
  } finally {
    busy.value = false;
  }
};
</script>
