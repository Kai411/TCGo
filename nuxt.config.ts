// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  ssr: false,
  devtools: { enabled: false },
  features: {
    devLogs: false,
    appManifest: false,
  },
  modules: ["@nuxtjs/tailwindcss", "@vite-pwa/nuxt"],
  tailwindcss: {
    cssPath: "~/assets/css/tailwind.css",
  },
  pwa: {
    registerType: "autoUpdate",
    // Inject the SW registration <script> tag into the served HTML. With
    // ssr:false the module won't otherwise touch the index.html.
    injectRegister: "script-defer",
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
          src: "/tcgo_sprites.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "any",
        },
        {
          src: "/tcgo_sprites.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any",
        },
        {
          src: "/tcgo_sprites.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],
    },
    workbox: {
      // Don't intercept navigations — HTML must always come from the
      // network so every deploy is visible immediately. Previously this
      // was "/" which made the SW serve a stale cached index.html that
      // referenced old hashed chunks, breaking the site after each deploy.
      navigateFallback: null,
      // Precache only truly immutable static assets. JS/CSS are hashed
      // by Nuxt and cache-busted by filename — letting them through the
      // network avoids the "old SW serves stale chunks" trap.
      globPatterns: ["**/*.{svg,ico,png,webp,webmanifest}"],
      // New SW takes over immediately for all open tabs and removes
      // outdated precache entries on activation. Critical for users who
      // had the old precache-everything SW cached.
      skipWaiting: true,
      clientsClaim: true,
      cleanupOutdatedCaches: true,
    },
    // PWA is production-only. Enabling in dev caches Vite module chunks
    // in the service worker, which then keeps serving stale bundles
    // through hot-reloads and makes auto-imports randomly "undefined".
    devOptions: {
      enabled: false,
    },
  },
  app: {
    head: {
      title: "TCGo Marketplace - Buy, Sell & Auction Pokemon Cards in Malaysia",
      htmlAttrs: { lang: "en" },
      script: [
        {
          // Apply theme synchronously before paint to avoid a light→dark flash.
          // Mirrors the logic in composables/useTheme.ts; keep in sync.
          innerHTML:
            "(function(){try{var t=localStorage.getItem('tcgo-theme');var d=t==='dark'||((!t||t==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();",
          type: "text/javascript",
          tagPosition: "head",
        },
      ],
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
        // PWA manifest — @vite-pwa/nuxt doesn't auto-inject this in
        // ssr:false mode, so we add it ourselves.
        { rel: "manifest", href: "/manifest.webmanifest" },
        // Inter font — preconnect + non-blocking link starts the fetch in
        // parallel with HTML, not after CSS parses (much faster than @import).
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        {
          rel: "preconnect",
          href: "https://fonts.gstatic.com",
          crossorigin: "",
        },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap",
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
      // Admin WhatsApp for premium upgrade requests. Set via NUXT_PUBLIC_ADMIN_WHATSAPP.
      adminWhatsApp: "",
    },
  },
});
