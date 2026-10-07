<template>
  <Teleport to="body">
    <Transition name="lb" :duration="{ enter: 280, leave: 220 }">
      <div
        v-if="lightbox.open"
        class="lb-root"
        role="dialog"
        aria-modal="true"
        :aria-label="images.length > 1 ? `Photo ${index + 1} of ${images.length}` : 'Photo'"
      >
        <div ref="backdropEl" class="lb-backdrop" />

        <div
          ref="stageEl"
          class="lb-stage"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
          @wheel.prevent="onWheel"
          @contextmenu.prevent
        >
          <div class="lb-content">
            <div ref="trackEl" class="lb-track">
              <template v-for="(src, i) in images" :key="`${i}-${src}`">
                <div
                  v-if="Math.abs(i - index) <= 1"
                  class="lb-slide"
                  :style="{ transform: `translate3d(${i * (stage.w + GAP)}px,0,0)` }"
                >
                  <img
                    :ref="(el) => setImgEl(i, el as HTMLImageElement | null)"
                    :src="cdnUrl(src, 1600)"
                    :alt="images.length > 1 ? `Photo ${i + 1} of ${images.length}` : 'Photo'"
                    class="lb-img"
                    :style="fittedStyle(i)"
                    draggable="false"
                    @load="onImgLoad(i, $event)"
                  />
                </div>
              </template>
            </div>
          </div>
        </div>

        <!-- Controls: a tap on the photo hides them, like a phone's gallery. -->
        <div class="lb-chrome" :class="{ 'lb-chrome-hidden': !chrome }">
          <div class="lb-topbar">
            <button
              ref="closeBtn"
              type="button"
              class="lb-btn"
              aria-label="Close photo"
              @click="close"
            >
              <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
            <span v-if="images.length > 1" class="lb-counter" aria-hidden="true">{{ index + 1 }} / {{ images.length }}</span>
            <span class="w-11" aria-hidden="true" />
          </div>

          <template v-if="images.length > 1">
            <button
              v-if="index > 0"
              type="button"
              class="lb-btn lb-arrow left-4"
              aria-label="Previous photo"
              @click="goTo(index - 1)"
            >
              <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
            </button>
            <button
              v-if="index < images.length - 1"
              type="button"
              class="lb-btn lb-arrow right-4"
              aria-label="Next photo"
              @click="goTo(index + 1)"
            >
              <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
            </button>
          </template>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from "vue";
import { cdnUrl } from "~/composables/useStorage";

/*
 * Full-screen photo viewer with phone-gallery gestures, all on pointer
 * events so touch, pen and mouse share one path:
 *  - pinch (or trackpad pinch / wheel) zooms around the fingers or cursor
 *  - double-tap zooms in where you tapped, and back out
 *  - drag pans a zoomed photo, with a rubber band at the edges
 *  - swipe sideways for the next photo, down (or up) to close
 *  - the phone's back button closes it (it pushes a history entry)
 * Transforms are written straight to the elements during a gesture so
 * frames don't wait on Vue.
 */

const GAP = 16; // space between photos while swiping
const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;
const EASE = "cubic-bezier(0.32, 0.72, 0, 1)"; // iOS sheet curve
const DUR = 320;

const { lightbox, closeLightbox } = useLightbox();
const route = useRoute();

const images = computed(() => lightbox.value.images);
const index = ref(0);
const chrome = ref(true);
const stage = reactive({ w: 0, h: 0 });
const natural = reactive<Record<number, { w: number; h: number }>>({});

const stageEl = ref<HTMLElement | null>(null);
const trackEl = ref<HTMLElement | null>(null);
const backdropEl = ref<HTMLElement | null>(null);
const closeBtn = ref<HTMLButtonElement | null>(null);
const imgEls = new Map<number, HTMLImageElement>();
const setImgEl = (i: number, el: HTMLImageElement | null) => {
  if (el) imgEls.set(i, el);
  else imgEls.delete(i);
};

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const ease = (ms = DUR) => (reducedMotion() ? "none" : `transform ${ms}ms ${EASE}`);

