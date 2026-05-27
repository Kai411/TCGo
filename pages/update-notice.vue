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
        <h1>V 0.3.1</h1>
        <p class="italic mt-2">Date: May 27, 2026</p>

        <br />
        <strong>Changes:</strong>
        <ul>
          <li>
            <strong>Image gallery swipe</strong> — card and auction detail pages
            now have a scroll-snap image strip with left/right arrow buttons,
            swipe-to-navigate on mobile, and a 1/N counter badge.
          </li>
          <li>
            <strong>Auction performance &amp; sharing</strong> — auction pages
            now load faster and social previews (WhatsApp, Telegram, etc.)
            correctly show the card image and title when sharing a link.
          </li>
          <li>
            <strong>Auction create form</strong> — inline input labels to reduce
            form ambiguity.
          </li>
          <li>
            <strong>Install prompt</strong> — updated logo and adjusted position
            above bottom navigation.
          </li>
          <li>
            <strong>UI/UX</strong> — updated create listing form end edit form
            to ease navigation and actions.
          </li>
        </ul>
      </div>

      <div class="header">
        <hr class="my-8" />
        <h1>V 0.3.0</h1>
        <p class="italic mt-2">Date: May 21, 2026</p>

        <br />
        <strong>Major changes:</strong>
        <ul>
          <li>
            <strong>Beta verification gate</strong> — unverified users see a
            full-screen overlay on marketplace pages with instructions to verify
            their beta access to ensure controlled and secure beta testing
            environment.
          </li>
          <li>
            <strong>Card tile redesign</strong> — grade/condition badge moved to
            image overlay, seller moved to body text, image aspect ratio updated
            to match real card proportions.
          </li>
          <li>
            <strong>Auction tile redesign</strong> — merged status and countdown
            into a single badge (LIVE 20h 43m / ENDED), removed side border
            accent, color-coded urgency (green → amber → red pulse).
          </li>
          <li>
            <strong>Price formatting</strong> — prices now display with comma
            separators (e.g. 10,000.00). Price input shows "RM" prefix icon.
          </li>
          <li>
            <strong>Scanner simplified</strong> — removed rarity, variant, and
            edition auto-detection to avoid incorrect data. Scanner now only
            fills name, number, language, and artist.
          </li>
          <li>
            <strong>Image handling</strong> — scan-to-list no longer saves the
            official pokemon tcg image; only the user's own photo is used. Fixed
            duplicate image bug.
          </li>
          <li>
            <strong>Detail page cleanup</strong> — removed
            rarity/variant/edition badges, kept set number and condition/grade
            with consistent color coding.
          </li>
        </ul>
      </div>

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
            offline-shell with cached assets. (UNDER TESTING)
          </li>
          <li><strong>Dark mode polish</strong> across every page.</li>
          <li>
            <strong>Smarter scanner</strong> — camera captures at full
            resolution, upload quality bumped, scan/manual segmented toggle on
            Sell &amp; Auction create pages along with faster identification.
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
