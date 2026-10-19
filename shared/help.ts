// The Help guide under Account: topic groups that open short step-by-step
// articles.
//
// WRITTEN FROM WHAT THE APP DOES TODAY. Every step names a button or screen
// that exists, and every number that the app also enforces is imported from
// the module that enforces it, so the guide can't promise a window the code
// no longer has. When a flow changes, change its article here too.
//
// Two things are deliberately not here:
//   - Fee rates. They change with the plan; articles link to /pricing.
//   - Policy wording. Shipping, cancellation and dispute rules live in the
//     policy pages, and articles link to them rather than restating them.

import { AUCTION_PAYMENT_WINDOW_HOURS } from "~/shared/auctions";
import { CANCEL_GRACE_MINUTES } from "~/shared/order-windows";
import { CLAIM_WINDOW_DAYS, SELLER_REPLY_BUSINESS_DAYS } from "~/shared/order-problems";
import { PAYOUT_HOLD_DAYS } from "~/shared/payouts";
import { HIGH_VALUE_THRESHOLD } from "~/shared/photo-policy";

export interface HelpLink {
  to: string;
  label: string;
}

export interface HelpArticle {
  slug: string;
  title: string;
  /** One line under the title in the topic list. */
  summary: string;
  steps: string[];
  /** Setup a feature needs, or a rule worth knowing, shown after the steps. */
  notes?: string[];
  /** Where to go next: the screen itself, or the policy that governs it. */
  links?: HelpLink[];
}

