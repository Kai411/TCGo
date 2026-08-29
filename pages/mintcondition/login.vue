<template>
  <div
    class="min-h-screen flex items-center justify-center px-4 bg-canvas dark:bg-canvas-inverse text-ink dark:text-zinc-100"
  >
    <div class="w-full max-w-sm">
      <div class="text-center mb-7">
        <p
          class="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-soft dark:text-zinc-500"
        >
          Mint Condition
        </p>
        <h1 class="mt-1.5 text-2xl font-bold">Operations sign-in</h1>
        <p class="mt-2 text-[13px] text-ink-muted dark:text-zinc-400">
          Staff accounts only. This isn't your marketplace login.
        </p>
      </div>

      <form class="surface rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-5 space-y-4" @submit.prevent="submit">
        <div>
          <label for="staffId" class="block text-xs font-semibold mb-1.5">Staff ID</label>
          <input
            id="staffId"
            v-model="staffId"
            type="text"
            autocomplete="username"
            autocapitalize="characters"
            spellcheck="false"
            placeholder="A0001"
            class="w-full px-3 py-2.5 rounded-lg border border-black/[0.08] dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-sm font-mono tracking-wide uppercase placeholder:normal-case placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-ink/20 dark:focus:ring-white/20"
          />
        </div>

        <div>
          <label for="password" class="block text-xs font-semibold mb-1.5">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            autocomplete="current-password"
            class="w-full px-3 py-2.5 rounded-lg border border-black/[0.08] dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-sm focus:outline-none focus:ring-2 focus:ring-ink/20 dark:focus:ring-white/20"
          />
        </div>

        <p
          v-if="error"
          role="alert"
          class="text-[13px] leading-relaxed text-red-600 dark:text-red-400"
        >
          {{ error }}
        </p>

        <button
          type="submit"
          :disabled="busy || !staffId || !password"
          class="w-full py-2.5 rounded-lg text-sm font-semibold bg-ink text-white dark:bg-white dark:text-ink hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {{ busy ? "Signing in…" : "Sign in" }}
        </button>
      </form>

      <p class="mt-5 text-center text-[11px] leading-relaxed text-ink-soft dark:text-zinc-600">
        Forgotten your password? An admin has to reset it — there's no email
        recovery on staff accounts by design.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
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
