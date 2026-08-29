/**
 * "Fly to cart" micro-animation: a small thumbnail launches from the
 * clicked element, arcs to the navbar cart icon (marked with
 * `data-cart-target`), shrinks/fades, then the icon bumps.
 *
 * Purely decorative — it never blocks or delays the actual add-to-cart.
 */
export const useFlyToCart = () => {
  const flyToCart = (from: HTMLElement | null, imageUrl?: string) => {
    if (!from || typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const target = document.querySelector<HTMLElement>("[data-cart-target]");
    if (!target) return;

    const a = from.getBoundingClientRect();
    const b = target.getBoundingClientRect();

    const SIZE = 44;
    const startX = a.left + a.width / 2 - SIZE / 2;
    const startY = a.top + a.height / 2 - SIZE / 2;
    const endX = b.left + b.width / 2 - SIZE / 2;
    const endY = b.top + b.height / 2 - SIZE / 2;

    const el = document.createElement("div");
    el.setAttribute("aria-hidden", "true");
    Object.assign(el.style, {
      position: "fixed",
      left: `${startX}px`,
      top: `${startY}px`,
      width: `${SIZE}px`,
      height: `${SIZE}px`,
      borderRadius: "10px",
      overflow: "hidden",
      zIndex: "70",
      pointerEvents: "none",
      boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
      background: imageUrl ? "#fff" : "#dc2626",
      willChange: "transform, opacity",
    } as CSSStyleDeclaration);
    if (imageUrl) {
      const img = document.createElement("img");
      img.src = imageUrl;
      img.alt = "";
      Object.assign(img.style, {
        width: "100%",
        height: "100%",
        objectFit: "cover",
        display: "block",
      });
      el.appendChild(img);
    }
    document.body.appendChild(el);

    const dx = endX - startX;
    const dy = endY - startY;
    // Arc: lift up mid-flight so it doesn't feel like a straight slide.
    const lift = Math.min(120, Math.max(40, Math.abs(dy) * 0.35));

    const DURATION = 480;
    const anim = el.animate(
      [
        { transform: "translate(0,0) scale(1)", opacity: 1, offset: 0 },
        {
          transform: `translate(${dx * 0.5}px, ${dy * 0.5 - lift}px) scale(0.8)`,
          opacity: 1,
          offset: 0.5,
        },
        // Reaches the icon here; the tail just shrinks into it.
        {
          transform: `translate(${dx}px, ${dy}px) scale(0.45)`,
          opacity: 0.9,
          offset: 0.8,
        },
        { transform: `translate(${dx}px, ${dy}px) scale(0.1)`, opacity: 0 },
      ],
      { duration: DURATION, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" },
    );

    // Bump the icon as the thumbnail *reaches* it, not after it has faded —
    // otherwise the bump reads as late.
    window.setTimeout(() => {
      target.classList.remove("cart-bump");
      void target.offsetWidth; // restart if still applied
      target.classList.add("cart-bump");
      target.addEventListener(
        "animationend",
        () => target.classList.remove("cart-bump"),
        { once: true },
      );
    }, DURATION * 0.65);

    anim.onfinish = () => el.remove();
  };

  return { flyToCart };
};
