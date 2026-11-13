import {
  ref as dbRef,
  onValue,
  type Unsubscribe as RtdbUnsubscribe,
} from "firebase/database";
import {
  collection,
  doc,
  addDoc,
  onSnapshot,
} from "firebase/firestore";
import { ref, computed, onUnmounted } from "vue";
import type { AuctionStatus } from "~/shared/auctions";

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
  status?: AuctionStatus;
  viewCount?: number;
  // ── Settlement (written by /api/auctions/settle) ──────────────────────
  orderId?: string; // compiled order the winner pays
  winnerUid?: string;
  winnerName?: string;
  winningBid?: number;
  endedAt?: number;
  paymentDueAt?: number; // winner must pay before this or the result is voided
  soldAt?: number;
  expiredAt?: number;
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
  const { firestore } = useFirebase();

  const createAuction = async (
    auction: Omit<Auction, "id" | "currentPrice" | "createdAt" | "bidCount" | "antiSnipeTriggered" | "topBidderUid" | "topBidder">,
  ) => {
    // Product data — Firestore. The live price (auction_summaries in RTDB) is
    // written by the server on the first bid; until then pages show the
    // starting price and end time from this document.
    const docRef = await addDoc(collection(firestore!, "auctions"), {
      ...auction,
      createdAt: Date.now(),
    });
    return docRef.id;
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
  const rawBids = ref<Bid[]>([]);
  const loading = ref(true);

  // Highest first. Two bids can share an amount (equal maximums: the earlier
  // one wins), so on a tie the summary's leader goes first, which is what the
  // page shows as the top bidder and winner.
  const bids = computed<Bid[]>(() => {
    const top = summary.value?.topBidderUid;
    return [...rawBids.value].sort(
      (a, b) =>
        b.amount - a.amount ||
        Number(b.bidderUid === top) - Number(a.bidderUid === top) ||
        b.timestamp - a.timestamp,
    );
  });

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
    rawBids.value = data ? Object.entries(data).map(([id, bid]) => ({ ...(bid as Bid), id })) : [];
  });

  onUnmounted(() => {
    unsubProduct();
    unsubSummary();
    unsubBids();
  });

  // ── Bidding ──────────────────────────────────────────────────────────────
  // Every bid goes through the server, which checks who is bidding, runs
  // everyone's auto bids and writes the result. Browsers can only read it.
  // `leading` says whether the caller is on top once the auto bids have run.
  const sendBid = async (kind: "bid" | "auto", amount: number) => {
    try {
      return await useAuthedFetch().authedFetch<{ ok: true; leading: boolean; currentPrice: number; myMax: number | null }>(
        "/api/auctions/bid",
        { method: "POST", body: { auctionId, kind, amount } },
      );
    } catch (e: any) {
      throw new Error(e?.data?.message || e?.message || "Couldn't place the bid. Try again.");
    }
  };

  const placeBid = (amount: number) => sendBid("bid", amount);
  const setAutoBid = (maxAmount: number) => sendBid("auto", maxAmount);

  return { auction, bids, loading, placeBid, setAutoBid };
};
