<template>
  <div ref="root" class="surface rounded-3xl p-5 sm:p-7">
    <!-- Shared item header -->
    <div class="flex items-center justify-between gap-3 pb-5 border-b border-black/[0.06]">
      <div class="min-w-0">
        <p class="text-sm font-semibold text-ink truncate">Charizard ex</p>
        <p class="text-xs text-ink-soft tabular-price">199/165 · Near Mint</p>
      </div>
      <span
        ref="syncChip"
        class="chip chip-accent shrink-0 flex items-center gap-1.5"
      >
        <span class="w-1.5 h-1.5 rounded-full bg-pokemon-red" />
        Synced
      </span>
    </div>

    <!-- Two channels, one ledger. items-stretch (not items-center) so the two
         panels are always the same height and their rows line up across the
         connector — that visual rhyme is the whole point of the graphic. -->
    <div class="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2 sm:gap-3 py-6">
      <!-- Counter / POS -->
      <div
        ref="posPanel"
        class="flex flex-col rounded-2xl border border-black/[0.07] bg-canvas-sunken p-3 sm:p-4"
      >
        <p class="eyebrow !text-[9px] !tracking-[0.14em]">In-store</p>
        <p class="mt-2 text-xs text-ink-muted">Counter sale</p>
        <p class="mt-1 text-lg font-bold text-ink tabular-price">RM 245</p>
        <!-- border-transparent so this button occupies exactly the same box as
             the bordered "Listed" button opposite it. -->
        <div
          ref="chargeBtn"
          class="mt-3 rounded-lg border border-transparent bg-ink text-white text-[11px] font-semibold text-center py-2"
        >
          Charge
        </div>
      </div>

      <!-- Connector -->
      <div
        class="relative self-center w-10 sm:w-16 h-px bg-black/[0.12]"
        aria-hidden="true"
      >
        <div
          ref="pulse"
          class="absolute inset-y-0 left-0 w-full origin-left bg-pokemon-red"
          style="transform: scaleX(0)"
        />
        <div
          ref="pulseDot"
          class="absolute -top-[3px] left-0 w-[7px] h-[7px] rounded-full bg-pokemon-red opacity-0"
        />
      </div>

      <!-- Online -->
      <div
        ref="onlinePanel"
        class="flex flex-col rounded-2xl border border-black/[0.07] bg-canvas-sunken p-3 sm:p-4"
      >
        <p class="eyebrow !text-[9px] !tracking-[0.14em]">Online</p>
        <p class="mt-2 text-xs text-ink-muted">tcgo.shop</p>
        <p class="mt-1 text-lg font-bold text-ink tabular-price">RM 245</p>
        <div
          class="mt-3 rounded-lg border border-black/[0.08] bg-white text-ink-muted text-[11px] font-semibold text-center py-2"
        >
          Listed
        </div>
      </div>
    </div>

    <!-- The point: one number, both channels -->
    <div
      class="flex items-center justify-between gap-3 pt-5 border-t border-black/[0.06]"
    >
      <p class="text-xs text-ink-muted">One stock ledger</p>
      <p class="flex items-baseline gap-1.5">
        <span
          ref="stockNum"
          class="text-2xl font-bold text-ink tabular-price leading-none"
          >12</span
        >
        <span class="text-xs text-ink-soft">in stock</span>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
const root = ref<HTMLElement>();
const posPanel = ref<HTMLElement>();
const onlinePanel = ref<HTMLElement>();
const chargeBtn = ref<HTMLElement>();
const pulse = ref<HTMLElement>();
const pulseDot = ref<HTMLElement>();
const stockNum = ref<HTMLElement>();
const syncChip = ref<HTMLElement>();

useReveal(root, ({ gsap, reduced, root: el }) => {
  if (reduced) return;

  // A sale rings up at the counter and the online stock drops in the same
  // beat — the whole feature in four seconds. Loops so it still reads if the
  // user scrolls back up.
  const tl = gsap.timeline({
    repeat: -1,
    repeatDelay: 1.8,
    scrollTrigger: { trigger: el, start: "top 80%" },
  });

  tl.to(chargeBtn.value!, { scale: 0.95, duration: 0.12, ease: "power2.in" })
    .to(chargeBtn.value!, { scale: 1, duration: 0.25 })
    .fromTo(
      posPanel.value!,
      { boxShadow: "0 0 0 0px rgba(227,53,13,0)" },
      { boxShadow: "0 0 0 2px rgba(227,53,13,0.5)", duration: 0.3 },
      "<"
    )
    .to(pulse.value!, { scaleX: 1, duration: 0.5, ease: "power2.inOut" }, "-=0.1")
    .fromTo(
      pulseDot.value!,
      { opacity: 1, x: 0 },
      { x: "100%", duration: 0.5, ease: "power2.inOut" },
      "<"
    )
    .to(pulseDot.value!, { opacity: 0, duration: 0.15 })
    .fromTo(
      onlinePanel.value!,
      { boxShadow: "0 0 0 0px rgba(227,53,13,0)" },
      { boxShadow: "0 0 0 2px rgba(227,53,13,0.5)", duration: 0.3 },
      "<"
    )
    // Stock ticks down: old number up and out, new number up and in.
    .to(stockNum.value!, { y: -14, opacity: 0, duration: 0.2 }, "-=0.15")
    .set(stockNum.value!, { textContent: "11", y: 14 })
    .to(stockNum.value!, { y: 0, opacity: 1, duration: 0.3 })
    .fromTo(
      syncChip.value!,
      { scale: 1 },
      { scale: 1.08, duration: 0.18, yoyo: true, repeat: 1 },
      "<"
    )
    .to([posPanel.value!, onlinePanel.value!], {
      boxShadow: "0 0 0 0px rgba(227,53,13,0)",
      duration: 0.4,
    })
    // Reset for the next loop.
    .to(stockNum.value!, { opacity: 0, duration: 0.2 }, "+=1.2")
    .set(stockNum.value!, { textContent: "12" })
    .set(pulse.value!, { scaleX: 0 })
    .to(stockNum.value!, { opacity: 1, duration: 0.3 });
});
</script>
