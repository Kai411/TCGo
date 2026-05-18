import { ref as dbRef, push, onValue, update, get } from "firebase/database";
import { doc, getDoc } from "firebase/firestore";
import { ref, onUnmounted } from "vue";

export interface Auction {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  imageUrls: string[];
  cardName: string;
  cardSet: string;
  cardNumber: string;
  productType: string;
  condition: string;
  gradingProvider: string;
  grade: string;
  customGradingProvider: string;
  shippingWM: number;
  shippingEM: number;
  startingPrice: number;
  currentPrice: number;
  minIncrement: number;
  seller: string;
  sellerUid: string;
  endsAt: number;
  createdAt: number;
  isPrivate: boolean;
  bids: Record<string, Bid>;
  autoBids: Record<string, AutoBid>;
}

export interface Bid {
  id?: string;
  bidder: string;
  bidderUid: string;
  amount: number;
  timestamp: number;
  isAutoBid: boolean;
  triggeredAntiSnipe?: boolean;
}

export interface AutoBid {
  id?: string;
  bidderUid: string;
  bidder: string;
  maxAmount: number;
  createdAt: number;
}

export const useAuctions = () => {
  const { db } = useFirebase();
  const auctions = ref<Auction[]>([]);
  const loading = ref(true);

  const auctionsRef = dbRef(db!, "auctions");

  const unsubscribe = onValue(auctionsRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      auctions.value = Object.entries(data).map(([id, auction]) => ({
        ...(auction as Omit<Auction, "id">),
        id,
      }));
    } else {
      auctions.value = [];
    }
    loading.value = false;
  });

  onUnmounted(() => {
    unsubscribe();
  });

  const createAuction = async (
    auction: Omit<
      Auction,
      "id" | "bids" | "autoBids" | "currentPrice" | "createdAt"
    >,
  ) => {
    const newAuction = {
      ...auction,
      currentPrice: auction.startingPrice,
      createdAt: Date.now(),
      bids: {},
      autoBids: {},
    };
    const result = await push(auctionsRef, newAuction);
    return result.key;
  };

  return { auctions, loading, createAuction };
};

