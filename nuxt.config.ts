// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  ssr: false,
  devtools: { enabled: true },
  modules: ["@nuxtjs/tailwindcss", "@vite-pwa/nuxt"],
  tailwindcss: {
    cssPath: "~/assets/css/tailwind.css",
  },
  pwa: {
    registerType: "autoUpdate",
    manifest: {
      name: "TCGo Marketplace",
      short_name: "TCGo",
      description: "TCGo Marketplace - Buy, Sell & Auction Cards",
      theme_color: "#dc2626",
      background_color: "#f9fafb",
      display: "standalone",
      orientation: "portrait",
      icons: [
        {
          src: "/tcgo.png",
          sizes: "512x512",
          type: "image/png",
        },
        {
          src: "/tcgo.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any maskable",
        },
      ],
    },
    workbox: {
      navigateFallback: "/",
      globPatterns: ["**/*.{js,css,html,png,svg,ico}"],
    },
  },
  app: {
    head: {
      title: "TCGo Marketplace - Buy, Sell & Auction Pokemon Cards in Malaysia",
      htmlAttrs: { lang: "en" },
      meta: [
        { charset: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        {
          name: "description",
          content:
            "TCGo Marketplace is Malaysia's trusted community for buying, selling, and auctioning Pokemon TCG cards. List your cards, place bids, and connect with collectors via WhatsApp.",
        },
        {
          name: "keywords",
          content:
            "Pokemon TCG, Pokemon cards Malaysia, TCG marketplace, buy Pokemon cards, sell Pokemon cards, Pokemon auction, Pokemon card collector, trading card game, Charizard, Pikachu, rare Pokemon cards, Malaysia TCG community",
        },
        { name: "author", content: "TCGo Marketplace" },
        { name: "robots", content: "index, follow" },
        { name: "theme-color", content: "#dc2626" },

        // Open Graph (Facebook, WhatsApp, Discord)
        { property: "og:title", content: "TCGo Marketplace" },
        {
          property: "og:description",
          content:
            "Buy, sell, and auction Pokemon TCG cards. Join Malaysia's trusted card collector community.",
        },
        { property: "og:image", content: "/og.webp" },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { property: "og:image:type", content: "image/webp" },
        { property: "og:type", content: "website" },
        { property: "og:site_name", content: "TCGo Marketplace" },
        { property: "og:locale", content: "en_MY" },

        // Twitter
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: "TCGo Marketplace" },
        {
          name: "twitter:description",
          content: "Buy, sell, and auction Pokemon TCG cards in Malaysia.",
        },
        { name: "twitter:image", content: "/og.webp" },

        // Mobile / iOS
        { name: "apple-mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-status-bar-style", content: "default" },
        { name: "apple-mobile-web-app-title", content: "TCGo" },
        { name: "format-detection", content: "telephone=no" },

        {
          name: "google-site-verification",
          content: "25Sj9LfPcOkYGGAx2THNkHMOV63av2TPuISGJ-CQfcw",
        },
      ],
      link: [
        { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
        {
          rel: "apple-touch-icon",
          sizes: "180x180",
          href: "/apple-touch-icon.png",
        },
        { rel: "canonical", href: "https://tcgo.shop/" },
      ],
    },
  },
  runtimeConfig: {
    public: {
      firebaseApiKey: "",
      firebaseAuthDomain: "",
      firebaseDatabaseURL: "",
      firebaseProjectId: "",
      firebaseStorageBucket: "",
      firebaseMessagingSenderId: "",
      firebaseAppId: "",
      cloudinaryCloudName: "",
      cloudinaryUploadPreset: "",
    },
  },
});
