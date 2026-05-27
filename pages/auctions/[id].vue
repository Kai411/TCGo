<template>
  <div>
    <div v-if="loading" class="flex justify-center py-12">
      <div
        class="animate-spin rounded-full h-6 w-6 border-b-2 border-pokemon-red"
      ></div>
    </div>

    <div v-else-if="!auction" class="text-center py-12">
      <p class="text-gray-500 dark:text-zinc-400 text-lg">Auction not found.</p>
      <NuxtLink
        to="/auctions"
        class="text-pokemon-red hover:underline mt-2 inline-block text-sm"
      >
        ← Back to auctions
      </NuxtLink>
    </div>

    <div v-else>
      <NuxtLink
        to="/auctions"
        class="text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 text-sm inline-block mb-4"
      >
        ← Back to auctions
      </NuxtLink>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <!-- Image Gallery -->
        <div class="lg:col-span-4">
          <div
            class="bg-white dark:bg-white/[0.04] rounded-xl overflow-hidden border border-gray-200 dark:border-white/[0.08] sticky top-8"
          >
            <!-- Scroll-snap strip -->
            <div class="relative aspect-[3/4] bg-gray-100 dark:bg-white/[0.04]">
              <div
                ref="scrollContainer"
                class="absolute inset-0 flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory"
                style="scrollbar-width: none; -ms-overflow-style: none;"
                @scroll.passive="onImageScroll"
              >
                <div
                  v-if="allImages.length === 0"
                  class="w-full h-full shrink-0 snap-start flex items-center justify-center"
                >
                  <span class="text-gray-400 dark:text-zinc-500">No Image</span>
                </div>
                <div
                  v-for="(img, i) in allImages"
                  :key="i"
                  class="w-full h-full shrink-0 snap-start flex items-center justify-center"
                >
                  <img :src="img" :alt="auction.cardName" class="w-full h-full object-cover" />
                </div>
              </div>

              <!-- Prev arrow -->
              <button
                v-if="allImages.length > 1 && activeImageIndex > 0"
                @click="prevImage"
                class="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors z-10"
              >
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>

              <!-- Next arrow -->
              <button
                v-if="allImages.length > 1 && activeImageIndex < allImages.length - 1"
                @click="nextImage"
                class="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors z-10"
              >
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>

              <!-- Counter badge -->
              <span
                v-if="allImages.length > 1"
                class="absolute bottom-2 right-2 bg-black/70 text-white text-xs font-semibold tabular-nums px-2 py-0.5 rounded-full z-10"
              >
                {{ activeImageIndex + 1 }}/{{ allImages.length }}
              </span>
            </div>

            <!-- Thumbnails -->
            <div v-if="allImages.length > 1" class="flex gap-2 p-2 overflow-x-auto">
              <button
                v-for="(img, index) in allImages"
                :key="index"
                @click="scrollToImage(index)"
                class="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-colors"
                :class="activeImageIndex === index ? 'border-pokemon-red' : 'border-gray-200 dark:border-white/[0.08] hover:border-gray-400'"
              >
                <img :src="img" :alt="`Photo ${index + 1}`" class="w-full h-full object-cover" />
              </button>
            </div>
          </div>
        </div>

        <!-- Card Info -->
        <div class="lg:col-span-4 space-y-4">
          <div class="bg-white dark:bg-white/[0.04] rounded-xl p-5 border border-gray-200 dark:border-white/[0.08]">
            <h1 class="text-xl font-bold mb-2">{{ auction.title }}</h1>
            <div
              v-if="auction.isPrivate"
              class="inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full mb-2"
            >
              🔒 Private Auction
            </div>
            <div class="flex flex-wrap gap-2 mb-3">
              <span
                class="bg-gray-100 dark:bg-white/[0.04] text-gray-700 dark:text-zinc-200 px-2.5 py-0.5 rounded-full text-xs"
                >{{ auction.cardName }}</span
              >
              <span
                class="bg-gray-100 dark:bg-white/[0.04] text-gray-700 dark:text-zinc-200 px-2.5 py-0.5 rounded-full text-xs"
                >{{ auction.cardSet }}</span
              >
              <span
                v-if="auction.language && auction.language !== 'EN'"
                class="bg-black/85 text-white px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wide"
                >{{ auction.language }}</span
              >
              <span
                class="bg-gray-100 dark:bg-white/[0.04] text-gray-700 dark:text-zinc-200 px-2.5 py-0.5 rounded-full text-xs"
                >{{ auction.condition }}</span
              >
            </div>
            <p v-if="auction.description" class="text-gray-600 dark:text-zinc-300 text-sm">
              {{ auction.description }}
            </p>
            <div class="flex gap-4 mt-4 text-xs text-gray-500 dark:text-zinc-400">
              <p>
                Seller:
                <NuxtLink
                  :to="`/profile/${auction.sellerUid}`"
                  class="text-pokemon-blue hover:underline"
                  >{{ auction.seller }}</NuxtLink
                >
              </p>
              <p>
                Min increment:
                <span class="text-gray-700 dark:text-zinc-200"
                  >RM {{ (auction.minIncrement || 1).toFixed(2) }}</span
                >
              </p>
            </div>
          </div>
          <!-- Bid History -->
          <div class="bg-white dark:bg-white/[0.04] rounded-xl p-6 border border-gray-200 dark:border-white/[0.08]">
            <h3 class="font-bold text-sm mb-4">
              Bid History ({{ bids.length }})
            </h3>
            <div
              v-if="bids.length === 0"
              class="text-gray-400 dark:text-zinc-500 text-sm text-center py-4"
            >
              No bids yet. Be the first!
            </div>
            <div v-else class="space-y-2 max-h-64 overflow-y-auto">
              <div
                v-for="(bid, index) in bids"
                :key="bid.id"
                class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-white/[0.06] last:border-0"
              >
                <div>
                  <p
                    class="text-sm font-medium"
                    :class="index === 0 ? 'text-pokemon-red' : 'text-gray-700 dark:text-zinc-200'"
                  >
                    {{ bid.bidder }}
                    <span
                      v-if="bid.isAutoBid"
                      class="text-xs text-gray-400 dark:text-zinc-500 ml-1"
                      >(auto)</span
                    >
                  </p>
                  <p class="text-xs text-gray-400 dark:text-zinc-500">
                    {{ formatTime(bid.timestamp) }}
                  </p>
                </div>
                <p
                  class="font-bold text-sm"
                  :class="index === 0 ? 'text-pokemon-red' : 'text-gray-700 dark:text-zinc-200'"
                >
                  <span
                    v-if="bid.triggeredAntiSnipe"
                    title="Triggered anti-snipe"
                    >⚡</span
                  >
                  RM {{ bid.amount.toFixed(2) }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Bidding Panel -->
        <div class="lg:col-span-4 space-y-4">
          <div class="bg-white dark:bg-white/[0.04] rounded-xl p-6 border border-gray-200 dark:border-white/[0.08]">
            <div class="text-center mb-4">
              <p class="text-xs text-gray-500 dark:text-zinc-400">Current Price</p>
              <p class="text-3xl font-bold text-pokemon-red">
                RM {{ auction.currentPrice.toFixed(2) }}
              </p>
              <p class="text-xs text-gray-400 dark:text-zinc-500 mt-1">
                Started at RM {{ auction.startingPrice.toFixed(2) }}
              </p>
            </div>

            <div
              class="text-center py-2 rounded-lg"
              :class="isEnded ? 'bg-red-50' : 'bg-gray-100 dark:bg-white/[0.04]'"
            >
              <p
                class="text-sm"
                :class="isEnded ? 'text-red-600' : 'text-gray-600 dark:text-zinc-300'"
              >
                {{ isEnded ? "Auction Ended" : `Ends in ${timeLeft}` }}
              </p>
              <p
                v-if="antiSnipeActive && !isEnded"
                class="text-xs text-orange-600 font-medium mt-1"
              >
                ⚡ Anti-snipe active — time extended
              </p>
            </div>

            <!-- Must be logged in -->
            <div v-if="!user && !isEnded" class="mt-4 text-center">
              <p class="text-gray-500 dark:text-zinc-400 text-sm mb-3">Sign in to place a bid</p>
              <button
                @click="signInWithGoogle"
                class="bg-gray-900 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
              >
                Sign in with Google
              </button>
            </div>

            <!-- Seller cannot bid -->
            <div
              v-else-if="user && !isEnded && isSeller"
              class="mt-4 text-center"
            >
              <p class="text-gray-500 dark:text-zinc-400 text-sm">
                You cannot bid on your own listing.
              </p>
            </div>

            <!-- Bid Form -->
            <div
              v-else-if="user && !isEnded && !isSeller"
              class="mt-4 space-y-4"
            >
              <!-- Leading bidder message -->
              <div
                v-if="isLeadingBidder"
                class="bg-green-50 border border-green-200 rounded-lg p-4 text-center"
              >
                <p class="text-green-700 font-medium text-sm">
                  ✓ You're the highest bidder!
                </p>
                <p class="text-green-600 text-xs mt-1">
                  You'll be notified if someone outbids you.
                </p>
              </div>

              <template v-else>
                <div
                  class="flex rounded-lg overflow-hidden border border-gray-300 dark:border-white/[0.10]"
                >
                  <button
                    @click="bidMode = 'manual'"
                    class="flex-1 py-2 text-sm font-medium transition-colors"
                    :class="
                      bidMode === 'manual'
                        ? 'bg-pokemon-red text-white'
                        : 'bg-gray-50 dark:bg-white/[0.02] text-gray-600 dark:text-zinc-300'
                    "
                  >
                    Bid
                  </button>
                  <button
                    @click="bidMode = 'auto'"
                    class="flex-1 py-2 text-sm font-medium transition-colors"
                    :class="
                      bidMode === 'auto'
                        ? 'bg-pokemon-red text-white'
                        : 'bg-gray-50 dark:bg-white/[0.02] text-gray-600 dark:text-zinc-300'
                    "
                  >
                    Auto Bid
                  </button>
                </div>

                <!-- Manual — single button at next increment -->
                <div v-if="bidMode === 'manual'" class="space-y-3">
                  <div class="text-center bg-gray-50 dark:bg-white/[0.02] rounded-lg py-3">
                    <p class="text-xs text-gray-500 dark:text-zinc-400">Your bid will be</p>
                    <p class="text-2xl font-bold text-pokemon-red">
                      RM {{ minBidAmount.toFixed(2) }}
                    </p>
                    <p class="text-xs text-gray-400 dark:text-zinc-500 mt-1">
                      Current RM {{ auction.currentPrice.toFixed(2) }} + RM
                      {{ (auction.minIncrement || 1).toFixed(2) }} increment
                    </p>
                  </div>
                  <button
                    @click="handleQuickBid"
                    :disabled="bidding"
                    class="w-full bg-pokemon-red text-white py-3 rounded-lg font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {{
                      bidding
                        ? "Placing Bid..."
                        : `Bid RM ${minBidAmount.toFixed(2)}`
                    }}
                  </button>
                </div>

                <!-- Auto -->
                <div v-else class="space-y-3">
                  <div class="bg-blue-50 rounded-lg p-3 text-xs text-gray-600 dark:text-zinc-300">
                    Set your maximum. The system bids the minimum increment on
                    your behalf up to your max.
                  </div>
                  <div>
                    <label class="block text-xs text-gray-500 dark:text-zinc-400 mb-1"
                      >Max Bid (min RM {{ minBidAmount.toFixed(2) }})</label
                    >
                    <input
                      v-model.number="autoBidMax"
                      type="number"
                      :min="minBidAmount"
                      step="0.01"
                      :placeholder="(minBidAmount + 10).toFixed(2)"
                      class="w-full border border-gray-300 dark:border-white/[0.10] rounded-lg px-4 py-2 text-gray-900 dark:text-zinc-100 placeholder-gray-400 focus:border-pokemon-blue focus:outline-none focus:ring-1 focus:ring-pokemon-blue"
                    />
                  </div>
                  <button
                    @click="handleAutoBid"
                    :disabled="bidding"
                    class="w-full bg-pokemon-blue text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {{ bidding ? "Setting Auto Bid..." : "Set Auto Bid" }}
                  </button>
                </div>

                <p v-if="bidError" class="text-red-500 text-sm text-center">
                  {{ bidError }}
                </p>
                <p v-if="bidSuccess" class="text-green-600 text-sm text-center">
                  {{ bidSuccess }}
                </p>
              </template>
            </div>

            <!-- Winner -->
            <div
              v-if="isEnded && bids.length > 0"
              class="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4 text-center"
            >
              <p class="text-xs text-gray-500 dark:text-zinc-400">Winner</p>
              <NuxtLink
                :to="`/profile/${bids[0].bidderUid}`"
                class="font-bold text-amber-700 text-lg hover:underline"
              >
                {{ bids[0].bidder }}
              </NuxtLink>
              <p class="text-sm text-gray-600 dark:text-zinc-300">
                Final: RM {{ bids[0].amount.toFixed(2) }}
              </p>
              <div
                v-if="isSeller"
                class="mt-3 pt-3 border-t border-amber-200 space-y-2"
              >
                <a
                  :href="winnerWhatsappLink"
                  target="_blank"
                  rel="noopener"
                  class="w-full inline-flex items-center justify-center gap-2 bg-green-500 text-white text-sm py-2.5 rounded-lg font-medium hover:bg-green-600 transition-colors"
                >
                  <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path
                      d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"
                    />
                  </svg>
                  Contact Buyer
                </a>
                <NuxtLink
                  :to="`/profile/${bids[0].bidderUid}`"
                  class="block text-center text-xs text-amber-700 hover:underline"
                >
                  View buyer profile →
                </NuxtLink>
              </div>
            </div>

            <div
              v-if="isEnded && bids.length === 0"
              class="mt-4 bg-gray-100 dark:bg-white/[0.04] rounded-lg p-3 text-center"
            >
              <p class="text-sm text-gray-500 dark:text-zinc-400">Auction ended with no bids.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute();
