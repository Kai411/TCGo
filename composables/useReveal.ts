import type { Ref } from "vue";

// `typeof import(...)` rather than `import type { gsap }` — the latter binds a
// type-only alias that can't be used in a `typeof` query.
type Gsap = typeof import("gsap").gsap;
type TweenTarget = Parameters<Gsap["set"]>[0];
type Timeline = ReturnType<Gsap["timeline"]>;
type Context = ReturnType<Gsap["context"]>;

/**
 * GSAP is loaded on demand rather than from a Nuxt plugin. As a global plugin
 * it landed in the shared entry chunk, so every marketplace page paid for an
 * animation library only the landing page uses. Dynamic import lets Vite split
 * it into the landing route's chunk instead.
 *
 * The promise is module-level so the four landing visuals share one load.
 */
let gsapPromise: Promise<Gsap> | null = null;

function loadGsap(): Promise<Gsap> {
  if (!gsapPromise) {
    gsapPromise = Promise.all([
      import("gsap"),
      import("gsap/ScrollTrigger"),
    ]).then(([{ gsap }, { ScrollTrigger }]) => {
      gsap.registerPlugin(ScrollTrigger);
      // Matches the `ease-premium` token in tailwind.config.ts so GSAP-driven
      // and CSS-driven motion on the same page feel like one system.
      gsap.defaults({ ease: "power3.out", duration: 0.9 });
      return gsap;
    });
  }
  return gsapPromise;
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export interface RevealApi {
  gsap: Gsap;
  /** The element `useReveal` was scoped to. */
  root: HTMLElement;
  /** True when the visitor asked for reduced motion — skip the choreography. */
  reduced: boolean;
  /** Snap targets to their resting state with no motion. */
  settle: (targets: TweenTarget) => void;
  /** Timeline bound to a ScrollTrigger on `root` (or `opts.trigger`). */
  timeline: (opts?: {
    trigger?: Element;
    start?: string;
    end?: string;
    scrub?: boolean | number;
    once?: boolean;
  }) => Timeline;
  /** Count a number up as it scrolls into view. */
  countUp: (
    el: Element,
    to: number,
    format: (v: number) => string,
    opts?: { from?: number; duration?: number; trigger?: Element }
  ) => void;
}

/** Reveal any element still sitting in the CSS `.reveal-init` hidden state. */
function forceVisible(root: HTMLElement | undefined) {
  root?.querySelectorAll<HTMLElement>(".reveal-init").forEach((el) => {
    el.style.opacity = "1";
    el.style.transform = "none";
  });
}

/**
 * Runs `build` once GSAP has loaded and the component is mounted, inside a
 * `gsap.context` scoped to `scope`.
 *
 * The context matters: this is an SPA, so without it every ScrollTrigger the
 * landing page creates would keep listening to scroll after the user navigates
 * into the marketplace. `ctx.revert()` on unmount kills the whole set.
 */
export function useReveal(
  scope: Ref<HTMLElement | undefined>,
  build: (api: RevealApi) => void
) {
  let ctx: Context | null = null;
  let disposed = false;

  onMounted(async () => {
    const gsap = await loadGsap().catch(() => null);

    // Library failed to load, or the component went away while it was in
    // flight. Either way, don't leave the copy stuck at opacity 0.
    if (!gsap || disposed || !scope.value) {
      if (!disposed) forceVisible(scope.value);
      return;
    }

    const root = scope.value;
    const reduced = prefersReducedMotion();

    const api: RevealApi = {
      gsap,
      root,
      reduced,
      settle: (targets) =>
        gsap.set(targets, { opacity: 1, x: 0, y: 0, scale: 1 }),

      timeline: (opts = {}) =>
        gsap.timeline({
          scrollTrigger: {
            trigger: opts.trigger ?? root,
            start: opts.start ?? "top 72%",
            end: opts.end ?? "bottom 60%",
            scrub: opts.scrub ?? false,
            once: opts.once ?? !opts.scrub,
          },
        }),

      countUp: (el, to, format, opts = {}) => {
        const from = opts.from ?? 0;
        if (reduced) {
          el.textContent = format(to);
          return;
        }
        const state = { v: from };
        gsap.to(state, {
          v: to,
          duration: opts.duration ?? 1.6,
          ease: "power2.out",
          onUpdate: () => {
            el.textContent = format(state.v);
          },
          scrollTrigger: {
            trigger: opts.trigger ?? el,
            start: "top 85%",
            once: true,
          },
        });
      },
    };

    ctx = gsap.context(() => build(api), root);
  });

  // Registered synchronously at setup time — registering it after the `await`
  // above would run outside the component instance and never fire.
  onUnmounted(() => {
    disposed = true;
    ctx?.revert();
  });
}
