<template>
  <div class="sl-page sl-page--narrow">
    <SellerGate v-if="!user" message="Sign in to manage your seller settings." />

    <template v-else>
      <SellerPageHead title="Settings">
        <template #description>
          Your seller details, and how your shop ships and gets paid. Your buyer
          profile lives under
          <NuxtLink :to="`/profile/${user.uid}`" class="underline underline-offset-2">your profile</NuxtLink>.
        </template>
      </SellerPageHead>

      <!-- Status first: is the shop ready, and is the seller verified. -->
      <section>
        <h2 class="mc-h2 mb-2.5">Shop status</h2>
        <div class="mc-card">
          <div class="st-row">
            <div class="min-w-0">
              <p class="st-title flex items-center gap-2">
                <span class="mc-dot" :data-tone="sellerReady ? 'good' : 'warn'" aria-hidden="true" />
                {{ sellerReady ? "Ready to sell" : "Setup not finished" }}
              </p>
              <p class="mc-meta mt-0.5">
                {{ sellerReady ? "Your shop is set up." : `Still to do: ${missing.join(", ")}.` }}
              </p>
            </div>
            <NuxtLink v-if="!sellerReady" to="/seller/onboarding" class="mc-btn mc-btn-sm mc-btn-primary">
              Finish setup
            </NuxtLink>
          </div>
          <div class="st-row">
            <div class="min-w-0 w-full">
              <p class="st-title">Identity</p>
              <p v-if="identityVerified" class="mc-meta mt-0.5">
                Verified with your MyKad<span v-if="profile?.kycVerifiedName"> as {{ profile.kycVerifiedName }}</span>.
              </p>
              <KycVerifyCard v-else class="mt-2" />
            </div>
          </div>
        </div>
      </section>

      <section class="mc-section">
        <h2 class="mc-h2 mb-2.5">Shop details</h2>
        <div class="mc-card">
          <div id="seller-type" class="st-row st-row--block">
            <div class="st-row-head">
              <div class="min-w-0">
                <p class="st-title">Who buyers see</p>
                <p class="mc-meta mt-0.5">Shown as the seller on your listings and auctions.</p>
              </div>
              <button v-if="editing !== 'seller'" type="button" class="mc-btn mc-btn-sm" @click="editing = 'seller'">
                {{ disclosure ? "Edit" : "Add" }}
              </button>
            </div>
            <SellerDisclosureForm
              v-if="editing === 'seller'"
              class="mt-4"
              submit-label="Save"
              cancellable
              :current="disclosure"
              @saved="(d) => { disclosure = d; editing = null; }"
              @cancel="editing = null"
            />
            <div v-else-if="disclosure" class="st-value">
              <p>{{ disclosure.name }}</p>
              <p class="mc-meta mc-num">
                {{ disclosure.type === "business" ? `Registered business · SSM ${disclosure.ssmNumber}` : "Individual seller" }}
              </p>
            </div>
          </div>

          <div id="pickup" class="st-row st-row--block">
            <div class="st-row-head">
              <div class="min-w-0">
                <p class="st-title">Contact and pickup</p>
                <p class="mc-meta mt-0.5">Where couriers collect your parcels. Also used to quote shipping.</p>
              </div>
              <button v-if="editing !== 'contact'" type="button" class="mc-btn mc-btn-sm" @click="editing = 'contact'">
                {{ pickupLine ? "Edit" : "Add" }}
              </button>
            </div>
            <SellerContactForm
              v-if="editing === 'contact'"
              class="mt-4"
              submit-label="Save"
              cancellable
              @saved="editing = null"
              @cancel="editing = null"
            />
            <div v-else-if="pickupLine" class="st-value">
              <p>{{ pickupLine }}</p>
              <p v-if="contactNumber" class="mc-meta mc-num">{{ contactNumber }}</p>
            </div>
            <p v-if="editing !== 'contact' && contactGaps.length" class="mc-callout mt-3">
              Add your {{ joinWords(contactGaps) }} to finish setup.
            </p>
          </div>

          <div id="bank" class="st-row st-row--block">
            <div class="st-row-head">
              <div class="min-w-0">
                <p class="st-title">Bank account</p>
                <p class="mc-meta mt-0.5">Where your online sales are paid out.</p>
              </div>
              <button v-if="editing !== 'bank'" type="button" class="mc-btn mc-btn-sm" @click="editing = 'bank'">
                {{ bankLine ? "Edit" : "Add" }}
              </button>
            </div>
            <SellerBankForm
              v-if="editing === 'bank'"
              class="mt-4"
              submit-label="Save"
              cancellable
              @saved="editing = null"
              @cancel="editing = null"
            />
            <p v-else-if="bankLine" class="st-value mc-num">{{ bankLine }}</p>
          </div>

          <!-- The shop's own QR for counter (POS) payments -->
          <SellerPaymentQr id="payment-qr" class="st-row st-row--block scroll-mt-24" />
        </div>
      </section>

      <section class="mc-section">
        <h2 class="mc-h2 mb-2.5">Shipping</h2>
        <div class="mc-card">
          <div class="st-row st-row--block">
            <p class="st-title">Parcel handover</p>
            <p class="mc-meta mt-0.5 mb-3">
              The cheapest couriers are drop-off only. Pick collection and we'll
              quote buyers the cheaper pickup services instead.
            </p>
            <div class="mc-seg" role="group" aria-label="Parcel handover">
              <button
                v-for="opt in HANDOVER_OPTIONS"
                :key="opt.value"
                type="button"
                :aria-pressed="handover === opt.value"
                :disabled="savingHandover"
                @click="setHandover(opt.value)"
              >
                {{ opt.label }}
              </button>
            </div>
          </div>

          <div class="st-row st-row--block">
            <p class="st-title">Preferred couriers</p>
            <p class="mc-meta mt-0.5 mb-3">
              We use the cheapest of these that serves the buyer's address. If
              none do, we fall back to the cheapest available rather than block
              the sale. Pick none to always take the cheapest.
            </p>
            <p v-if="couriersLoading" class="mc-small">Loading couriers…</p>
            <p v-else-if="courierNotice" class="mc-callout">{{ courierNotice }}</p>
            <div v-else class="flex flex-wrap gap-2">
              <button
                v-for="c in availableCouriers"
                :key="c"
                type="button"
                class="mc-tag st-chip"
                :aria-pressed="preferredCouriers.includes(c)"
                :disabled="savingCouriers"
                @click="toggleCourier(c)"
              >
                <svg v-if="preferredCouriers.includes(c)" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                {{ c }}
              </button>
            </div>
            <p v-if="!couriersLoading && !courierNotice && !preferredCouriers.length" class="mc-small mt-2">
              None selected, so we always use the cheapest available.
            </p>
          </div>
        </div>
      </section>

      <section class="mc-section">
        <h2 class="mc-h2 mb-2.5 flex items-center gap-2">
          Staff
          <span class="mc-tag">Coming soon</span>
        </h2>
        <div class="mc-card mc-empty flex items-center justify-between gap-3">
          <span>Invite staff to help manage listings, orders and shipments for you.</span>
          <button type="button" class="mc-btn mc-btn-sm" disabled>Invite staff</button>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { stateName } from "~/shared/my-states";
