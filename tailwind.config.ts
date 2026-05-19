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
  ],
  theme: {
    extend: {
      colors: {
        pokemon: {
          red: "#E3350D",
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
          inverse: "#0A0A0B",
          "inverse-raised": "#141416",
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
        tightest: "-0.04em",
        hero: "-0.055em",
      },
      fontSize: {
        hero: ["clamp(2.5rem, 6vw, 4.5rem)", { lineHeight: "1", letterSpacing: "-0.055em" }],
        display: ["clamp(2rem, 4vw, 3rem)", { lineHeight: "1.05", letterSpacing: "-0.04em" }],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,15,20,0.04), 0 4px 16px rgba(15,15,20,0.04)",
        "card-hover":
          "0 1px 2px rgba(15,15,20,0.05), 0 16px 40px rgba(15,15,20,0.12)",
        glow:
          "0 0 0 1px rgba(227,53,13,0.5), 0 8px 24px rgba(227,53,13,0.35)",
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
