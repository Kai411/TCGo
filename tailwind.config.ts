import type { Config } from "tailwindcss";

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
      fontSize: {
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
