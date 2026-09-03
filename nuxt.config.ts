// Marketing surfaces are light-only. Listed here (rather than only in the
// landing layout) because the pre-paint script below has to know before Vue
// mounts — otherwise a dark-mode visitor gets a dark flash on these routes.
const LIGHT_ONLY_ROUTES = [
  "/landing",
  "/pricing",
  "/privacy-policy",
  "/update-notice",
];

// The PWA module only emits manifest.webmanifest for production builds
// (devOptions.enabled is false, deliberately — see the pwa block below).
// Linking it in dev anyway makes the browser fetch a file that doesn't exist,
// get the SPA's index.html fallback, and log
// "Manifest: Line: 1, column: 1, Syntax error" on every page load.
const isDev = process.env.NODE_ENV === "development";

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
    // NOTE: no `pageTransition` here on purpose. An out-in <Transition>
    // around nested routes (pages/cards/[id].vue → <NuxtPage/>) left the next
    // page blank after leaving a card. Route animation is a CSS enter
    // animation on a route-keyed wrapper in layouts/default.vue instead.
    head: {
      title: "TCGo Marketplace - Buy, Sell & Auction Pokemon Cards in Malaysia",
      htmlAttrs: { lang: "en" },
      script: [
        {
          // Apply theme synchronously before paint to avoid a light→dark flash.
          // Mirrors the logic in composables/useTheme.ts; keep in sync.
          //
          // Two rules, both deliberate:
          //  1. Light-only routes never get `dark`, whatever the visitor chose.
          //  2. An ABSENT key resolves to light, not to the OS preference —
          //     dark is opt-in. Only an explicit "system" follows the OS.
          innerHTML: `(function(){try{var L=${JSON.stringify(
            LIGHT_ONLY_ROUTES
          )};var p=location.pathname.replace(/\\/+$/,'')||'/';if(L.indexOf(p)!==-1)return;var t=localStorage.getItem('tcgo-theme');var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`,
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
            "TCGo Marketplace is Malaysia's trusted community for buying, selling, and auctioning Pokemon TCG cards. List your cards, place bids, and pay securely online with FPX.",
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
        // ssr:false mode, so we add it ourselves. Production only: see isDev.
        ...(isDev ? [] : [{ rel: "manifest", href: "/manifest.webmanifest" }]),
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
  // Dev-server only: allow Cloudflare/ngrok tunnel hosts so the Billplz
  // webhook can reach localhost during payment testing. No effect on the
  // production build.
  vite: {
    server: {
      allowedHosts: [".trycloudflare.com", ".ngrok-free.app", ".ngrok.io"],
    },
  },
  runtimeConfig: {
    // Server-only secrets (no NUXT_PUBLIC_ prefix)
    stripeSecretKey: "",
    stripeWebhookSecret: "",
    stripePricePremium: "",
    firebaseServiceAccount: "", // base64-encoded service account JSON
    // Billplz (FPX order payments). Sandbox: set billplzSandbox=true and use
    // billplz-sandbox.com credentials.
    billplzApiKey: "",
    billplzCollectionId: "",
    billplzXSignatureKey: "",
    billplzSandbox: "",
    // Mailtrap. mailtrapInboxId set = sandbox (captured, not delivered);
    // clear it once a sending domain is verified to deliver for real.
    mailtrapApiToken: "",
    mailtrapInboxId: "",
    mailFrom: "",
    mailFromName: "",
    // Didit (identity verification). Server-only: the API key must never
    // reach the browser, and the webhook secret verifies inbound signatures.
    // The workflow id is per-session config, not a secret — see shared/didit.ts.
    diditApiKey: "",
    diditWebhookSecret: "",
    // Shared secret for scheduled jobs (the automatic payout runner). Empty
    // means the scheduled path is refused outright — automation you forgot to
    // configure should not be automation anyone can trigger.
    cronSecret: "",
    // Keys the HMAC over email verification and password-reset codes, so a
    // leaked Firestore export doesn't yield working codes (six digits is a
    // small enough space to reverse from a plain hash). Optional: unset falls
    // back to the service account, which is always present — see
    // server/utils/auth-codes.ts. Set it to rotate codes independently.
    authCodeSecret: "",
    // HitPay (DuitNow QR at the counter). Separate from Billplz on purpose:
    // Billplz cannot return an embeddable QR payload, only a hosted page.
    // hitpayApiKey is the platform account; each seller's own sub-merchant key
    // lives on their user doc so counter takings settle to their bank, not
    // ours. Unset = the POS offers cash only.
    hitpayApiKey: "",
    hitpayPlatformKey: "",
    hitpayWebhookSalt: "",
    hitpaySandbox: "",
    // Delyva (courier aggregator) — live shipping quotes at checkout.
    // delyvaApiBase empty = production; set it to the sandbox base URL
    // (with matching sandbox credentials) to test without real money.
    delyvaApiBase: "",
    delyvaApiKey: "",
    delyvaCustomerId: "",
    delyvaCompanyId: "",
    public: {
      // Lets the POS show the QR option only when the platform can actually
      // create one. Not a secret — it's a feature flag, and the seller finds
      // out either way the moment they tap Pay.
      posQrEnabled: "",
      // Mirrors the server-side billplzSandbox flag. Public because the seller
      // KYC form needs to know whether to offer Billplz's sandbox test bank —
      // it's an environment marker, not a secret.
      billplzSandbox: "",
      firebaseApiKey: "",
      firebaseAuthDomain: "",
      firebaseDatabaseURL: "",
      firebaseProjectId: "",
      firebaseStorageBucket: "",
      firebaseMessagingSenderId: "",
      firebaseAppId: "",
      cloudinaryCloudName: "",
      cloudinaryUploadPreset: "",
      stripePublishableKey: "",
      siteUrl: "https://tcgo.shop",
      // Supabase (browser-side anon — catalog + price reads are public).
      supabaseUrl: "",
      supabaseAnonKey: "",
    },
  },
});
