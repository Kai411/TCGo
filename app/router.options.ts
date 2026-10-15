import type { RouterConfig } from "@nuxt/schema";
import { START_LOCATION } from "vue-router";
import { SHOP_STATE_KEY } from "~/composables/useShopOrdering";

// Mirrors Nuxt's default scrollBehavior with one addition: entering the shop
// ("/") without a browser-saved position resumes at the scroll offset the
// shop stored in sessionStorage (see pages/index.vue). Doing it here — rather
// than in the page's onMounted — matters because Nuxt applies its own
// scroll-to-top after `page:loading:end`, which would override the page.

const shopSavedTop = (): number => {
  try {
    const raw = sessionStorage.getItem(SHOP_STATE_KEY);
    const y = raw ? Number(JSON.parse(raw)?.y) : 0;
    return Number.isFinite(y) && y > 0 ? y : 0;
  } catch {
    return 0;
  }
};

const hashScrollMarginTop = (selector: string) => {
  try {
    const el = document.querySelector(selector);
    if (el)
      return (
        (Number.parseFloat(getComputedStyle(el).scrollMarginTop) || 0) +
        (Number.parseFloat(
          getComputedStyle(document.documentElement).scrollPaddingTop,
        ) || 0)
      );
  } catch {}
  return 0;
};

export default <RouterConfig>{
  scrollBehavior(to, from, savedPosition) {
    const nuxtApp = useNuxtApp();
    const router = useRouter();
    const hashBehaviour =
      (router.options as any)?.scrollBehaviorType ?? "auto";

    if (to.path.replace(/\/$/, "") === from.path.replace(/\/$/, "")) {
      if (from.hash && !to.hash) return savedPosition ?? { left: 0, top: 0 };
      if (to.hash)
        return {
          el: to.hash,
          top: hashScrollMarginTop(to.hash),
          behavior: hashBehaviour,
        };
      return false;
    }

    const allowsTop =
      typeof to.meta.scrollToTop === "function"
        ? to.meta.scrollToTop(to, from)
        : to.meta.scrollToTop;
    if (allowsTop === false) return false;

    const calculate = () => {
      if (savedPosition) return savedPosition;
      if (to.hash)
        return {
          el: to.hash,
          top: hashScrollMarginTop(to.hash),
          behavior: hashBehaviour,
        };
      // Shop resume: only when no ?page is forced in the URL and the user
      // isn't arriving via a hash link.
      if (to.path === "/" && !to.query.page) {
        const top = shopSavedTop();
        if (top) return { left: 0, top };
      }
      return { left: 0, top: 0 };
    };

    if (from === START_LOCATION) return calculate();

    return new Promise((resolve) => {
      const doScroll = () => {
        requestAnimationFrame(() => {
          if (router.currentRoute.value.fullPath !== to.fullPath) {
            resolve(false);
            return;
          }
          resolve(calculate());
        });
      };
      nuxtApp.hooks.hookOnce("page:loading:end", () => {
        const transitionPromise = (nuxtApp as any)["~transitionPromise"];
        if (transitionPromise) transitionPromise.then(doScroll);
        else doScroll();
      });
    });
  },
};
