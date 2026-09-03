<template>
  <div class="min-h-[80vh] flex items-center justify-center px-4 py-12">
    <div class="w-full max-w-sm">
      <!-- Heading changes with the step so the page always says what it wants
           from you. A form that silently swaps its fields is the fastest way
           to make someone type the wrong thing. -->
      <div class="text-center mb-7">
        <h1 class="text-2xl font-bold tracking-tightest text-ink dark:text-white">
          {{ heading }}
        </h1>
        <p class="mt-2 text-sm text-ink-muted dark:text-zinc-400">{{ subheading }}</p>
      </div>

      <div class="surface rounded-2xl p-6 sm:p-7">
        <!-- ── Sign in / register ─────────────────────────────────── -->
        <form v-if="step === 'credentials'" @submit.prevent="submitCredentials" novalidate>
          <div v-if="mode === 'register'" class="mb-4">
            <label for="name" class="block text-xs font-semibold text-ink-muted dark:text-zinc-400 mb-1.5">
              Display name
            </label>
            <input
              id="name"
              v-model="displayName"
              type="text"
              autocomplete="name"
              placeholder="What buyers will see"
              class="field"
            />
          </div>

          <div class="mb-4">
            <label for="email" class="block text-xs font-semibold text-ink-muted dark:text-zinc-400 mb-1.5">
              Email
            </label>
            <input
              id="email"
              v-model="email"
              type="email"
              required
              autocomplete="email"
              autocapitalize="none"
              spellcheck="false"
              class="field"
            />
          </div>

          <div class="mb-2">
            <div class="flex items-baseline justify-between mb-1.5">
              <label for="password" class="block text-xs font-semibold text-ink-muted dark:text-zinc-400">
                Password
              </label>
              <button
                v-if="mode === 'signin'"
                type="button"
                @click="goToForgot"
                class="text-xs font-semibold text-pokemon-red hover:underline"
              >
                Forgot password?
              </button>
            </div>
            <div class="relative">
              <input
                id="password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                required
                :autocomplete="mode === 'register' ? 'new-password' : 'current-password'"
                class="field pr-16"
              />
              <button
                type="button"
                @click="showPassword = !showPassword"
                class="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-[11px] font-semibold text-ink-soft hover:text-ink dark:hover:text-white"
                :aria-label="showPassword ? 'Hide password' : 'Show password'"
              >
                {{ showPassword ? "Hide" : "Show" }}
              </button>
            </div>
            <p v-if="mode === 'register'" class="mt-1.5 text-[11px] text-ink-soft dark:text-zinc-500">
              At least {{ MIN_PASSWORD }} characters.
            </p>
          </div>

          <p v-if="error" class="mt-3 text-[13px] text-rose-600 dark:text-rose-400">{{ error }}</p>

          <button type="submit" :disabled="busy" class="btn-primary mt-5">
            <span v-if="busy" class="spinner" />
            {{ mode === "register" ? "Create account" : "Sign in" }}
          </button>

          <div class="flex items-center gap-3 my-5">
            <span class="h-px flex-1 bg-black/[0.08] dark:bg-white/[0.10]" />
            <span class="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">or</span>
            <span class="h-px flex-1 bg-black/[0.08] dark:bg-white/[0.10]" />
          </div>

          <button type="button" @click="withGoogle" :disabled="busy" class="btn-secondary">
            <svg class="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9z"/>
              <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24z"/>
              <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.8l4-3.1z"/>
              <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.5 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0A12 12 0 0 0 1.4 6.7l4 3.1C6.3 6.9 8.9 4.8 12 4.8z"/>
            </svg>
            Continue with Google
          </button>

          <p class="mt-6 text-center text-[13px] text-ink-muted dark:text-zinc-400">
            {{ mode === "register" ? "Already have an account?" : "New to TCGo?" }}
            <button type="button" @click="toggleMode" class="font-semibold text-pokemon-red hover:underline">
              {{ mode === "register" ? "Sign in" : "Create one" }}
            </button>
          </p>
        </form>

        <!-- ── Enter the code ─────────────────────────────────────── -->
        <form v-else-if="step === 'code'" @submit.prevent="submitCode" novalidate>
          <label for="code" class="block text-xs font-semibold text-ink-muted dark:text-zinc-400 mb-1.5">
            6-digit code
          </label>
          <input
            id="code"
            v-model="code"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="6"
            placeholder="000000"
            class="field text-center text-2xl tracking-[0.4em] font-mono"
          />

          <!-- Reset needs the new password on this same step: asking for the
               code, then a password, gives the code time to expire between
               two screens for no reason. -->
          <div v-if="purpose === 'reset_password'" class="mt-4">
            <label for="newpw" class="block text-xs font-semibold text-ink-muted dark:text-zinc-400 mb-1.5">
              New password
            </label>
            <input id="newpw" v-model="password" type="password" autocomplete="new-password" class="field" />
            <p class="mt-1.5 text-[11px] text-ink-soft dark:text-zinc-500">
              At least {{ MIN_PASSWORD }} characters.
            </p>
          </div>

          <p v-if="error" class="mt-3 text-[13px] text-rose-600 dark:text-rose-400">{{ error }}</p>
          <p v-if="notice" class="mt-3 text-[13px] text-emerald-600 dark:text-emerald-400">{{ notice }}</p>

          <button type="submit" :disabled="busy || code.length < 6" class="btn-primary mt-5">
            <span v-if="busy" class="spinner" />
            {{ purpose === "reset_password" ? "Set new password" : "Confirm email" }}
          </button>

          <div class="mt-5 flex items-center justify-between text-[13px]">
            <button type="button" @click="resend" :disabled="busy || cooldown > 0" class="font-semibold text-pokemon-red hover:underline disabled:text-ink-soft disabled:no-underline">
              {{ cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code" }}
            </button>
            <button type="button" @click="backToStart" class="text-ink-muted dark:text-zinc-400 hover:underline">
              Use a different email
            </button>
          </div>
        </form>

        <!-- ── Forgot: ask for the address ────────────────────────── -->
        <form v-else @submit.prevent="submitForgot" novalidate>
          <label for="fmail" class="block text-xs font-semibold text-ink-muted dark:text-zinc-400 mb-1.5">
            Email
          </label>
          <input
            id="fmail"
            v-model="email"
            type="email"
            required
            autocomplete="email"
            autocapitalize="none"
            spellcheck="false"
            class="field"
          />
          <p v-if="error" class="mt-3 text-[13px] text-rose-600 dark:text-rose-400">{{ error }}</p>

          <button type="submit" :disabled="busy" class="btn-primary mt-5">
            <span v-if="busy" class="spinner" />
            Send reset code
          </button>
          <button type="button" @click="backToStart" class="btn-secondary mt-3">Back to sign in</button>
        </form>
      </div>

      <p class="mt-5 text-center text-[11px] leading-relaxed text-ink-soft dark:text-zinc-500">
        By continuing you agree to TCGo's terms. We never post anything or
        share your address with other members.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";

definePageMeta({ layout: "default" });
useHead({ title: "Sign in | TCGo" });

const MIN_PASSWORD = 8;
const RESEND_COOLDOWN_S = 30;

const {
  user,
  signInWithGoogle,
  signInWithEmail,
  registerWithEmail,
  requestCode,
  confirmEmail,
  resetPassword,
} = useAuth();
const route = useRoute();

type Step = "credentials" | "code" | "forgot";
type Purpose = "verify_email" | "reset_password";

const step = ref<Step>("credentials");
const mode = ref<"signin" | "register">(
  route.query.mode === "register" ? "register" : "signin",
);
const purpose = ref<Purpose>("verify_email");

const email = ref("");
const password = ref("");
const displayName = ref("");
const code = ref("");
const showPassword = ref(false);

const busy = ref(false);
const error = ref("");
const notice = ref("");

const heading = computed(() => {
  if (step.value === "forgot") return "Reset your password";
  if (step.value === "code") {
    return purpose.value === "reset_password" ? "Check your email" : "Confirm your email";
  }
  return mode.value === "register" ? "Create your account" : "Welcome back";
});

const subheading = computed(() => {
  if (step.value === "forgot") return "We'll email you a code to set a new one.";
  if (step.value === "code") return `We sent a 6-digit code to ${email.value}.`;
  return mode.value === "register"
    ? "Buy, sell and track your collection."
    : "Sign in to pick up where you left off.";
});

// ── Resend cooldown ───────────────────────────────────────────────
// The server rate-limits properly; this only stops someone hammering the
// button before the first email has had time to land.
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

// Only digits, and never more than six — pasting "123 456" should just work.
watch(code, (v) => {
  const digits = v.replace(/\D/g, "").slice(0, 6);
  if (digits !== v) code.value = digits;
});

const clear = () => {
  error.value = "";
  notice.value = "";
};

const run = async (fn: () => Promise<void>) => {
  if (busy.value) return;
  clear();
  busy.value = true;
  try {
    await fn();
  } catch (e: any) {
    error.value = e?.data?.message || authMessage(e);
  } finally {
    busy.value = false;
  }
};

/** Where to land once they're in. Falls back to the collection. */
const destination = () => (route.query.next as string) || "/collection";

const submitCredentials = () =>
  run(async () => {
    if (!email.value.trim() || !password.value) {
      error.value = "Enter your email and password.";
      return;
    }
    if (mode.value === "register") {
      if (password.value.length < MIN_PASSWORD) {
        error.value = `Use at least ${MIN_PASSWORD} characters.`;
        return;
      }
      await registerWithEmail(email.value, password.value, displayName.value);
      purpose.value = "verify_email";
      step.value = "code";
      startCooldown();
      return;
    }
    await signInWithEmail(email.value, password.value);
    await navigateTo(destination());
  });

const submitCode = () =>
  run(async () => {
    if (purpose.value === "reset_password") {
      if (password.value.length < MIN_PASSWORD) {
        error.value = `Use at least ${MIN_PASSWORD} characters.`;
        return;
      }
      await resetPassword(email.value, code.value, password.value);
      // Straight in — they just proved the address and set the password, so
      // making them type it again is friction with no security value.
      await signInWithEmail(email.value, password.value);
      await navigateTo(destination());
      return;
    }
    await confirmEmail(email.value, code.value);
    await navigateTo(destination());
  });

const submitForgot = () =>
  run(async () => {
    if (!email.value.trim()) {
      error.value = "Enter your email address.";
      return;
    }
    await requestCode(email.value, "reset_password");
    purpose.value = "reset_password";
    password.value = "";
    code.value = "";
    step.value = "code";
    startCooldown();
  });

const resend = () =>
  run(async () => {
    const res = await requestCode(email.value, purpose.value);
    notice.value = res.message;
    startCooldown();
  });

const withGoogle = () =>
  run(async () => {
    await signInWithGoogle();
    await navigateTo(destination());
  });

const toggleMode = () => {
  clear();
  mode.value = mode.value === "register" ? "signin" : "register";
};

const goToForgot = () => {
  clear();
  password.value = "";
  step.value = "forgot";
};

const backToStart = () => {
  clear();
  code.value = "";
  password.value = "";
  step.value = "credentials";
  mode.value = "signin";
};

// Already signed in and verified? Nothing to do here.
watch(
  user,
  (u) => {
    if (u && step.value === "credentials") navigateTo(destination());
  },
  { immediate: true },
);
</script>

<style scoped>
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
.btn-secondary {
  @apply w-full inline-flex items-center justify-center gap-2 rounded-xl
         border border-black/[0.10] dark:border-white/[0.12] px-4 py-2.5
         text-sm font-semibold text-ink dark:text-white transition-colors
         hover:bg-black/[0.03] dark:hover:bg-white/[0.05]
         disabled:opacity-50 disabled:cursor-not-allowed;
}
.spinner {
  @apply h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white;
}
</style>
