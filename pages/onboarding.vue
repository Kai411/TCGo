<template>
  <div class="min-h-screen bg-canvas dark:bg-canvas-inverse text-ink dark:text-zinc-100 px-4 py-10">
    <div class="mx-auto w-full max-w-md">
      <NuxtLink to="/" class="mx-auto mb-7 flex items-center justify-center h-14" aria-label="TCGo home">
        <img src="~/assets/images/tcgo_sprites.png" alt="TCGo" class="h-full w-[96px] object-cover block dark:hidden" />
        <img src="/tcgo_sprites_white.png" alt="TCGo" class="h-full w-[96px] object-cover hidden dark:block" />
      </NuxtLink>

      <!-- Progress. Three steps is few enough to show all of them, which is
           better than "step 2 of 3" — someone can see what's still coming and
           decide to finish now rather than being surprised twice. -->
      <ol class="mb-7 space-y-1">
        <li
          v-for="(s, i) in ONBOARDING_STEPS"
          :key="s.id"
          class="flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors"
          :class="s.id === state.current ? 'bg-white dark:bg-white/[0.05] shadow-sm' : ''"
        >
          <span
            class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
            :class="
              isDone(s.id)
                ? 'bg-emerald-500 text-white'
                : s.id === state.current
                  ? 'bg-pokemon-red text-white'
                  : 'bg-black/[0.07] dark:bg-white/[0.10] text-ink-soft'
            "
          >
            <svg v-if="isDone(s.id)" class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <template v-else>{{ i + 1 }}</template>
          </span>
          <div class="min-w-0">
            <p
              class="text-[13px] font-semibold leading-tight"
              :class="isDone(s.id) ? 'text-ink-soft dark:text-zinc-500 line-through' : 'text-ink dark:text-white'"
            >
              {{ s.title }}
            </p>
            <p v-if="s.id === state.current" class="mt-0.5 text-[12px] text-ink-muted dark:text-zinc-400">
              {{ s.blurb }}
            </p>
          </div>
        </li>
      </ol>

      <div class="surface rounded-2xl p-6">
        <!-- ── Email ────────────────────────────────────────────────── -->
        <template v-if="state.current === 'email'">
          <h1 class="text-lg font-bold text-ink dark:text-white">Confirm your email</h1>
          <p class="mt-1.5 text-[13px] text-ink-muted dark:text-zinc-400">
            We sent a 6-digit code to <span class="font-semibold text-ink dark:text-white">{{ email }}</span>.
          </p>

          <input
            v-model="code"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="6"
            placeholder="000000"
            class="field mt-5 text-center text-2xl font-mono tracking-[0.4em]"
          />
          <p v-if="error" class="mt-3 text-[13px] text-rose-600 dark:text-rose-400">{{ error }}</p>
          <p v-if="notice" class="mt-3 text-[13px] text-emerald-600 dark:text-emerald-400">{{ notice }}</p>

          <button :disabled="busy || code.length < 6" @click="submitCode" class="btn-primary mt-5">
            <span v-if="busy" class="spinner" />Confirm email
          </button>
          <button :disabled="busy || cooldown > 0" @click="resend" class="mt-3 w-full text-[13px] font-semibold text-pokemon-red hover:underline disabled:text-ink-soft disabled:no-underline">
            {{ cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code" }}
          </button>
        </template>

        <!-- ── Delivery address ─────────────────────────────────────── -->
        <template v-else-if="state.current === 'address'">
          <h1 class="text-lg font-bold text-ink dark:text-white">Where should orders go?</h1>
          <p class="mt-1.5 text-[13px] text-ink-muted dark:text-zinc-400">
            Shipping is quoted from this address. You can change it per order.
          </p>

          <div class="mt-5 space-y-3">
            <div class="grid grid-cols-2 gap-3">
              <label class="block">
                <span class="lbl">Full name</span>
                <input v-model="addr.deliveryName" autocomplete="name" class="field" />
              </label>
              <label class="block">
                <span class="lbl">Phone</span>
                <input v-model="addr.deliveryPhone" inputmode="tel" autocomplete="tel" placeholder="01x-xxx xxxx" class="field" />
              </label>
            </div>
            <label class="block">
              <span class="lbl">Address</span>
              <input v-model="addr.deliveryAddress1" autocomplete="address-line1" class="field" />
            </label>
            <label class="block">
              <span class="lbl">Unit, floor <span class="font-normal text-ink-soft">— optional</span></span>
              <input v-model="addr.deliveryAddress2" autocomplete="address-line2" class="field" />
            </label>
            <div class="grid grid-cols-3 gap-3">
              <label class="block">
                <span class="lbl">Postcode</span>
                <input v-model="addr.deliveryPostcode" inputmode="numeric" maxlength="5" autocomplete="postal-code" class="field" />
              </label>
              <label class="block col-span-2">
                <span class="lbl">City</span>
                <input v-model="addr.deliveryCity" autocomplete="address-level2" class="field" />
              </label>
            </div>
            <label class="block">
              <span class="lbl">State</span>
              <select v-model="addr.deliveryState" class="field">
                <option value="" disabled>Choose a state</option>
                <option v-for="s in MY_STATES" :key="s.code" :value="s.code">{{ s.name }}</option>
              </select>
            </label>
          </div>

          <p v-if="error" class="mt-3 text-[13px] text-rose-600 dark:text-rose-400">{{ error }}</p>
          <button :disabled="busy" @click="saveAddress" class="btn-primary mt-5">
            <span v-if="busy" class="spinner" />Save and continue
          </button>
        </template>

        <!-- ── Identity ─────────────────────────────────────────────── -->
        <template v-else-if="state.current === 'identity'">
          <h1 class="text-lg font-bold text-ink dark:text-white">Verify your identity</h1>
          <p class="mt-1.5 text-[13px] text-ink-muted dark:text-zinc-400">
            A photo of your IC or passport, and a selfie. Takes about a minute,
            and it's what keeps fake accounts off the marketplace.
          </p>
          <div class="mt-5">
            <KycVerifyCard />
          </div>
        </template>

        <!-- ── Done ─────────────────────────────────────────────────── -->
        <template v-else>
          <div class="text-center py-4">
            <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white">
              <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1 class="text-lg font-bold text-ink dark:text-white">You're all set</h1>
            <p class="mt-1.5 text-[13px] text-ink-muted dark:text-zinc-400">
              Your account is ready to buy and sell.
            </p>
            <button @click="finish" class="btn-primary mt-5">Start browsing</button>
          </div>
        </template>
      </div>

      <button @click="signOutAndLeave" class="mx-auto mt-6 block text-[12px] text-ink-soft dark:text-zinc-500 hover:underline">
        Sign out
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, reactive, ref, watch } from "vue";
import { MY_STATES } from "~/shared/my-states";
import {
  ONBOARDING_STEPS,
  onboardingState,
  type OnboardingStepId,
} from "~/shared/onboarding";

// No layout: the marketplace nav would offer destinations this page exists to
// keep people out of.
definePageMeta({ layout: false });
useHead({ title: "Finish setting up | TCGo" });

const RESEND_COOLDOWN_S = 30;

const { user, requestCode, confirmEmail, signOut } = useAuth();
const { profile, updateProfile, loading: loadingProfile } = useMyProfile();
const route = useRoute();

const busy = ref(false);
const error = ref("");
const notice = ref("");
const code = ref("");

const email = computed(() => user.value?.email ?? "");

const state = computed(() =>
  onboardingState(profile.value, !!user.value?.emailVerified),
);
const isDone = (id: OnboardingStepId) => !state.value.remaining.includes(id);

// Seeded from whatever's already saved, so someone who filled half of this in
// and came back doesn't retype it.
const addr = reactive({
  deliveryName: "",
  deliveryPhone: "",
  deliveryAddress1: "",
  deliveryAddress2: "",
  deliveryPostcode: "",
  deliveryCity: "",
  deliveryState: "",
});
watch(
  profile,
  (p) => {
    if (!p) return;
    for (const k of Object.keys(addr) as (keyof typeof addr)[]) {
      if (!addr[k] && p[k]) addr[k] = String(p[k]);
    }
    if (!addr.deliveryName && user.value?.displayName) {
      addr.deliveryName = user.value.displayName;
    }
  },
  { immediate: true },
);

// ── Email step ────────────────────────────────────────────────────────
const cooldown = ref(0);
let timer: ReturnType<typeof setInterval> | null = null;
const startCooldown = () => {
  cooldown.value = RESEND_COOLDOWN_S;
  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    cooldown.value -= 1;
    if (cooldown.value <= 0 && timer) clearInterval(timer);
  }, 1000);
};
onUnmounted(() => timer && clearInterval(timer));

