<template>
  <div ref="root" class="surface rounded-3xl p-5 sm:p-7">
    <!-- Terminal header -->
    <div class="flex items-center justify-between gap-3 pb-4 border-b border-black/[0.06]">
      <div class="flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-emerald-500" />
        <p class="text-xs font-semibold text-ink">Counter · Till 1</p>
      </div>
      <span class="chip">No card reader needed</span>
    </div>

    <!-- Scan → line item -->
    <div class="py-4 space-y-2">
      <div
        v-for="(line, i) in lines"
        :key="line.name"
        :ref="(el) => (rows[i] = el as HTMLElement)"
        class="flex items-center gap-3"
      >
        <div class="w-7 h-7 shrink-0 rounded-md bg-canvas-sunken flex items-center justify-center">
          <svg class="w-3.5 h-3.5 text-ink-soft" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
            <line x1="3" y1="12" x2="21" y2="12" />
          </svg>
        </div>
        <p class="flex-1 min-w-0 text-xs text-ink truncate">{{ line.name }}</p>
        <p class="text-xs font-semibold text-ink tabular-price">RM {{ line.price }}</p>
      </div>
    </div>

    <!-- Total + tender -->
    <div class="pt-4 border-t border-black/[0.06]">
      <div class="flex items-baseline justify-between">
        <p class="text-xs text-ink-muted">Total</p>
        <p ref="total" class="text-2xl font-bold text-ink tabular-price">RM 0</p>
      </div>

      <div class="mt-4 grid grid-cols-2 gap-2">
        <div
          ref="qrBtn"
          class="rounded-xl border border-black/[0.08] bg-canvas-sunken p-2.5 text-center"
        >
          <svg class="w-4 h-4 mx-auto text-ink" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <path d="M14 14h3v3h-3zM19 19h2M17 21h4" />
          </svg>
          <p class="mt-1.5 text-[10px] font-semibold text-ink">Your QR</p>
        </div>
        <div
          ref="tapBtn"
          class="rounded-xl border border-black/[0.08] bg-canvas-sunken p-2.5 text-center"
        >
          <svg class="w-4 h-4 mx-auto text-ink" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 8.5a8 8 0 0 1 0 7M9.5 5.5a13 13 0 0 1 0 13" />
            <rect x="12" y="4" width="9" height="16" rx="2" />
          </svg>
          <p class="mt-1.5 text-[10px] font-semibold text-ink">Tap to pay*</p>
        </div>
      </div>

      <div
        ref="paid"
        class="mt-3 rounded-lg bg-emerald-500/10 py-2 text-center opacity-0"
      >
        <p class="text-[11px] font-bold text-emerald-700">Paid · receipt sent</p>
      </div>

      <p class="mt-3 text-[10px] text-ink-soft text-center">
        *Tap-to-pay carries an additional charge
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
const lines = [
  { name: "Charizard ex · 199/165", price: "245" },
  { name: "Pikachu VMAX · 044/185", price: "88" },
];

const root = ref<HTMLElement>();
const rows = ref<HTMLElement[]>([]);
const total = ref<HTMLElement>();
const qrBtn = ref<HTMLElement>();
const tapBtn = ref<HTMLElement>();
const paid = ref<HTMLElement>();

useReveal(root, ({ gsap, reduced, root: el }) => {
  if (reduced) {
    total.value!.textContent = "RM 333";
    gsap.set(paid.value!, { opacity: 1 });
    return;
  }

  const running = { v: 0 };
  const tl = gsap.timeline({
    repeat: -1,
    repeatDelay: 2,
    scrollTrigger: { trigger: el, start: "top 80%" },
  });

  // Cards scan in one at a time, the total climbs with them, then payment
  // lands — the whole counter sale in one loop.
  tl.set(rows.value, { opacity: 0, x: -8 })
    .set(total.value!, { textContent: "RM 0" })
    .set(paid.value!, { opacity: 0 })
    .to(rows.value, { opacity: 1, x: 0, duration: 0.4, stagger: 0.5 })
    .to(
      running,
      {
        v: 333,
        duration: 1.2,
        ease: "power2.out",
        onUpdate: () => {
          total.value!.textContent = `RM ${Math.round(running.v)}`;
        },
      },
      "-=0.8",
    )
    .to(qrBtn.value!, { borderColor: "#E3350D", duration: 0.25 }, "+=0.2")
    .to(paid.value!, { opacity: 1, duration: 0.35 }, "+=0.2")
    .to(qrBtn.value!, { borderColor: "rgba(0,0,0,0.08)", duration: 0.4 }, "+=1.2")
    .set(running, { v: 0 });
});
</script>