const auctionId = route.params.id as string;

const { auction, bids, loading, placeBid, setAutoBid } =
  useAuctionDetail(auctionId);
const { user, signInWithGoogle } = useAuth();
const { profile: myProfile } = useMyProfile();

// Image gallery
const activeImageIndex = ref(0);
const scrollContainer = ref<HTMLElement | null>(null);

const allImages = computed(() => {
  if (!auction.value) return [];
  if (auction.value.imageUrls && auction.value.imageUrls.length > 0)
    return auction.value.imageUrls;
  return auction.value.imageUrl ? [auction.value.imageUrl] : [];
});

const scrollToImage = (index: number) => {
  activeImageIndex.value = index;
  nextTick(() => {
    if (!scrollContainer.value) return;
    scrollContainer.value.scrollTo({ left: index * scrollContainer.value.offsetWidth, behavior: "smooth" });
  });
};

const onImageScroll = () => {
  if (!scrollContainer.value) return;
  activeImageIndex.value = Math.round(scrollContainer.value.scrollLeft / scrollContainer.value.offsetWidth);
};

const prevImage = () => scrollToImage(Math.max(0, activeImageIndex.value - 1));
const nextImage = () => scrollToImage(Math.min(allImages.value.length - 1, activeImageIndex.value + 1));

