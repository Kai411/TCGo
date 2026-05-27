import {
  ref as dbRef,
  push,
  onValue,
  update,
  get,
  set,
  increment as rtdbIncrement,
  type Unsubscribe as RtdbUnsubscribe,
} from "firebase/database";
import {
  collection,
  doc,
  addDoc,
  onSnapshot,
  getDoc,
} from "firebase/firestore";
import { ref, computed, onUnmounted } from "vue";

// ── Types ─────────────────────────────────────────────────────────────────────

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
  language?: string;
  tcgType?: string;
  rarity?: string;
  variant?: string;
  edition?: string;
  era?: string;
  artist?: string;
  certNumber?: string;
  tags?: string[];
  defects?: string[];
  negotiable?: boolean;
  pickupAvailable?: boolean;
  quantity?: number;
  status?: "active" | "reserved" | "pending_payment" | "sold" | "cancelled" | "expired";
  viewCount?: number;
  // From RTDB auction_summaries (merged in at read time)
  bidCount?: number;
  antiSnipeTriggered?: boolean;
  topBidderUid?: string;
  topBidder?: string;
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

// auction_summaries/{id} — the lightweight RTDB node used by list views.
// Contains only derived/live fields; static product data lives in Firestore.
interface AuctionSummary {
  currentPrice: number;
  endsAt: number;
  bidCount: number;
  antiSnipeTriggered?: boolean;
  topBidderUid?: string;
  topBidder?: string;
}

// ── Singleton list state ───────────────────────────────────────────────────────

const firestoreAuctions = ref<any[]>([]);
const summaries = ref<Record<string, AuctionSummary>>({});
const loading = ref(true);
let initialized = false;
let unsubFirestoreList: (() => void) | null = null;
let unsubSummaries: RtdbUnsubscribe | null = null;

const initializeAuctions = () => {
  if (initialized) return;
  initialized = true;
  const { firestore, db } = useFirebase();

  unsubFirestoreList = onSnapshot(collection(firestore!, "auctions"), (snap) => {
    firestoreAuctions.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    loading.value = false;
  });

  // Lightweight: no bids/autoBids here, just price + meta
  unsubSummaries = onValue(dbRef(db!, "auction_summaries"), (snap) => {
    summaries.value = snap.val() || {};
  });
};

const auctions = computed<Auction[]>(() =>
  firestoreAuctions.value.map((a) => {
    const s = summaries.value[a.id];
    return {
      ...a,
      currentPrice: s?.currentPrice ?? a.startingPrice,
      endsAt: s?.endsAt ?? a.endsAt,
      bidCount: s?.bidCount ?? 0,
      antiSnipeTriggered: s?.antiSnipeTriggered,
      topBidderUid: s?.topBidderUid,
      topBidder: s?.topBidder,
    };
  }),
);

// ── useAuctions ───────────────────────────────────────────────────────────────

export const useAuctions = () => {
  initializeAuctions();
  const { firestore, db } = useFirebase();

  const createAuction = async (
    auction: Omit<Auction, "id" | "currentPrice" | "createdAt" | "bidCount" | "antiSnipeTriggered" | "topBidderUid" | "topBidder">,
  ) => {
    const { startingPrice, endsAt } = auction;

    // Product data — Firestore (queryable, indexed, rarely changes)
    const docRef = await addDoc(collection(firestore!, "auctions"), {
      ...auction,
      createdAt: Date.now(),
    });
    const id = docRef.id;

    // Live bid state — RTDB (real-time, high-frequency writes)
    await set(dbRef(db!, `auction_summaries/${id}`), {
      currentPrice: startingPrice,
      endsAt,
      bidCount: 0,
    });

    return id;
  };

  return { auctions, loading, createAuction };
};

// ── useUserBidIndex ───────────────────────────────────────────────────────────
//
// Per-user index of auctions they have bid on.
// Shape: user_bid_index/{uid}/{auctionId}: { highestBid: number }

export const useUserBidIndex = (uid: string) => {
  const { db } = useFirebase();
  const bidIndex = ref<Record<string, { highestBid: number }>>({});

  const unsub = onValue(dbRef(db!, `user_bid_index/${uid}`), (snap) => {
    bidIndex.value = snap.val() || {};
  });

  onUnmounted(() => unsub());

  return { bidIndex };
};

// ── useAuctionDetail ──────────────────────────────────────────────────────────

