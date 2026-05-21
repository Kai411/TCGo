<script setup lang="ts">
definePageMeta({
  layout: "landing",
});

useHead({
  title: "Updates · TCGo",
});
</script>

<template>
  <div class="w-[90%] sm:w-[60%] mx-auto pt-8 pb-[120px]">
    <h1>TCGo Updates</h1>

    <div class="updates">
      <div class="header">
        <hr class="my-8" />
        <h1>V 0.2.0</h1>
        <p class="italic mt-2">Date: May 21, 2026</p>

        <br />
        <strong>Major changes:</strong>
        <ul>
          <li>
            <strong>Membership tiers</strong> — Free accounts get 20 card scans
            per month; Premium unlocks unlimited scans. Quota meter in scanner
            header, membership tile in Settings.
          </li>
          <li>
            <strong>Multi-TCG support</strong> — listings can now be tagged as
            Pokémon, One Piece, Digimon, Magic, Yu-Gi-Oh!, Dragon Ball Super,
            Lorcana, or Other. Shop page has TCG filter pills.
          </li>
          <li>
            <strong>Japanese / non-English cards</strong> — scanner detects the
            printed language and tags listings (JP / KR / CN / …). For JP cards,
            the printed set number is preserved instead of being overwritten by
            an English match.
          </li>
          <li>
            <strong>Installable app (PWA)</strong> — add TCGo to your home
            screen on iOS / Android, or install as a desktop app. Works
            offline-shell with cached assets.
          </li>
          <li><strong>Dark mode polish</strong> across every page.</li>
          <li>
            <strong>Smarter scanner</strong> — camera captures at 4K, upload
            quality bumped, scan/manual segmented toggle on Sell &amp; Auction
            create pages along with faster identification.
          </li>
          <li>
            <strong>Activity tab</strong> on mobile with quick switcher between
            My Listings and My Bids.
          </li>
          <li>
            <strong>Listing details</strong> — graded slabs now show their grade
            (e.g. PSA 10) prominently, multi-photo listings show a 1/N counter
            on the hero image.
          </li>
          <li>Auction tile bid count now actually shows the bid count.</li>
        </ul>
      </div>

      <div class="header">
        <hr class="my-8" />
        <h1>V 0.1.0</h1>
        <p class="italic mt-2">Date: May 21, 2026</p>

        <br />
        <strong>Major changes:</strong>
        <ul>
          <li>Queued scanner for create listing</li>
          <li>Improved marketplace UI</li>
        </ul>
      </div>

      <div class="header">
        <hr class="my-8" />
        <h1>V 0.0.5</h1>
        <p class="italic mt-2">Date: May 19, 2026</p>

        <br />
        <strong>Launch of beta access.</strong>
      </div>

      <div class="header">
        <hr class="my-8" />
        <h1>V 0.0.4</h1>
        <p class="italic mt-2">Date: May 17, 2026</p>

        <br />
        <strong>New Feature:</strong>
        <ul>
          <li>TCGo Landing Page</li>
          <li>Privacy Policy</li>
        </ul>
      </div>

      <div class="header">
        <hr class="my-8" />
        <h1>V 0.0.3</h1>
        <p class="italic mt-2">Date: May 16, 2026</p>

        <br />
        <strong>New Feature:</strong>
        <ul>
          <li>Google login</li>
          <li>Profile management</li>
        </ul>
      </div>

      <div class="header">
        <hr class="my-8" />
        <h1>V 0.0.2</h1>
        <p class="italic mt-2">Date: May 15, 2026</p>

        <br />
        <strong>New Feature:</strong>
        <ul>
          <li>Sales listing</li>
          <li>Real-time live bidding</li>
        </ul>
      </div>

      <div class="header">
        <hr class="my-8" />
        <h1>V 0.0.1</h1>
        <p class="italic mt-2">Date: May 14, 2026</p>

        <br />
        <strong>First prototype of TCGo Marketplace</strong>
      </div>
    </div>
  </div>
</template>

<style scoped>
h1 {
  @apply text-3xl font-bold;
}

h2 {
  @apply text-2xl font-bold;
}

ul {
  list-style: disc;
  margin-left: 30px;
}

.content-container {
  @apply flex flex-col gap-8;
}
</style>