import { isKycVerified } from "~/shared/didit";
import { bankName, resolveBankCode } from "~/shared/banks";
import { joinWords, missingSellerContact } from "~/shared/onboarding";
import type { SellerDisclosure } from "~/shared/seller-disclosure";

definePageMeta({ layout: "seller" });
useHead({ title: "Seller · Settings | TCGo" });

const {user} = useAuth();
const { profile, updateProfile } = useMyProfile();
const { sellerReady, missing } = useSellerKyc();
const route = useRoute();

// One section open at a time. A link to #bank or #pickup (Funds, the listing
// pages) opens that section straight away.
const editing = ref<"seller" | "contact" | "bank" | null>(null);
watch(
  () => route.hash,
  (hash) => {
    if (hash === "#bank") editing.value = "bank";
    if (hash === "#pickup") editing.value = "contact";
    if (hash === "#seller-type") editing.value = "seller";
  },
  { immediate: true },
);

const identityVerified = computed(() => isKycVerified(profile.value?.kycStatus as any));
const contactNumber = computed(() => profile.value?.phone || profile.value?.whatsappNumber || "");
// The address line above can show while the step is still undone (no number,
// city or state), so say exactly what's left.
const contactGaps = computed(() => missingSellerContact(profile.value));
const bankLine = computed(() => {
  const p = profile.value;
  if (!p?.bankAccountNumber) return "";
  const name = bankName(resolveBankCode(p.bankCode, p.bankName)) || p.bankName || "";
  return `${name} ••••${p.bankAccountNumber.slice(-4)}${p.bankAccountHolder ? ` · ${p.bankAccountHolder}` : ""}`;
});
const { authedFetch } = useAuthedFetch();