export interface HelpTopic {
  id: string;
  title: string;
  articles: HelpArticle[];
}

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: "getting-started",
    title: "Getting started",
    articles: [
      {
        slug: "create-account",
        title: "Create your account",
        summary: "Sign up with Google or your email, then confirm it.",
        steps: [
          "Open the Account tab and tap Sign in.",
          "Tap Continue with Google, or create an account with your name, email and a password.",
          "Agree to the Terms of Use and the personal data consent. Google accounts are asked once, right after signing in.",
          "We email you a 6-digit code. Tap Enter code in the bar at the top of the screen and type it in.",
          "That's it. You can browse straight away; your delivery address is asked the first time you check out or bid.",
        ],
        notes: [
          "You need a confirmed email to buy, bid, sell or send messages. Browsing works without it.",
        ],
        links: [{ to: "/login", label: "Sign in or create an account" }],
      },
      {
        slug: "install-app",
        title: "Add TCGo to your Home Screen",
        summary: "Open TCGo like an app, no app store needed.",
        steps: [
          "On iPhone or iPad, open TCGo in Safari, tap the Share icon in the toolbar, scroll down and tap Add to Home Screen, then tap Add.",
          "On Android, tap Install TCGo when the prompt appears, or use Install app in Chrome's menu.",
          "Open TCGo from the new icon on your Home Screen from now on.",
        ],
        notes: [
          "On iPhone and iPad, notifications only work when TCGo is opened from the Home Screen icon.",
        ],
      },
      {
        slug: "find-cards",
        title: "Find cards",
        summary: "Search, filter and save cards you like.",
        steps: [
          "The Shop tab shows cards for sale and the Auctions tab shows live auctions.",
          "Tap the search bar at the top to search by card name, set or seller.",
          "Use Filters to narrow the list and Sort to change the order.",
          "Tap a card to see its photos, condition, price and seller.",
          "Tap the heart on a card to save it. Your saved cards are in Account, under Favourites.",
        ],
        links: [
          { to: "/", label: "Go to the Shop" },
          { to: "/account/favourites", label: "Your favourites" },
        ],
      },
    ],
  },
  {
    id: "buying",
    title: "Buying",
    articles: [
      {
        slug: "buy-a-card",
        title: "Buy a card",
        summary: "Add to cart or buy now, then pay online with FPX.",
        steps: [
          "On a listing, tap Add to cart to keep shopping, or Buy now to go straight to checkout.",
          "Open the cart. Tap Checkout all, or tick some items first to check out only those.",
          "Check your delivery address. Shipping is quoted live from each seller's location to your address.",
          "Items from the same seller become one order with one shipping fee. Items from different sellers become separate orders.",
          "Tap the button to place your orders, then pay each one online with FPX from your bank.",
        ],
        notes: [
          "Your payment is held until the card arrives. This is Buyer Protection, and it only covers orders paid through TCGo checkout.",
          "If a seller already has an unshipped order of yours, a new order from them can join the same parcel for less postage. Checkout tells you when this happens.",
        ],
        links: [
          { to: "/refund-policy", label: "How Buyer Protection works" },
          { to: "/account/addresses", label: "Shipping addresses" },
        ],
      },
      {
        slug: "addresses",
        title: "Manage delivery addresses",
        summary: "Save a few addresses and choose your default.",
        steps: [
          "Go to Account, then Shipping addresses.",
          "Add an address with the recipient's name, phone number and postcode. The state fills in from the postcode.",
          "Set the one you use most as the default. Checkout uses it unless you change it there.",
        ],
        links: [{ to: "/account/addresses", label: "Shipping addresses" }],
      },
    ],
  },
  {
    id: "auctions",
    title: "Auctions",
    articles: [
      {
        slug: "bid",
        title: "Bid on an auction",
        summary: "Bid the next step, or set a maximum and let TCGo bid for you.",
        steps: [
          "Open an auction from the Auctions tab.",
          "To bid once, tap Bid. Your bid is the current price plus the seller's minimum increment.",
          "To bid automatically, choose Auto Bid and set your maximum. TCGo bids the minimum increment for you, only as far as your maximum.",
          "The first time you bid, TCGo explains what a bid means. A bid is a promise to buy at that price if you win.",
          "If someone outbids you, we let you know (turn on notifications to get it on your phone).",
        ],
        notes: [
          "A bid in the last minute adds a minute to the clock, so there is always time to answer it.",
          "Private auctions can only be opened with their link.",
        ],
        links: [{ to: "/auctions", label: "Browse auctions" }],
      },
      {
        slug: "won-auction",
        title: "You won an auction",
        summary: `Pay within ${AUCTION_PAYMENT_WINDOW_HOURS} hours to complete the win.`,
        steps: [
          "Open the auction, or go to Account and tap Won.",
          "Tap Pay now (FPX). The seller's shipping fee is added to your winning price.",
          "After you pay, the order works like any other: you can follow it in My Orders.",
        ],
        notes: [
          `You have ${AUCTION_PAYMENT_WINDOW_HOURS} hours to pay. Not paying cancels the win and can get your bidding restricted.`,
          "An auction win can't be cancelled, because a bid is a commitment to buy.",
        ],
        links: [
          { to: "/activity?tab=won", label: "Auctions you won" },
          { to: "/refund-policy", label: "Refund Policy, including auctions" },
        ],
      },
    ],
  },
  {
    id: "selling",
    title: "Selling",
    articles: [
      {
        slug: "start-selling",
        title: "Set up selling",
        summary: "Four steps before you can list your first card.",
        steps: [
          "Tap Sell in the bottom bar, or Start selling on the Account page.",
          "Verify your identity with your MyKad and a selfie. Buyers then see a Verified badge on your profile.",
          "Add your contact details and pickup address. Couriers collect from it and shipping is quoted from it.",
          "Add the bank account your sales are paid into.",
          "Choose how you send parcels: drop off at a courier branch, or have the courier collect from you.",
        ],
        notes: [
          "You need a confirmed email to sell. You can change your pickup address, bank and handover choice later in Seller settings.",
        ],
        links: [
          { to: "/seller/onboarding", label: "Set up selling" },
          { to: "/seller-policy", label: "Seller Policy" },
          { to: "/pricing", label: "Pricing" },
        ],
      },
      {
        slug: "list-a-card",
        title: "List a card for sale",
        summary: "Scan or search the card, add photos and set your price.",
        steps: [
          "Tap Sell, then Sell a card.",
          "Tap Open scanner and photograph the card, or upload a photo. TCGo reads it and suggests matching prints; pick the right one.",
          "Choose Ungraded, Graded or Sealed, and set the condition or grade.",
          "Add up to 3 photos of your own card.",
          "Enter your price. TCGo shows its price guide for the card to help you decide.",
          "Optionally add what you paid. Only you see it; your dashboard uses it to show your margin.",
          "Submit to put the listing live in the Shop.",
        ],
        notes: [
          `Your own photo is required for graded and sealed items, for Mint or Near Mint claims, and for anything over RM${HIGH_VALUE_THRESHOLD}.`,
          "If your pickup address isn't set yet, the form asks for it before you can list.",
        ],
        links: [
          { to: "/seller/listings/new", label: "Sell a card" },
          { to: "/seller-policy", label: "Seller Policy" },
        ],
      },
      {
        slug: "start-auction",
        title: "Start an auction",
        summary: "Set a starting price, a minimum increment and how long it runs.",
        steps: [
          "Tap Sell, then Start an auction.",
          "Scan the card or add photos, as you would for a listing.",
          "Set the starting price and the minimum increment each bid must add.",
          "Choose how long it runs, from 1 hour to 7 days.",
          "Turn on Private auction if only people with the link should be able to bid.",
          "When it ends, the winner gets an order to pay. We notify you when they pay, and you ship it like any other order.",
        ],
        notes: [
          `If the winner doesn't pay within ${AUCTION_PAYMENT_WINDOW_HOURS} hours, the auction is voided.`,
        ],
        links: [{ to: "/seller/auctions/new", label: "Start an auction" }],
      },
      {
        slug: "ship-order",
        title: "Ship an order",
        summary: "Book the courier from the order, then hand the parcel over.",
        steps: [
          "Open Seller Dashboard, then Orders. Orders that need you are under To ship.",
          `Open the order and tap Book courier. It unlocks ${CANCEL_GRACE_MINUTES} minutes after payment, the window in which the buyer can still cancel.`,
          "Print the waybill and stick it on the parcel.",
          "Drop the parcel at the courier branch, or wait for the courier to collect it, depending on your handover choice.",
          "Once the courier has it, the order moves to In transit and the buyer can track it.",
        ],
        notes: [
          "If a buyer orders more from you before you've booked the courier, the new order can join the same parcel. TCGo joins it automatically when they pay.",
        ],
        links: [
          { to: "/seller/orders", label: "Your orders" },
          { to: "/seller-policy", label: "Seller Policy, including shipping" },
        ],
      },
      {
        slug: "get-paid",
        title: "Get paid",
        summary: "Request a payout once a sale's funds unlock.",
        steps: [
          "Open Seller Dashboard, then Funds.",
          `Money from online sales is held until the buyer has the card, plus ${PAYOUT_HOLD_DAYS} days in case they report a problem. Until then it shows as Locked.`,
          "When it shows as Available for payout, tap Request payout.",
          "The money goes to your bank account, usually on the next working day. Funds shows the status of each payout.",
        ],
        notes: [
          "Sales you make in person with the POS are paid to you directly, so they don't appear in Funds.",
          "Funds shows what a payout costs before you request it. Fees are explained on the Pricing page.",
        ],
        links: [
          { to: "/seller/funds", label: "Your funds" },
          { to: "/pricing", label: "Pricing" },
        ],
      },
      {
        slug: "inventory",
        title: "Manage your inventory",
        summary: "Track your stock, print QR labels and list from it.",
        steps: [
          "Open Seller Dashboard, then Inventory.",
          "Tap Add inventory to scan cards with your camera (a whole stack in one go) or add them by hand.",
          "Tap Bulk add to import a CSV or Excel file, or paste rows. TCGo matches each row to the catalogue.",
          "Tap Labels to print QR labels for thermal label printers. You scan them at the counter with the POS.",
          "Use the ⋯ menu on an item to list it for sale, mark it sold or remove it.",
        ],
        links: [
          { to: "/seller/items", label: "Your inventory" },
          { to: "/seller/import", label: "Bulk add" },
        ],
      },
      {
        slug: "pos",
        title: "Sell at your counter (POS)",
        summary: "Scan labels, take payment by DuitNow QR or cash.",
        steps: [
          "Open Seller Dashboard, then POS, and tap Start scanning.",
          "Scan the QR label on each card to add it to the sale.",
          "Tap Take payment. Choose DuitNow QR for the customer to scan with any Malaysian banking or e-wallet app, or Cash to record the sale.",
          "While the customer pays, TCGo holds the cards so nobody buys them online.",
          "After payment, type the customer's email to send a receipt, or scan their TCGo code and the receipt is emailed to them.",
        ],
        notes: ["Cards need QR labels first. Print them from Inventory, then Labels."],
        links: [{ to: "/seller/pos", label: "Open the POS" }],
      },
    ],
  },
  {
    id: "collection",
    title: "Collection and prices",
    articles: [
      {
        slug: "track-collection",
        title: "Track your collection",
        summary: "Add the cards you own and see what they're worth.",
        steps: [
          "Open the Collection tab.",
          "Search the TCGo catalogue by name, set or number.",
          "Tap + on a card to add it to your collection, and set how many copies you own.",
          "The top of the page shows your collection's estimated value and how it is trending.",
        ],
        notes: [
          "For Japanese cards from the DP era, search the name and set (like \"omanyte dp4\"), since their numbers aren't in the catalogue.",
        ],
        links: [{ to: "/collection", label: "Your collection" }],
      },
      {
        slug: "card-prices",
        title: "Check a card's price",
        summary: "Market price, price history and live eBay listings.",
        steps: [
          "Open any card from your collection or from a catalogue search.",
          "See its market price, the market low and high, and how the price has moved.",
          "Pick a range to see more of the price history.",
          "Scroll down for live eBay listings of the same card.",
        ],
        notes: [
          "Prices are a guide, not an appraisal. Tap Why? next to the price to see how sure TCGo is about it.",
        ],
      },
      {
        slug: "scanning",
        title: "Scan cards with your camera",
        summary: "Let TCGo read the card for you when listing or stocking.",
        steps: [
          "Tap Open scanner when you list a card, start an auction or add inventory.",
          "Line up the card in the frame and tap capture, or upload a photo instead.",
          "Keep snapping. Each scan joins a queue while TCGo identifies it.",
          "If TCGo isn't sure, pick the right card from the matches it shows.",
        ],
        notes: [
          "Free accounts get a set number of scans each month, and the scanner shows how many are left. The Pro plan has unlimited scans.",
        ],
        links: [{ to: "/pricing", label: "Pricing and the Pro plan" }],
      },
    ],
  },
  {
    id: "orders",
    title: "Orders and payments",
    articles: [
      {
        slug: "pay-and-track",
        title: "Pay for and track an order",
        summary: "Find your orders, pay, and follow the parcel.",
        steps: [
          "Go to Account and look under My Orders. To pay and In transit show how many need you.",
          "Open an order and tap Pay online (FPX) if it hasn't been paid yet.",
          "Once paid, the order shows where the parcel is, from preparing to delivered, with the waybill number to track it on the courier's site.",
          "When the card arrives, tap Mark received.",
        ],
        links: [{ to: "/activity", label: "My Orders" }],
      },
      {
        slug: "cancel-order",
        title: "Cancel an order",
        summary: `Unpaid orders any time, paid orders within ${CANCEL_GRACE_MINUTES} minutes.`,
        steps: [
          "Open the order from My Orders.",
          "If it isn't paid yet, tap Cancel.",
          `If you've paid, you can cancel within ${CANCEL_GRACE_MINUTES} minutes of paying and ask for a refund. After that the seller can book the courier.`,
        ],
        notes: ["Auction wins can't be cancelled."],
        links: [{ to: "/refund-policy", label: "Refund Policy" }],
      },
      {
        slug: "report-problem",
        title: "Report a problem with an order",
        summary: "Wrong, damaged or missing? Tell the seller, and TCGo if needed.",
        steps: [
          "Open the order and tap Report a problem.",
          "Describe what went wrong. Photos help, so share a link to them if you have one.",
          `Sort it out with the seller there. They're asked to reply within ${SELLER_REPLY_BUSINESS_DAYS} business days, and can agree to a refund.`,
          "If you can't agree, either of you can ask TCGo to step in and decide.",
        ],
        notes: [
          `You can report a problem up to ${CLAIM_WINDOW_DAYS} days after delivery. The seller isn't paid while it's open.`,
          "Only orders paid through TCGo checkout are covered by Buyer Protection.",
        ],
        links: [
          { to: "/refund-policy", label: "Refund Policy and Buyer Protection" },
          { to: "/terms", label: "Terms of Use" },
        ],
      },
    ],
  },
  {
    id: "messages",
    title: "Messages and notifications",
    articles: [
      {
        slug: "messages",
        title: "Message a buyer or seller",
        summary: "Ask about a card or an order in chat.",
        steps: [
          "Tap Message seller on a listing, an auction, a profile or an order.",
          "Your conversations are in Messages, from the chat icon at the top or the Account page.",
          "Tap Attach to share an order you and the other person have together.",
        ],
        notes: [
          "If a message looks like it arranges payment outside TCGo, we ask you to check before sending. Buyer Protection only covers orders paid through TCGo.",
          "You need a confirmed email to send messages.",
        ],
        links: [{ to: "/messages", label: "Messages" }],
      },
      {
        slug: "notifications",
        title: "Turn on notifications",
        summary: "Get messages, order updates and auction alerts on your phone.",
        steps: [
          "Go to Account, then Notifications.",
          "Turn on Push notifications on this device and allow them when your phone asks.",
          "Choose which alerts you want, like messages, orders and outbid alerts.",
        ],
        notes: [
          "On iPhone and iPad, add TCGo to your Home Screen first and open it from there, then turn this on.",
          "If notifications are blocked, allow them for TCGo in your browser's site settings, then come back.",
        ],
        links: [{ to: "/account/notifications", label: "Notifications" }],
      },
    ],
  },
  {
    id: "account",
    title: "Account and settings",
    articles: [
      {
        slug: "profile",
        title: "Edit your profile",
        summary: "Your name, photo and contact details.",
        steps: [
          "Go to Account, then Account settings.",
          "Change your display name, photo and contact details, and save.",
          "To see your public profile as others do, tap your name at the top of the Account page.",
        ],
        links: [{ to: "/profile", label: "Account settings" }],
      },
      {
        slug: "customer-code",
        title: "Use your customer code in shops",
        summary: "Get your receipt by email at a TCGo shop counter.",
        steps: [
          "Go to Account and tap My code.",
          "Show the code at the counter of a shop that sells with TCGo.",
          "The shop scans it and your receipt is emailed to you, without reading out your address.",
        ],
        notes: [
          "The code identifies your account, not your email. The shop only gets your address when it sends the receipt.",
        ],
      },
    ],
  },
];

export const findHelpArticle = (
  slug: string,
): { topic: HelpTopic; article: HelpArticle } | null => {
  for (const topic of HELP_TOPICS) {
    const article = topic.articles.find((a) => a.slug === slug);
    if (article) return { topic, article };
  }
  return null;
};

/** Case-insensitive match on an article's title, summary and steps. */
export const searchHelp = (query: string): HelpArticle[] => {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return HELP_TOPICS.flatMap((t) => t.articles).filter((a) => {
    const text = [a.title, a.summary, ...a.steps].join(" ").toLowerCase();
    return words.every((w) => text.includes(w));
  });
};

/**
 * Where members (and anyone signed out) can email TCGo. Shown on the Help
 * Center's Contact us tab.
 */
export const HELP_EMAIL = "help@tcgo.shop";