const isSeller = computed(
  () =>
    user.value && auction.value && auction.value.sellerUid === user.value.uid,
);

const isLeadingBidder = computed(() => {
  if (!user.value || !bids.value.length) return false;
  return bids.value[0].bidderUid === user.value.uid;
});

const antiSnipeActive = computed(
  () => auction.value && (auction.value as any).antiSnipeTriggered,
);

const bidMode = ref<"manual" | "auto">("manual");
const autoBidMax = ref<number | null>(null);
const bidding = ref(false);
const bidError = ref("");
const bidSuccess = ref("");

const minBidAmount = computed(() => {
  if (!auction.value) return 0;
  return auction.value.currentPrice + (auction.value.minIncrement || 1);
});

const timeLeft = ref("");
const isEnded = ref(false);
let timer: ReturnType<typeof setInterval>;

const updateTimer = () => {
  if (!auction.value) return;
  const diff = auction.value.endsAt - Date.now();
  if (diff <= 0) {
    isEnded.value = true;
    timeLeft.value = "Ended";
    clearInterval(timer);
    return;
  }
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    timeLeft.value = `${days}d ${hours % 24}h ${minutes}m`;
  } else {
    timeLeft.value = `${hours}h ${minutes}m ${seconds}s`;
  }
};

watch(auction, () => updateTimer(), { immediate: true });
onMounted(() => {
  timer = setInterval(updateTimer, 1000);
});
onUnmounted(() => {
  clearInterval(timer);
});