// What buyers see as the seller. Read from the public endpoint so this shows
// exactly what a listing shows.
const disclosure = ref<SellerDisclosure | null>(null);
watch(
  () => user.value?.uid,
  async (uid) => {
    if (!uid) return;
    try {
      disclosure.value = await $fetch<SellerDisclosure | null>(`/api/sellers/${uid}/disclosure`);
    } catch {}
  },
  { immediate: true },
);

// ── Handover preference ───────────────────────────────────────────────
const HANDOVER_OPTIONS = [
  { value: "dropoff" as const, label: "I drop off" },
  { value: "pickup" as const, label: "Courier collects" },
];
const handover = ref<"dropoff" | "pickup">("dropoff");
const savingHandover = ref(false);

watch(
  profile,
  (p) => {
    if (p) handover.value = p.handoverPreference === "pickup" ? "pickup" : "dropoff";
  },
  { immediate: true },
);

const setHandover = async (value: "dropoff" | "pickup") => {
  if (handover.value === value || savingHandover.value) return;
  const previous = handover.value;
  handover.value = value; // optimistic
  savingHandover.value = true;
  try {
    await updateProfile({ handoverPreference: value });
  } catch {
    handover.value = previous;
  } finally {
    savingHandover.value = false;
  }
};

// ── Preferred couriers ────────────────────────────────────────────────
// The list comes from Delyva, quoted against this seller's own pickup
// address, so it only offers couriers that actually serve them.
const availableCouriers = ref<string[]>([]);
const preferredCouriers = ref<string[]>([]);
const couriersLoading = ref(false);
const courierNotice = ref("");
const savingCouriers = ref(false);

const loadCouriers = async () => {
  if (!user.value || couriersLoading.value) return;
  couriersLoading.value = true;
  courierNotice.value = "";
  try {
    const res = await authedFetch<{
      available: string[];
      selected?: string[];
      reason?: string;
    }>("/api/shipping/couriers");
    availableCouriers.value = res.available || [];
    preferredCouriers.value = res.selected || [];
    if (!availableCouriers.value.length) {
      courierNotice.value =
        res.reason || "No couriers available from your pickup address yet.";
    }
  } catch (e: any) {
    courierNotice.value = e?.data?.message || "Couldn't load couriers.";
  } finally {
    couriersLoading.value = false;
  }
};

watch(user, (u) => { if (u) void loadCouriers(); }, { immediate: true });

const toggleCourier = async (courier: string) => {
  if (savingCouriers.value) return;
  const before = [...preferredCouriers.value];
  preferredCouriers.value = before.includes(courier)
    ? before.filter((c) => c !== courier)
    : [...before, courier];
  savingCouriers.value = true;
  try {
    await updateProfile({ preferredCouriers: preferredCouriers.value });
  } catch {
    preferredCouriers.value = before;
  } finally {
    savingCouriers.value = false;
  }
};

const pickupLine = computed(() => {
  const p = profile.value;
  if (!p?.pickupAddress1 || !p?.pickupPostcode) return "";
  return [
    p.pickupAddress1,
    p.pickupAddress2,
    `${p.pickupPostcode} ${p.pickupCity || ""}`.trim(),
    stateName(p.pickupState),
  ]
    .filter(Boolean)
    .join(", ");
});
</script>

<style>
.st-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
}
.st-row + .st-row {
  border-top: 1px solid var(--line);
}
.st-row--block {
  display: block;
}
.st-row-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.st-title {
  font-size: 14px;
  font-weight: 600;
}
.st-value {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-s);
  background: var(--surface-2);
  font-size: 13.5px;
}
.st-chip {
  height: 28px;
  padding: 0 11px;
  gap: 5px;
  font-weight: 550;
  transition:
    background-color 120ms ease,
    border-color 120ms ease,
    transform 140ms var(--ease-out);
}
.st-chip:active {
  transform: scale(0.94);
}
.st-chip[aria-pressed="true"] {
  background: var(--accent-soft);
  border-color: color-mix(in srgb, var(--accent) 45%, transparent);
  color: var(--ink);
}
.st-chip:disabled {
  opacity: 0.5;
}
</style>