watch(code, (v) => {
  const digits = v.replace(/\D/g, "").slice(0, 6);
  if (digits !== v) code.value = digits;
});

const run = async (fn: () => Promise<void>) => {
  if (busy.value) return;
  error.value = "";
  notice.value = "";
  busy.value = true;
  try {
    await fn();
  } catch (e: any) {
    error.value = e?.data?.message || authMessage(e);
  } finally {
    busy.value = false;
  }
};

const submitCode = () =>
  run(async () => {
    await confirmEmail(email.value, code.value);
    code.value = "";
  });

const resend = () =>
  run(async () => {
    const res = await requestCode(email.value, "verify_email");
    notice.value = res.message;
    startCooldown();
  });

// ── Address step ──────────────────────────────────────────────────────
const saveAddress = () =>
  run(async () => {
    if (
      !addr.deliveryName.trim() ||
      !addr.deliveryPhone.trim() ||
      !addr.deliveryAddress1.trim() ||
      !addr.deliveryPostcode.trim() ||
      !addr.deliveryCity.trim() ||
      !addr.deliveryState
    ) {
      error.value = "Fill in everything except the unit line.";
      return;
    }
    await updateProfile({ ...addr });
  });

// ── Exit ──────────────────────────────────────────────────────────────
const finish = () => navigateTo((route.query.next as string) || "/");

