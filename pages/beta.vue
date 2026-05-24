<script setup lang="ts">
definePageMeta({ layout: "default" });

useHead({ title: "Beta Program · TCGo" });

const { user, signInWithGoogle } = useAuth();
const { profile } = useMyProfile();
const { sendCode, verifyCode, sending, verifying, error, codeSent, reset } =
  usePhoneVerification();

const phone = ref("");
const otp = ref("");
const success = ref(false);

const isVerified = computed(() => profile.value?.whatsappVerified === true || success.value);

const normalizedPhone = computed(() => {
  let p = phone.value.replace(/\D/g, "");
  if (p.startsWith("0")) p = "60" + p.slice(1);
  else if (!p.startsWith("60")) p = "60" + p;
  return "+" + p;
});

const handleSend = async () => {
  error.value = "";
  const result = await sendCode(normalizedPhone.value, "send-otp-btn");
  if (result === "already-verified") success.value = true;
};

const handleVerify = async () => {
  const ok = await verifyCode(otp.value, normalizedPhone.value);
  if (ok) success.value = true;
};

const handleSignIn = async () => {
  await signInWithGoogle();
};

const step = computed(() => {
  if (!user.value) return 1;
  if (isVerified.value) return 3;
  return 2;
});

const steps = ["Sign in", "Verify phone", "Start trading"];

const expectations = [
  "Buy and sell Pokemon TCG cards with verified collectors across Malaysia.",
  "Phone verification keeps the community spam-free and builds trust between buyers and sellers.",
  "Your number is only used for verification — it won't be shared publicly unless you choose to add it to your profile.",
  "Beta features may change. Your feedback helps shape the final product.",
];
</script>