// Play notification sound when a new bid arrives
const prevBidCount = ref(0);

const playBidSound = () => {
  try {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    oscillator.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.3);
  } catch {}
};

watch(
  bids,
  (newBids: any[]) => {
    if (prevBidCount.value > 0 && newBids.length > prevBidCount.value) {
      // Only play sound if the new bid is NOT from the current user
      const latestBid = newBids[0]; // bids are sorted by amount desc
      if (!user.value || latestBid.bidderUid !== user.value.uid) {
        playBidSound();
      }
    }
    prevBidCount.value = newBids.length;
  },
  { immediate: true },
);

const handleQuickBid = async () => {
  bidError.value = "";
  bidSuccess.value = "";
  bidding.value = true;
  try {
    await placeBid(
      user.value!.uid,
      myProfile.value?.customName || user.value!.displayName || "Anonymous",
      minBidAmount.value,
    );
    bidSuccess.value = `Bid placed: RM ${minBidAmount.value.toFixed(2)}`;
  } catch (e: any) {
    bidError.value = e.message || "Failed to place bid";
  } finally {
    bidding.value = false;
  }
};

const handleAutoBid = async () => {
  bidError.value = "";
  bidSuccess.value = "";
  if (!autoBidMax.value || autoBidMax.value < minBidAmount.value) {
    bidError.value = `Max bid must be at least RM ${minBidAmount.value.toFixed(2)}`;
    return;
  }
  bidding.value = true;
  try {
    await setAutoBid(
      user.value!.uid,
      myProfile.value?.customName || user.value!.displayName || "Anonymous",
      autoBidMax.value,
    );
    bidSuccess.value = `Auto bid set! Max: RM ${autoBidMax.value.toFixed(2)}`;
    autoBidMax.value = null;
  } catch (e: any) {
    bidError.value = e.message || "Failed to set auto bid";
  } finally {
    bidding.value = false;
  }
};

