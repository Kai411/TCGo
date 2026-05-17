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
          src: "/favicon.ico",
          sizes: "64x64",
          type: "image/x-icon",
        },
      ],
    },
    workbox: {
      navigateFallback: "/",
      globPatterns: ["**/*.{js,css,html,png,svg,ico}"],
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
