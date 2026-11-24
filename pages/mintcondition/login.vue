<template>
  <div class="mc min-h-screen grid place-items-center px-4 py-10">
    <div class="w-full max-w-sm">
      <div class="text-center mb-6">
        <p class="mc-eyebrow">Mint Condition</p>
        <h1 class="mc-h1 mt-1.5">Operations sign-in</h1>
        <p class="mc-meta mt-1.5">Staff accounts only. This isn't your marketplace login.</p>
      </div>

      <form class="mc-card mc-card-pad grid gap-4" @submit.prevent="submit">
        <label class="mc-field" for="staffId">
          <span>Staff ID</span>
          <input
            id="staffId"
            v-model="staffId"
            type="text"
            autocomplete="username"
            autocapitalize="characters"
            spellcheck="false"
            placeholder="A0001"
            class="mc-input mc-mono uppercase placeholder:normal-case"
          />
        </label>

        <label class="mc-field" for="password">
          <span>Password</span>
          <input id="password" v-model="password" type="password" autocomplete="current-password" class="mc-input" />
        </label>

        <p v-if="error" role="alert" class="mc-callout" data-tone="bad">{{ error }}</p>

        <button type="submit" :disabled="busy || !staffId || !password" class="mc-btn mc-btn-primary w-full">
          {{ busy ? "Signing in…" : "Sign in" }}
        </button>
      </form>

      <p class="mt-5 text-center mc-small">
        Forgotten your password? An admin has to reset it. Staff accounts have
        no email recovery, by design.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import "~/assets/css/mint-condition.css";
// No layout: the admin chrome assumes a signed-in staff member, and rendering
// a nav full of links that all bounce back here is worse than a bare page.
definePageMeta({ layout: false });
useHead({
  title: "Sign in — Mint Condition",
  meta: [{ name: "robots", content: "noindex, nofollow" }],
});

const route = useRoute();
const { login, ensure } = useStaffAuth();

const staffId = ref("");
const password = ref("");
const busy = ref(false);
const error = ref("");

// Already signed in and landed here anyway — go where they were going.
onMounted(async () => {
  const me = await ensure();
  if (me.signedIn) await go();
});

const go = async () => {
  const next = String(route.query.next || "/mintcondition");
  // Only internal paths, so a crafted ?next= can't turn the console's login
  // into an open redirect that looks like it came from us.
  await navigateTo(next.startsWith("/mintcondition") ? next : "/mintcondition");
};

const submit = async () => {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  try {
    const res = await login(staffId.value, password.value);
    if (res.mustChangePassword) {
      await navigateTo("/mintcondition/account?first=1");
      return;
    }
    await go();
  } catch (e: any) {
    error.value =
      e?.data?.message || e?.message || "Couldn't sign in. Try again shortly.";
    password.value = "";
  } finally {
    busy.value = false;
  }
};
</script>