export const useAuctionDetail = (auctionId: string) => {
  const { db } = useFirebase();
  const auction = ref<Auction | null>(null);
  const bids = ref<Bid[]>([]);
  const loading = ref(true);

  const auctionRef = dbRef(db!, `auctions/${auctionId}`);

  const unsubscribe = onValue(auctionRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      auction.value = { ...data, id: auctionId };
      if (data.bids) {
        bids.value = Object.entries(data.bids)
          .map(([id, bid]) => ({ ...(bid as Bid), id }))
          .sort((a, b) => b.amount - a.amount);
      } else {
        bids.value = [];
      }
    }
    loading.value = false;
  });

  onUnmounted(() => {
    unsubscribe();
  });

  const placeBid = async (
    bidderUid: string,
    bidder: string,
    amount: number,
  ) => {
    if (!auction.value) return;

    // Require phone number to bid
    const { firestore: fs } = useFirebase();
    const userDoc = await getDoc(doc(fs!, "users", bidderUid));
    const userData = userDoc.exists() ? userDoc.data() : null;
    if (!userData?.phone && !userData?.whatsappNumber) {
      throw new Error(
        "Please add your contact number in your Profile before bidding.",
      );
    }

    // Check trust score
    const trustScore = userData?.trustScore ?? 100;
    if (trustScore < 60) {
      throw new Error(
        "Your trust score is too low to bid. Contact support if you believe this is an error.",
      );
    }

    const minIncrement = auction.value.minIncrement || 1;
    const minBid = auction.value.currentPrice + minIncrement;

    if (amount < minBid) {
      throw new Error(
        `Bid must be at least RM ${minBid.toFixed(2)} (current + RM ${minIncrement.toFixed(2)} increment)`,
      );
    }

    if (Date.now() > auction.value.endsAt) {
      throw new Error("Auction has ended");
    }

    // Place the bid
    const bidsRef = dbRef(db!, `auctions/${auctionId}/bids`);
    const timeLeft = auction.value.endsAt - Date.now();
    const isAntiSnipe = timeLeft <= 60000;

    const newBid: Bid = {
      bidder,
      bidderUid,
      amount,
      timestamp: Date.now(),
      isAutoBid: false,
      triggeredAntiSnipe: isAntiSnipe,
    };
    await push(bidsRef, newBid);

    // Anti-snipe: if bid is within last 60 seconds, extend by 60 seconds
    const updateData: Record<string, any> = { currentPrice: amount };
    if (isAntiSnipe) {
      updateData.endsAt = auction.value.endsAt + 60000;
      updateData.antiSnipeTriggered = true;
    }
    await update(dbRef(db!, `auctions/${auctionId}`), updateData);

    // Trigger auto-bid responses
    await processAutoBids(auctionId, bidderUid, amount);
  };

  const setAutoBid = async (
    bidderUid: string,
    bidder: string,
    maxAmount: number,
  ) => {
    if (!auction.value) return;

    // Require phone number to bid
    const { firestore: fs } = useFirebase();
    const userDoc = await getDoc(doc(fs!, "users", bidderUid));
    const userData = userDoc.exists() ? userDoc.data() : null;
    if (!userData?.phone && !userData?.whatsappNumber) {
      throw new Error(
        "Please add your contact number in your Profile before bidding.",
      );
    }

    // Check trust score
    const userTrustScore = userData?.trustScore ?? 100;
    if (userTrustScore < 60) {
      throw new Error(
        "Your trust score is too low to bid. Contact support if you believe this is an error.",
      );
    }

    const minIncrement = auction.value.minIncrement || 1;
    const minBid = auction.value.currentPrice + minIncrement;

    if (maxAmount < minBid) {
      throw new Error(`Max bid must be at least RM ${minBid.toFixed(2)}`);
    }

    if (Date.now() > auction.value.endsAt) {
      throw new Error("Auction has ended");
    }

    // Save auto-bid config
    const autoBidsRef = dbRef(db!, `auctions/${auctionId}/autoBids`);
    await push(autoBidsRef, {
      bidderUid,
      bidder,
      maxAmount,
      createdAt: Date.now(),
    });

    // Immediately place a bid at the minimum required amount
    const bidsRef = dbRef(db!, `auctions/${auctionId}/bids`);
    const bidAmount = Math.min(maxAmount, minBid);
    const timeLeft = auction.value.endsAt - Date.now();
    const isAntiSnipe = timeLeft <= 60000;

    const newBid: Bid = {
      bidder,
      bidderUid,
      amount: bidAmount,
      timestamp: Date.now(),
      isAutoBid: true,
      triggeredAntiSnipe: isAntiSnipe,
    };
    await push(bidsRef, newBid);

    // Anti-snipe: if bid is within last 60 seconds, extend by 60 seconds
    const updateData: Record<string, any> = { currentPrice: bidAmount };
    if (isAntiSnipe) {
      updateData.endsAt = auction.value.endsAt + 60000;
      updateData.antiSnipeTriggered = true;
    }
    await update(dbRef(db!, `auctions/${auctionId}`), updateData);

    // Process other auto-bids in response
    await processAutoBids(auctionId, bidderUid, bidAmount);
  };

  const processAutoBids = async (
    auctionId: string,
    triggerUid: string,
    currentAmount: number,
  ) => {
    // Fetch latest auction state
    const snapshot = await get(dbRef(db!, `auctions/${auctionId}`));
    const data = snapshot.val();
    if (!data || !data.autoBids) return;

    const minIncrement = data.minIncrement || 1;
    let price = currentAmount;

    // Get all auto-bids sorted by maxAmount descending
    const allAutoBids = Object.values(data.autoBids) as AutoBid[];

    // Group by user, keep highest max for each user
    const userMaxBids = new Map<string, AutoBid>();
    for (const ab of allAutoBids) {
      const existing = userMaxBids.get(ab.bidderUid);
      if (!existing || ab.maxAmount > existing.maxAmount) {
        userMaxBids.set(ab.bidderUid, ab);
      }
    }

    // Find competing auto-bidders (not the one who just bid)
    const competitors = Array.from(userMaxBids.values())
      .filter((ab) => ab.bidderUid !== triggerUid && ab.maxAmount > price)
      .sort((a, b) => b.maxAmount - a.maxAmount);

    if (competitors.length === 0) return;

    // The highest competing auto-bidder responds
    const topCompetitor = competitors[0];
    const triggerAutoBid = userMaxBids.get(triggerUid);

    let newPrice: number;

    if (triggerAutoBid && triggerAutoBid.maxAmount > price) {
      // Both have auto-bids — bid up to the loser's max + increment
      const lowerMax = Math.min(
        topCompetitor.maxAmount,
        triggerAutoBid.maxAmount,
      );
      const higherBidder =
        topCompetitor.maxAmount >= triggerAutoBid.maxAmount
          ? topCompetitor
          : triggerAutoBid;
      newPrice = Math.min(lowerMax + minIncrement, higherBidder.maxAmount);

      const bidsRef = dbRef(db!, `auctions/${auctionId}/bids`);
      await push(bidsRef, {
        bidder: higherBidder.bidder,
        bidderUid: higherBidder.bidderUid,
        amount: newPrice,
        timestamp: Date.now(),
        isAutoBid: true,
        triggeredAntiSnipe: (data.endsAt || 0) - Date.now() <= 60000,
      });

      // Anti-snipe for auto-bids
      const autoUpdateData: Record<string, any> = { currentPrice: newPrice };
      const endsAt = data.endsAt || 0;
      if (endsAt - Date.now() <= 60000) {
        autoUpdateData.endsAt = endsAt + 60000;
        autoUpdateData.antiSnipeTriggered = true;
      }
      await update(dbRef(db!, `auctions/${auctionId}`), autoUpdateData);
    } else {
      // Only competitor has auto-bid, respond with minimum increment
      newPrice = Math.min(price + minIncrement, topCompetitor.maxAmount);

      const bidsRef = dbRef(db!, `auctions/${auctionId}/bids`);
      await push(bidsRef, {
        bidder: topCompetitor.bidder,
        bidderUid: topCompetitor.bidderUid,
        amount: newPrice,
        timestamp: Date.now(),
        isAutoBid: true,
        triggeredAntiSnipe: (data.endsAt || 0) - Date.now() <= 60000,
      });

      // Anti-snipe for auto-bids
      const autoUpdateData2: Record<string, any> = { currentPrice: newPrice };
      const endsAt2 = data.endsAt || 0;
      if (endsAt2 - Date.now() <= 60000) {
        autoUpdateData2.endsAt = endsAt2 + 60000;
        autoUpdateData2.antiSnipeTriggered = true;
      }
      await update(dbRef(db!, `auctions/${auctionId}`), autoUpdateData2);
    }
  };

  return { auction, bids, loading, placeBid, setAutoBid };
};