<template>
  <div class="max-w-lg mx-auto py-12 px-4">

    <!-- Header -->
    <div class="mb-10">
      <span class="inline-block text-[11px] font-bold tracking-widest uppercase text-pokemon-red mb-3">
        Beta Program
      </span>
      <h1 class="text-3xl font-bold text-ink dark:text-white leading-tight">
        Early access to TCGo Marketplace
      </h1>
      <p class="mt-3 text-sm text-ink-muted dark:text-zinc-400 leading-relaxed">
        TCGo is in closed beta. We verify phone numbers to keep the community
        trusted and spam-free. Verification takes under a minute.
      </p>
    </div>

    <!-- Steps -->
    <ol class="flex items-start gap-0 mb-10">
      <li v-for="(s, i) in steps" :key="i" class="flex-1 flex flex-col items-center text-center relative">
        <!-- connector line -->
        <div v-if="i < steps.length - 1" class="absolute top-3.5 left-1/2 w-full h-px"
          :class="step > i + 1 ? 'bg-pokemon-red' : 'bg-black/10 dark:bg-white/10'" />
        <!-- circle -->
        <div class="relative z-10 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors"
          :class="step > i + 1
            ? 'bg-pokemon-red text-white'
            : step === i + 1
              ? 'bg-ink text-white dark:bg-white dark:text-ink'
              : 'bg-black/[0.06] dark:bg-white/[0.08] text-ink-muted dark:text-zinc-400'"
        >
          <svg v-if="step > i + 1" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span v-else>{{ i + 1 }}</span>
        </div>
        <p class="mt-1.5 text-[11px] font-medium leading-tight px-1"
          :class="step === i + 1 ? 'text-ink dark:text-white' : 'text-ink-muted dark:text-zinc-500'">
          {{ s }}
        </p>
      </li>
    </ol>

    <!-- Verification card -->
    <div class="surface rounded-2xl border border-black/[0.06] dark:border-white/[0.08] overflow-hidden">

      <!-- Step 1: Sign in -->
      <div v-if="step === 1" class="p-6 flex flex-col items-center text-center gap-4">
        <div class="w-12 h-12 rounded-full bg-black/[0.04] dark:bg-white/[0.06] flex items-center justify-center">
          <svg class="w-6 h-6 text-ink-muted dark:text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
        <div>
          <p class="font-semibold text-ink dark:text-white">Sign in to continue</p>
          <p class="text-sm text-ink-muted dark:text-zinc-400 mt-1">Create an account or log in with Google to begin verification.</p>
        </div>
        <button
          @click="handleSignIn"
          class="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full text-sm font-semibold bg-ink text-white dark:bg-white dark:text-ink hover:opacity-90 transition-opacity"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>
      </div>

      <!-- Step 2: Verify phone -->
      <div v-else-if="step === 2" class="p-6">
        <div class="flex items-center gap-3 mb-5">
          <div class="w-8 h-8 rounded-full bg-black/[0.04] dark:bg-white/[0.06] flex items-center justify-center shrink-0">
            <svg class="w-4 h-4 text-ink-muted dark:text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
          </div>
          <div>
            <p class="font-semibold text-sm text-ink dark:text-white">Verify your phone number</p>
            <p class="text-xs text-ink-muted dark:text-zinc-400">We'll send a one-time code via SMS.</p>
          </div>
        </div>

        <!-- Phone input phase -->
        <div v-if="!codeSent" class="space-y-3">
          <div>
            <label class="block text-xs font-semibold text-ink-muted dark:text-zinc-400 mb-1.5">Phone number</label>
            <div class="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-black/[0.1] dark:border-white/[0.1] bg-white dark:bg-zinc-800 focus-within:ring-2 focus-within:ring-pokemon-red/30 focus-within:border-pokemon-red transition-all">
              <span class="text-sm text-ink-muted dark:text-zinc-400 shrink-0 select-none">🇲🇾 +60</span>
              <div class="w-px h-4 bg-black/[0.1] dark:bg-white/[0.1] shrink-0" />
              <input
                v-model="phone"
                type="tel"
                inputmode="tel"
                placeholder="12-3456789"
                @keydown.enter="handleSend"
                class="flex-1 bg-transparent text-sm text-ink dark:text-white placeholder-ink-muted/50 dark:placeholder-zinc-500 outline-none"
              />
            </div>
            <p class="text-[11px] text-ink-muted dark:text-zinc-500 mt-1.5">Enter your number without the leading 0 (e.g. 12-3456789)</p>
          </div>

          <p v-if="error" class="text-xs text-pokemon-red font-medium">{{ error }}</p>

          <button
            id="send-otp-btn"
            @click="handleSend"
            :disabled="sending || phone.length < 8"
            class="w-full py-2.5 rounded-xl text-sm font-bold bg-pokemon-red text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <span v-if="sending">Sending…</span>
            <span v-else>Send verification code</span>
          </button>
        </div>

        <!-- OTP input phase -->
        <div v-else class="space-y-3">
          <p class="text-sm text-ink-muted dark:text-zinc-400">
            Code sent to <span class="font-semibold text-ink dark:text-white">{{ normalizedPhone }}</span>.
            Check your SMS.
          </p>
          <div>
            <label class="block text-xs font-semibold text-ink-muted dark:text-zinc-400 mb-1.5">6-digit code</label>
            <input
              v-model="otp"
              type="text"
              inputmode="numeric"
              maxlength="6"
              placeholder="------"
              @keydown.enter="handleVerify"
              class="w-full px-3 py-2.5 rounded-xl border border-black/[0.1] dark:border-white/[0.1] bg-white dark:bg-zinc-800 text-sm text-center tracking-[0.4em] font-mono text-ink dark:text-white focus:ring-2 focus:ring-pokemon-red/30 focus:border-pokemon-red outline-none transition-all"
            />
          </div>

          <p v-if="error" class="text-xs text-pokemon-red font-medium">{{ error }}</p>

          <button
            @click="handleVerify"
            :disabled="verifying || otp.length < 6"
            class="w-full py-2.5 rounded-xl text-sm font-bold bg-pokemon-red text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <span v-if="verifying">Verifying…</span>
            <span v-else>Confirm code</span>
          </button>

          <button @click="reset(); otp = ''" class="w-full text-xs text-ink-muted dark:text-zinc-500 hover:text-ink dark:hover:text-zinc-300 transition-colors">
            Wrong number? Try again
          </button>
        </div>
      </div>

      <!-- Step 3: Verified -->
      <div v-else class="p-6 flex flex-col items-center text-center gap-4">
        <div class="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center">
          <svg class="w-7 h-7 text-emerald-600 dark:text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <div>
          <p class="font-bold text-ink dark:text-white">You're verified!</p>
          <p class="text-sm text-ink-muted dark:text-zinc-400 mt-1">Your account has full access to the TCGo beta marketplace.</p>
        </div>
        <NuxtLink
          to="/"
          class="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-semibold bg-pokemon-red text-white hover:bg-red-700 transition-colors"
        >
          Browse the marketplace
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
          </svg>
        </NuxtLink>
      </div>
    </div>

    <!-- What to expect -->
    <div v-if="step < 3" class="mt-8 space-y-3">
      <p class="text-xs font-bold uppercase tracking-wider text-ink-muted dark:text-zinc-500">What to expect</p>
      <div class="space-y-2">
        <div v-for="item in expectations" :key="item" class="flex items-start gap-2.5">
          <svg class="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <p class="text-xs text-ink-muted dark:text-zinc-400">{{ item }}</p>
        </div>
      </div>
    </div>

  </div>
</template>
