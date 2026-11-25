<template>
  <div class="mc-page">
    <div class="max-w-[440px]">
      <div class="mc-page-head !mb-5">
        <div>
          <p class="mc-eyebrow mb-1">You</p>
          <h1 class="mc-h1">Your account</h1>
          <p class="mc-meta mt-1">
            <span class="mc-mono">{{ me?.staffId }}</span> · {{ me?.roleName }}
          </p>
        </div>
      </div>

      <p v-if="first" class="mc-callout mb-5">
        Whoever created this account knows the password you just used. Set your
        own before you do anything else.
      </p>

      <form class="mc-card mc-card-pad grid gap-4" @submit.prevent="submit">
        <h2 class="mc-h2">{{ first ? "Set your password" : "Change password" }}</h2>

        <!-- On first run this is the password an admin handed over, not one
             the holder chose. Calling it "current" there invites people to
             type the password they *want* into it. -->
        <label class="mc-field">
          <span>{{ first ? "Temporary password (the one you were given)" : "Current password" }}</span>
          <input v-model="current" type="password" autocomplete="current-password" class="mc-input" />
        </label>

        <label class="mc-field">
          <span>New password</span>
          <input v-model="next" type="password" autocomplete="new-password" class="mc-input" />
          <span class="mc-small">
            At least {{ MIN_PASSWORD_LENGTH }} characters. A few unrelated words
            beats a short one with symbols in it.
          </span>
        </label>

        <!-- A confirm field is what people expect the second box to be. Having
             a real one removes the ambiguity rather than explaining it away. -->
        <label class="mc-field">
          <span>Confirm new password</span>
          <input
            v-model="confirm"
            type="password"
            autocomplete="new-password"
            class="mc-input"
            :aria-invalid="mismatch"
          />
          <span v-if="mismatch" class="mc-small !text-[var(--danger)]">These two don't match.</span>
        </label>

        <p v-if="error" class="mc-callout" data-tone="bad" role="alert">{{ error }}</p>
        <p v-if="done" class="mc-callout" data-tone="good">
          Password changed. Any other browser you were signed in on has been signed out.
        </p>

        <button
          type="submit"
          :disabled="busy || !current || !next || mismatch"
          class="mc-btn mc-btn-primary w-full"
        >
          {{ busy ? "Saving…" : "Change password" }}
        </button>
      </form>

      <section class="mt-8" aria-labelledby="mc-perms">
        <h2 id="mc-perms" class="mc-h2 mb-3">What you can do</h2>
        <p v-if="!myPermissions.length" class="mc-card mc-empty">
          Your role currently carries no permissions. Ask an admin.
        </p>
        <ul v-else class="mc-card mc-list">
          <li v-for="p in myPermissions" :key="p.key" class="mc-list-row !grid-cols-[auto_minmax(0,1fr)] !py-2.5">
            <span class="mc-dot" data-tone="good" aria-hidden="true" />
            <span class="text-[13.5px]">{{ p.label }}</span>
          </li>
        </ul>
      </section>
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