// ── Sizing ─────────────────────────────────────────────────────────────
// Each photo is sized to fit the screen (small ones scale up too), so
// zoom and pan bounds come straight from that fitted box.
const fitted = (i: number) => {
  const n = natural[i];
  if (!n || !stage.w) return { w: stage.w, h: stage.h };
  const r = Math.min(stage.w / n.w, stage.h / n.h);
  return { w: n.w * r, h: n.h * r };
};
const fittedStyle = (i: number) => {
  const n = natural[i];
  if (!n || !stage.w) return { maxWidth: "100%", maxHeight: "100%" };
  const f = fitted(i);
  return { width: `${f.w}px`, height: `${f.h}px` };
};
const onImgLoad = (i: number, e: Event) => {
  const img = e.target as HTMLImageElement;
  natural[i] = { w: img.naturalWidth || 1, h: img.naturalHeight || 1 };
};
const measure = () => {
  stage.w = window.innerWidth;
  stage.h = window.innerHeight;
};

// ── Current photo's zoom ───────────────────────────────────────────────
let scale = 1;
let tx = 0;
let ty = 0;

const bounds = (s: number) => {
  const f = fitted(index.value);
  return { x: Math.max(0, (f.w * s - stage.w) / 2), y: Math.max(0, (f.h * s - stage.h) / 2) };
};
const clamp = (v: number, m: number) => Math.min(m, Math.max(-m, v));
const rubber = (v: number, m: number) => {
  const over = Math.abs(v) - m;
  return over <= 0 ? v : Math.sign(v) * (m + over * 0.35);
};

const paintImage = (transition = "none") => {
  const el = imgEls.get(index.value);
  if (!el) return;
  el.style.transition = transition;
  el.style.transform = `translate3d(${tx}px,${ty}px,0) scale(${scale})`;
};
const paintTrack = (dx = 0, transition = "none") => {
  if (!trackEl.value) return;
  trackEl.value.style.transition = transition;
  trackEl.value.style.transform = `translate3d(${-index.value * (stage.w + GAP) + dx}px,0,0)`;
};
const paintBackdrop = (opacity: number, transition = "none") => {
  if (!backdropEl.value) return;
  backdropEl.value.style.transition = transition === "none" ? "none" : `opacity ${DUR}ms ${EASE}`;
  backdropEl.value.style.opacity = String(opacity);
};

const resetZoom = () => {
  scale = 1;
  tx = 0;
  ty = 0;
};

/** Snap back inside the limits after a gesture lets go. */
const settle = (ms = DUR) => {
  if (scale <= 1) resetZoom();
  else {
    scale = Math.min(scale, MAX_SCALE);
    const b = bounds(scale);
    tx = clamp(tx, b.x);
    ty = clamp(ty, b.y);
  }
  paintImage(ease(ms));
};

/** Zoom to `s`, keeping the screen point (relative to the centre) still. */
const zoomAround = (s: number, mx: number, my: number, transition = "none") => {
  const cx = (mx - tx) / scale;
  const cy = (my - ty) / scale;
  scale = s;
  tx = mx - s * cx;
  ty = my - s * cy;
  if (scale <= 1) resetZoom();
  const b = bounds(scale);
  tx = clamp(tx, b.x);
  ty = clamp(ty, b.y);
  paintImage(transition);
};

const goTo = (i: number) => {
  if (i < 0 || i >= images.value.length) {
    paintTrack(0, ease());
    return;
  }
  if (i !== index.value) {
    resetZoom();
    paintImage();
    index.value = i;
    lightbox.value.index = i;
  }
  paintTrack(0, ease());
};

// ── Pointer gestures ───────────────────────────────────────────────────
type Gesture = "pending" | "pan" | "swipe" | "dismiss" | "pinch" | null;
const pointers = new Map<number, { x: number; y: number }>();
let gesture: Gesture = null;
let start = { x: 0, y: 0, tx: 0, ty: 0 };
let pinch = { dist: 1, scale: 1, cx: 0, cy: 0 };
let vel = { x: 0, y: 0, lx: 0, ly: 0, lt: 0 };
let lastTap = { x: 0, y: 0, t: 0 };
let tapTimer: ReturnType<typeof setTimeout> | null = null;

const centre = () => ({ x: stage.w / 2, y: stage.h / 2 });
const twoPoints = () => [...pointers.values()].slice(0, 2);