const formatTime = (timestamp: number) => new Date(timestamp).toLocaleString();

// Winner WhatsApp link
const winnerPhone = ref("");

const fetchWinnerPhone = async () => {
  if (!bids.value.length) return;
  const winnerUid = bids.value[0].bidderUid;
  try {
    const { doc, getDoc } = await import("firebase/firestore");
    const { firestore } = useFirebase();
    const userDoc = await getDoc(doc(firestore!, "users", winnerUid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      winnerPhone.value = (data.whatsappNumber || data.phone || "") as string;
    }
  } catch {}
};

watch(
  () => isEnded.value && bids.value.length > 0,
  (ready: any) => {
    if (ready) fetchWinnerPhone();
  },
  { immediate: true },
);

const winnerWhatsappLink = computed(() => {
  if (!auction.value || !bids.value.length) return "#";
  let cleanPhone = winnerPhone.value.replace(/[^0-9]/g, "");
  if (cleanPhone.startsWith("0")) {
    cleanPhone = "60" + cleanPhone.slice(1);
  }
  const message = encodeURIComponent(
    `Hi ${bids.value[0].bidder}, you won the auction for ${auction.value.cardName} at RM ${auction.value.currentPrice.toFixed(2)} on TCGo Marketplace. Let's arrange the deal!`,
  );
  if (cleanPhone) {
    return `https://wa.me/${cleanPhone}?text=${message}`;
  }
  return `https://wa.me/?text=${message}`;
});
</script>