export const useAuctionDetail = (auctionId: string) => {
  const { firestore, db } = useFirebase();

  const productData = ref<any | null>(null);
  const summary = ref<AuctionSummary | null>(null);
  const bids = ref<Bid[]>([]);
  const loading = ref(true);

  const auction = computed<Auction | null>(() => {
    if (!productData.value) return null;
    return {
      ...productData.value,
      currentPrice: summary.value?.currentPrice ?? productData.value.startingPrice,
      endsAt: summary.value?.endsAt ?? productData.value.endsAt,
      bidCount: summary.value?.bidCount ?? 0,
      antiSnipeTriggered: summary.value?.antiSnipeTriggered,
      topBidderUid: summary.value?.topBidderUid,
      topBidder: summary.value?.topBidder,
    };
  });

  const unsubProduct = onSnapshot(doc(firestore!, "auctions", auctionId), (snap) => {
    productData.value = snap.exists() ? { id: snap.id, ...snap.data() } : null;
    loading.value = false;
  });

  const unsubSummary = onValue(dbRef(db!, `auction_summaries/${auctionId}`), (snap) => {
    summary.value = snap.val();
  });

  const unsubBids = onValue(dbRef(db!, `auction_bids/${auctionId}/bids`), (snap) => {
    const data = snap.val();
    bids.value = data
      ? Object.entries(data)
          .map(([id, bid]) => ({ ...(bid as Bid), id }))
          .sort((a, b) => b.amount - a.amount)
      : [];
  });

  onUnmounted(() => {
    unsubProduct();
    unsubSummary();
    unsubBids();
  });

  // ── Internal helpers ─────────────────────────────────────────────────────────

  const writeBidSummary = async (
    bidderUid: string,
    bidder: string,
    amount: number,
    isAntiSnipe: boolean,
    currentEndsAt: number,
  ) => {
    const summaryUpdate: Record<string, any> = {
      currentPrice: amount,
      bidCount: rtdbIncrement(1),
      topBidderUid: bidderUid,
      topBidder: bidder,
    };
    if (isAntiSnipe) {
      summaryUpdate.endsAt = currentEndsAt + 60000;
      summaryUpdate.antiSnipeTriggered = true;
    }
    await update(dbRef(db!, `auction_summaries/${auctionId}`), summaryUpdate);
  };

  const recordUserBid = async (bidderUid: string, amount: number) => {
    await set(dbRef(db!, `user_bid_index/${bidderUid}/${auctionId}`), {
      highestBid: amount,
    });
  };

  // ── placeBid ─────────────────────────────────────────────────────────────────

  const placeBid = async (bidderUid: string, bidder: string, amount: number) => {
    if (!auction.value) return;

    const userSnap = await getDoc(doc(firestore!, "users", bidderUid));
    const userData = userSnap.exists() ? userSnap.data() : null;
    if (!userData?.phone && !userData?.whatsappNumber) {
      throw new Error("Please add your contact number in your Profile before bidding.");
    }
    if ((userData?.trustScore ?? 100) < 60) {
      throw new Error("Your trust score is too low to bid. Contact support if you believe this is an error.");
    }

    const minIncrement = auction.value.minIncrement || 1;
    const minBid = auction.value.currentPrice + minIncrement;
    if (amount < minBid) {
      throw new Error(`Bid must be at least RM ${minBid.toFixed(2)} (current + RM ${minIncrement.toFixed(2)} increment)`);
    }

    const currentEndsAt = auction.value.endsAt;
    if (Date.now() > currentEndsAt) throw new Error("Auction has ended");

    const timeLeft = currentEndsAt - Date.now();
    const isAntiSnipe = timeLeft <= 60000;

    await push(dbRef(db!, `auction_bids/${auctionId}/bids`), {
      bidder, bidderUid, amount,
      timestamp: Date.now(),
      isAutoBid: false,
      triggeredAntiSnipe: isAntiSnipe,
    });

    await writeBidSummary(bidderUid, bidder, amount, isAntiSnipe, currentEndsAt);
    await recordUserBid(bidderUid, amount);
    await processAutoBids(auctionId, bidderUid, amount);
  };

  // ── setAutoBid ───────────────────────────────────────────────────────────────

  const setAutoBid = async (bidderUid: string, bidder: string, maxAmount: number) => {
    if (!auction.value) return;

    const userSnap = await getDoc(doc(firestore!, "users", bidderUid));
    const userData = userSnap.exists() ? userSnap.data() : null;
    if (!userData?.phone && !userData?.whatsappNumber) {
      throw new Error("Please add your contact number in your Profile before bidding.");
    }
    if ((userData?.trustScore ?? 100) < 60) {
      throw new Error("Your trust score is too low to bid. Contact support if you believe this is an error.");
    }

    const minIncrement = auction.value.minIncrement || 1;
    const minBid = auction.value.currentPrice + minIncrement;
    if (maxAmount < minBid) {
      throw new Error(`Max bid must be at least RM ${minBid.toFixed(2)}`);
    }

    const currentEndsAt = auction.value.endsAt;
    if (Date.now() > currentEndsAt) throw new Error("Auction has ended");

    await push(dbRef(db!, `auction_bids/${auctionId}/autoBids`), {
      bidderUid, bidder, maxAmount, createdAt: Date.now(),
    });

    const bidAmount = Math.min(maxAmount, minBid);
    const timeLeft = currentEndsAt - Date.now();
    const isAntiSnipe = timeLeft <= 60000;

    await push(dbRef(db!, `auction_bids/${auctionId}/bids`), {
      bidder, bidderUid, amount: bidAmount,
      timestamp: Date.now(),
      isAutoBid: true,
      triggeredAntiSnipe: isAntiSnipe,
    });

    await writeBidSummary(bidderUid, bidder, bidAmount, isAntiSnipe, currentEndsAt);
    await recordUserBid(bidderUid, bidAmount);
    await processAutoBids(auctionId, bidderUid, bidAmount);
  };

  // ── processAutoBids ──────────────────────────────────────────────────────────

  const processAutoBids = async (
    auctionId: string,
    triggerUid: string,
    currentAmount: number,
  ) => {
    const [bidsSnap, summarySnap] = await Promise.all([
      get(dbRef(db!, `auction_bids/${auctionId}`)),
      get(dbRef(db!, `auction_summaries/${auctionId}`)),
    ]);

    const bidsData = bidsSnap.val();
    const summaryData = summarySnap.val() as AuctionSummary | null;
    if (!bidsData?.autoBids || !summaryData) return;

    const minIncrement = productData.value?.minIncrement || 1;
    const currentEndsAt = summaryData.endsAt;
    let price = currentAmount;

    const allAutoBids = Object.values(bidsData.autoBids) as AutoBid[];
    const userMaxBids = new Map<string, AutoBid>();
    for (const ab of allAutoBids) {
      const existing = userMaxBids.get(ab.bidderUid);
      if (!existing || ab.maxAmount > existing.maxAmount) {
        userMaxBids.set(ab.bidderUid, ab);
      }
    }

    const competitors = Array.from(userMaxBids.values())
      .filter((ab) => ab.bidderUid !== triggerUid && ab.maxAmount > price)
      .sort((a, b) => b.maxAmount - a.maxAmount);

    if (competitors.length === 0) return;

    const topCompetitor = competitors[0];
    const triggerAutoBid = userMaxBids.get(triggerUid);

    let newPrice: number;
    let winner: AutoBid;

    if (triggerAutoBid && triggerAutoBid.maxAmount > price) {
      const lowerMax = Math.min(topCompetitor.maxAmount, triggerAutoBid.maxAmount);
      winner = topCompetitor.maxAmount >= triggerAutoBid.maxAmount ? topCompetitor : triggerAutoBid;
      newPrice = Math.min(lowerMax + minIncrement, winner.maxAmount);
    } else {
      winner = topCompetitor;
      newPrice = Math.min(price + minIncrement, topCompetitor.maxAmount);
    }

    const isAntiSnipe = currentEndsAt - Date.now() <= 60000;
    await push(dbRef(db!, `auction_bids/${auctionId}/bids`), {
      bidder: winner.bidder,
      bidderUid: winner.bidderUid,
      amount: newPrice,
      timestamp: Date.now(),
      isAutoBid: true,
      triggeredAntiSnipe: isAntiSnipe,
    });

    await writeBidSummary(winner.bidderUid, winner.bidder, newPrice, isAntiSnipe, currentEndsAt);
    await recordUserBid(winner.bidderUid, newPrice);
  };

  return { auction, bids, loading, placeBid, setAutoBid };
};