const beginPinch = () => {
  const [a, b] = twoPoints();
  const c = centre();
  const mx = (a.x + b.x) / 2 - c.x;
  const my = (a.y + b.y) / 2 - c.y;
  gesture = "pinch";
  if (tapTimer) clearTimeout(tapTimer);
  paintTrack(0, ease()); // abandon a half swipe
  pinch = {
    dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
    scale,
    cx: (mx - tx) / scale,
    cy: (my - ty) / scale,
  };
};

const beginSingle = (p: { x: number; y: number }) => {
  start = { x: p.x, y: p.y, tx, ty };
  vel = { x: 0, y: 0, lx: p.x, ly: p.y, lt: performance.now() };
  gesture = scale > 1.01 ? "pan" : "pending";
};

const onPointerDown = (e: PointerEvent) => {
  if (e.pointerType === "mouse" && e.button !== 0) return;
  stageEl.value?.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) beginPinch();
  else if (pointers.size === 1) beginSingle({ x: e.clientX, y: e.clientY });
};

const onPointerMove = (e: PointerEvent) => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (gesture === "pinch" && pointers.size >= 2) {
    const [a, b] = twoPoints();
    const c = centre();
    const mx = (a.x + b.x) / 2 - c.x;
    const my = (a.y + b.y) / 2 - c.y;
    let s = (pinch.scale * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.dist;
    if (s > MAX_SCALE) s = MAX_SCALE + (s - MAX_SCALE) * 0.3;
    if (s < 1) s = Math.max(0.6, 1 - (1 - s) * 0.5);
    scale = s;
    tx = mx - s * pinch.cx;
    ty = my - s * pinch.cy;
    paintImage();
    return;
  }

  const now = performance.now();
  const dt = Math.max(1, now - vel.lt);
  vel = {
    x: 0.8 * ((e.clientX - vel.lx) / dt) + 0.2 * vel.x,
    y: 0.8 * ((e.clientY - vel.ly) / dt) + 0.2 * vel.y,
    lx: e.clientX,
    ly: e.clientY,
    lt: now,
  };
  const dx = e.clientX - start.x;
  const dy = e.clientY - start.y;

  if (gesture === "pending") {
    if (Math.hypot(dx, dy) < 8) return;
    if (tapTimer) clearTimeout(tapTimer);
    gesture = Math.abs(dx) > Math.abs(dy) && images.value.length > 1 ? "swipe" : "dismiss";
  }

  if (gesture === "pan") {
    const b = bounds(scale);
    tx = rubber(start.tx + dx, b.x);
    ty = rubber(start.ty + dy, b.y);
    paintImage();
  } else if (gesture === "swipe") {
    const atEdge = (dx > 0 && index.value === 0) || (dx < 0 && index.value === images.value.length - 1);
    paintTrack(atEdge ? dx * 0.35 : dx);
  } else if (gesture === "dismiss") {
    const p = Math.min(1, Math.abs(dy) / (stage.h * 0.5));
    tx = dx;
    ty = dy;
    scale = 1 - p * 0.25;
    paintImage();
    paintBackdrop(1 - p * 0.85);
    chrome.value = p < 0.05 && chrome.value;
  }
};

const onTap = (e: PointerEvent) => {
  const now = performance.now();
  const c = centre();
  if (now - lastTap.t < 300 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 40) {
    if (tapTimer) clearTimeout(tapTimer);
    lastTap.t = 0;
    if (scale > 1.01) {
      resetZoom();
      paintImage(ease());
    } else {
      zoomAround(DOUBLE_TAP_SCALE, e.clientX - c.x, e.clientY - c.y, ease());
    }
    return;
  }
  lastTap = { x: e.clientX, y: e.clientY, t: now };
  const isMouse = e.pointerType === "mouse";
  const f = fitted(index.value);
  const outside =
    scale <= 1.01 &&
    (Math.abs(e.clientX - c.x) > f.w / 2 || Math.abs(e.clientY - c.y) > f.h / 2);
  tapTimer = setTimeout(() => {
    // A mouse click beside the photo closes it; a finger tap toggles the controls.
    if (isMouse && outside) close();
    else if (!isMouse) chrome.value = !chrome.value;
  }, 300);
};

