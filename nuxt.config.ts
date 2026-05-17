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
      name: "PikaPicks",
      short_name: "PikaPicks",
      description: "TCG Marketplace - Buy, Sell & Auction Cards",
      theme_color: "#dc2626",
      background_color: "#f9fafb",
      display: "standalone",
      orientation: "portrait",
      icons: [
        {
          src: "/icon-192.png",
          sizes: "192x192",
          type: "image/png",
        },
        {
          src: "/icon-512.png",
          sizes: "512x512",
          type: "image/png",
        },
        {
          src: "/icon-512.png",
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
      title: "PikaPicks",
      meta: [
        {
          name: "description",
          content: "TCG Marketplace - Buy, Sell & Auction Cards",
        },
        { property: "og:title", content: "PikaPicks" },
        {
          property: "og:description",
          content: "TCG Marketplace - Buy, Sell & Auction Cards",
        },
        { property: "og:image", content: "/og-image.png" },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "theme-color", content: "#dc2626" },
      ],
      link: [
        { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
        {
          rel: "apple-touch-icon",
          sizes: "180x180",
          href: "/apple-touch-icon.png",
        },
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
