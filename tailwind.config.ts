import type { Config } from "tailwindcss";
import colors from "tailwindcss/colors";

export default {
  darkMode: "class",
  content: [
    "./components/**/*.{js,vue,ts}",
    "./layouts/**/*.vue",
    "./pages/**/*.vue",
    "./composables/**/*.{js,ts}",
    "./plugins/**/*.{js,ts}",
    "./app.vue",
    // Status chip colours (delivery-stage etc.) are class strings in shared/.
    "./shared/**/*.ts",
  ],
  theme: {
    extend: {
      colors: {
        // One grey family (2026-11 design audit). The ink and canvas tokens
        // are zinc values, but pages also used Tailwind's blue-tinted gray
        // and slate, so borders and secondary text drifted from page to
        // page. Every grey utility now resolves to zinc.
        gray: colors.zinc,
        slate: colors.zinc,
        neutral: colors.zinc,
        stone: colors.zinc,
        pokemon: {
          red: "#E3350D",
          // Hover and pressed state for red buttons (replaces the old glow).
          "red-dark": "#C42D0B",
          blue: "#006DAA",
          yellow: "#FFCB05",
          gold: "#B8860B",
        },
        // Greys are tuned slightly cooler/deeper than zinc for premium contrast.
        ink: {
          DEFAULT: "#09090B",
          subtle: "#27272A",
          muted: "#52525B",
          soft: "#A1A1AA",
          faint: "#D4D4D8",
        },
        // Dark-mode surfaces that pages used to write as hex literals.
        night: {
          raised: "#1B1B20",
          sunken: "#17171C",
          hover: "#202027",
          high: "#26262C",
        },
        canvas: {
          DEFAULT: "#FAFAFA",
          raised: "#FFFFFF",
          sunken: "#F4F4F5",
          // Slate-tinted dark, not pitch black — feels premium, lets shadows
          // and surface elevation read.
          inverse: "#111114",
        },
      },
      fontFamily: {
        sans: [
          '"Inter"',
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        display: ['"Inter"', "system-ui", "sans-serif"],
      },
      letterSpacing: {
        // Display tracking stays within -0.01 to -0.02em (better-typography);
        // tighter made the letters touch.
        tightest: "-0.02em",
        hero: "-0.02em",
      },
      // Type scale by role (2026-11 design audit, better-typography). Each
      // size carries its own unitless line-height, so a role is one
      // decision. Tailwind's text-xs/sm/base/lg/xl/2xl stay valid and line
      // up with caption/body-sm/body/title/section/page. Phone listing tiles
      // keep kai's exact pixel sizes (CardTile and the Dex tiles).
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "1.3" }], // 10px: badges only
        micro: ["0.6875rem", { lineHeight: "1.35" }], // 11px: meta, chips
        caption: ["0.75rem", { lineHeight: "1.4" }], // 12px
        label: ["0.8125rem", { lineHeight: "1.4" }], // 13px: labels, secondary text
        "body-sm": ["0.875rem", { lineHeight: "1.5" }], // 14px
        "body-ui": ["0.9375rem", { lineHeight: "1.45" }], // 15px: touch rows, fields
        body: ["1rem", { lineHeight: "1.55" }], // 16px: reading text
        title: ["1.125rem", { lineHeight: "1.3" }], // 18px: h3
        section: ["1.25rem", { lineHeight: "1.3" }], // 20px: h2
        page: ["1.5rem", { lineHeight: "1.2" }], // 24px: h1
        hero: ["clamp(2.5rem, 6vw, 4.5rem)", { lineHeight: "1.05", letterSpacing: "-0.02em" }],
        display: ["clamp(2rem, 4vw, 3rem)", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,15,20,0.04), 0 4px 16px rgba(15,15,20,0.04)",
        "card-hover":
          "0 1px 2px rgba(15,15,20,0.05), 0 16px 40px rgba(15,15,20,0.12)",
        "ring-soft":
          "0 0 0 1px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        pill:
          "0 1px 2px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.04) inset",
      },
      backdropBlur: {
        xs: "2px",
      },
      transitionTimingFunction: {
        premium: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
} satisfies Config;