const onPointerUp = (e: PointerEvent) => {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);

  if (gesture === "pinch") {
    if (pointers.size === 1) {
      // One finger stays down: carry on as a pan from where it is.
      const [p] = [...pointers.values()];
      beginSingle(p);
      gesture = "pan";
    } else if (pointers.size === 0) {
      gesture = null;
      settle();
    }
    return;
  }
  if (pointers.size > 0) return;

  const dx = e.clientX - start.x;
  const dy = e.clientY - start.y;
  const g = gesture;
  gesture = null;
  // A finger that stopped before lifting has no fling.
  const stale = performance.now() - vel.lt > 80;
  const vx = stale ? 0 : vel.x;
  const vy = stale ? 0 : vel.y;

  // A zoomed photo starts every touch as a pan; one that never moved is a tap.
  if (g === "pending" || (g === "pan" && Math.hypot(dx, dy) < 8)) {
    if (g === "pan") settle();
    onTap(e);
  }
  else if (g === "swipe") {
    if (dx < -stage.w * 0.2 || vx < -0.45) goTo(index.value + 1);
    else if (dx > stage.w * 0.2 || vx > 0.45) goTo(index.value - 1);
    else goTo(index.value);
  } else if (g === "dismiss") {
    if (Math.abs(dy) > 110 || Math.abs(vy) > 0.6) close();
    else {
      resetZoom();
      paintImage(ease());
      paintBackdrop(1, "ease");
      chrome.value = true;
    }
  } else if (g === "pan") {
    // Let a flick glide on a little, then rest inside the edges.
    tx += vx * 160;
    ty += vy * 160;
    settle(420);
  }
};

const onWheel = (e: WheelEvent) => {
  // Trackpad pinches arrive as wheel events with ctrlKey set.
  const c = centre();
  const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0025));
  zoomAround(Math.min(MAX_SCALE, Math.max(1, scale * factor)), e.clientX - c.x, e.clientY - c.y);
};

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === "Escape") {
    e.preventDefault();
    close();
  } else if (e.key === "ArrowLeft") goTo(index.value - 1);
  else if (e.key === "ArrowRight") goTo(index.value + 1);
  else if (e.key === "Tab") {
    // Keep focus inside the viewer.
    const btns = [...(document.querySelectorAll(".lb-chrome button") as NodeListOf<HTMLElement>)];
    if (!btns.length) return;
    const i = btns.indexOf(document.activeElement as HTMLElement);
    const next = e.shiftKey ? (i <= 0 ? btns.length - 1 : i - 1) : (i + 1) % btns.length;
    e.preventDefault();
    btns[next].focus();
  }
};

// ── Open / close, history, scroll lock ─────────────────────────────────
let returnFocus: HTMLElement | null = null;
let pushedHistory = false;

const close = () => {
  if (!lightbox.value.open) return;
  // Let the closing fade run from wherever a drag left the backdrop.
  if (backdropEl.value) backdropEl.value.style.transition = "";
  closeLightbox();
};

const onPopState = () => {
  // The phone's back button: close instead of leaving the page.
  if (pushedHistory) {
    pushedHistory = false;
    close();
  }
};

const onOpen = async () => {
  index.value = lightbox.value.index;
  chrome.value = true;
  resetZoom();
  for (const k of Object.keys(natural)) delete natural[Number(k)];
  measure();
  returnFocus = document.activeElement as HTMLElement | null;
  document.documentElement.classList.add("lb-open");
  window.addEventListener("resize", onResize);
  window.addEventListener("popstate", onPopState);
  // Same URL and the router's own state, so the router sees no navigation.
  history.pushState({ ...history.state, lightbox: true }, "");
  pushedHistory = true;
  window.addEventListener("keydown", onKeydown);
  await nextTick();
  paintTrack();
  closeBtn.value?.focus({ preventScroll: true });
};

const onClose = () => {
  pointers.clear();
  gesture = null;
  if (tapTimer) clearTimeout(tapTimer);
  document.documentElement.classList.remove("lb-open");
  window.removeEventListener("resize", onResize);
  window.removeEventListener("popstate", onPopState);
  window.removeEventListener("keydown", onKeydown);
  if (pushedHistory) {
    pushedHistory = false;
    history.back();
  }
  returnFocus?.focus({ preventScroll: true });
  returnFocus = null;
};