const signOutAndLeave = async () => {
  await signOut();
  await navigateTo("/login");
};

// The middleware turns finished accounts away from this page — but it bails
// out while the profile is still loading, and Nuxt does not re-run middleware
// when that data later arrives. So the page checks for itself.
//
// The distinction that matters is whether they SAW an unfinished step:
//
//   arrived already done  → leave at once, no screen, no flash
//   finished it just now  → show "You're all set", then go
//
// Without that, signing in showed a celebration for work done days ago.
const sawIncomplete = ref(false);

watch(
  () => [loadingProfile.value, state.value.complete] as const,
  ([stillLoading, done]) => {
    if (stillLoading) return;
    if (!done) {
      sawIncomplete.value = true;
      return;
    }
    if (sawIncomplete.value) setTimeout(finish, 900);
    else finish();
  },
  { immediate: true },
);
</script>

<style scoped>
.lbl {
  @apply mb-1.5 block text-xs font-semibold text-ink-muted dark:text-zinc-400;
}
.field {
  @apply w-full rounded-xl border border-black/[0.10] dark:border-white/[0.12]
         bg-white dark:bg-white/[0.04] px-3.5 py-2.5 text-[15px] text-ink dark:text-white
         placeholder:text-ink-soft outline-none transition-colors
         focus:border-pokemon-red focus:ring-2 focus:ring-pokemon-red/20;
}
.btn-primary {
  @apply w-full inline-flex items-center justify-center gap-2 rounded-xl bg-pokemon-red
         px-4 py-2.5 text-sm font-bold text-white transition-opacity
         hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed;
}
.spinner {
  @apply h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white;
}
</style>