const onResize = () => {
  measure();
  resetZoom();
  paintImage();
  paintTrack();
};

watch(
  () => lightbox.value.open,
  (open) => (open ? onOpen() : onClose()),
);

// Leaving the page some other way closes the viewer without going back.
watch(
  () => route.fullPath,
  () => {
    if (!lightbox.value.open) return;
    pushedHistory = false;
    closeLightbox();
  },
);

onBeforeUnmount(() => {
  if (lightbox.value.open) closeLightbox();
  document.documentElement.classList.remove("lb-open");
  window.removeEventListener("resize", onResize);
  window.removeEventListener("popstate", onPopState);
  window.removeEventListener("keydown", onKeydown);
});
</script>

<style>
/* Unscoped: the viewer is teleported to <body>. */
html.lb-open,
html.lb-open body {
  overflow: hidden;
}

.lb-root {
  position: fixed;
  inset: 0;
  z-index: 100; /* above the full-screen chat (55) and sheets (70s) */
  overscroll-behavior: contain;
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}
.lb-backdrop {
  position: absolute;
  inset: 0;
  background: #000;
}
.lb-stage {
  position: absolute;
  inset: 0;
  overflow: hidden;
  touch-action: none; /* every gesture here is ours */
}
.lb-content {
  position: absolute;
  inset: 0;
}
.lb-track {
  position: absolute;
  inset: 0;
  will-change: transform;
}
.lb-slide {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.lb-img {
  display: block;
  object-fit: contain;
  transform-origin: center center;
  will-change: transform;
  -webkit-user-drag: none;
}

.lb-chrome {
  position: absolute;
  inset: 0;
  pointer-events: none;
  transition: opacity 200ms ease-out;
}
.lb-chrome-hidden {
  opacity: 0;
}
.lb-chrome-hidden .lb-btn {
  pointer-events: none;
}
.lb-topbar {
  position: absolute;
  inset-inline: 0;
  top: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: max(8px, env(safe-area-inset-top)) max(8px, env(safe-area-inset-right)) 8px max(8px, env(safe-area-inset-left));
  background: linear-gradient(to bottom, rgb(0 0 0 / 0.45), transparent);
  color: #fff;
}
.lb-counter {
  font-size: 0.9375rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.lb-btn {
  pointer-events: auto;
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border-radius: 9999px;
  color: #fff;
  background: rgb(255 255 255 / 0.12);
  touch-action: manipulation;
  transition: transform 120ms ease-out, background-color 120ms ease-out;
}
.lb-btn:active {
  transform: scale(0.94);
}
@media (hover: hover) and (pointer: fine) {
  .lb-btn:hover {
    background: rgb(255 255 255 / 0.22);
  }
}
/* Side arrows are for mouse users; fingers swipe. */
.lb-arrow {
  position: absolute;
  top: 50%;
  margin-top: -22px;
  display: none;
}
@media (hover: hover) and (pointer: fine) {
  .lb-arrow {
    display: grid;
  }
}

/* Open: fade the black in and grow the photo slightly; close reverses it. */
.lb-enter-active .lb-backdrop,
.lb-enter-active .lb-chrome {
  transition: opacity 240ms ease-out;
}
.lb-enter-active .lb-content {
  transition: opacity 240ms ease-out, scale 280ms cubic-bezier(0.32, 0.72, 0, 1);
}
.lb-leave-active .lb-backdrop,
.lb-leave-active .lb-chrome,
.lb-leave-active .lb-content {
  transition: opacity 200ms ease-in, scale 220ms ease-in;
}
.lb-enter-from .lb-backdrop,
.lb-enter-from .lb-chrome,
.lb-leave-to .lb-backdrop,
.lb-leave-to .lb-chrome {
  opacity: 0 !important; /* beats the inline opacity a drag leaves behind */
}
.lb-enter-from .lb-content,
.lb-leave-to .lb-content {
  opacity: 0;
  scale: 0.94;
}
@media (prefers-reduced-motion: reduce) {
  .lb-enter-from .lb-content,
  .lb-leave-to .lb-content {
    scale: 1;
  }
}
</style>
