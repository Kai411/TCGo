// What we tell people changed, and when.
//
// WRITE THESE FOR A BUYER OR SELLER, NOT FOR US.
//
// A release note says what someone can now do, in the words they would use.
// It never names how anything works inside: no services, no data stores, no
// scheduled jobs, no payment providers, no internal money handling, no
// architecture. Those are our operations, and they belong in commit messages
// and code comments — where they already are.
//
// The rule is enforced, not just described: test/releases.test.ts fails the
// build if a note mentions anything on the forbidden list. If you find
// yourself wanting to explain a mechanism to justify a change, the note is
// too detailed — say what it does for them and stop.
//
//   Good  "Search by the number printed on the card."
//   Bad   "Card numbers now query their own column instead of the name index."
//
// Shown in full on /update-notice, which renders this list and nothing else —
// so the test covers every word a visitor can read there.

export interface Release {
  /** Semver-ish; only the numeric ordering matters here. */
  version: string;
  /** ISO date, for display. */
  date: string;
  /** A few words, shown as the heading. */
  title: string;
  /** One line each, in the reader's language. */
  notes: string[];
}

/** Newest first. The head of this list is the version the app reports. */
export const RELEASES: Release[] = [
  {
    version: "1.1.0",
    date: "2026-09-07",
    title: "Find cards faster",
    notes: [
      "Search by the number printed on the card — try “pikachu 012”, “gg44” or “tg05”.",
      "Use the short set names you already say out loud — “pikachu ssp”, “reshiram rc”, “charizard tg”.",
      "Search results keep loading as you scroll, so there is nothing to click for more.",
      "New sets are added within a day of release.",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-08-30",
    title: "Orders you can follow",
    notes: [
      "Follow a delivery from the moment it is placed through to arrival.",
      "Orders combined into one parcel now show as a single delivery.",
      "Sign in with an email address and password.",
      "Save more than one delivery address and choose which is your default.",
    ],
  },
  {
    version: "0.4.0",
    date: "2026-08-29",
    title: "Pay, ship and get paid",
    notes: [
      "Pay at checkout with FPX online banking.",
      "Sellers withdraw their earnings from the Funds page to the bank account on their profile.",
      "Buyers get an invoice by email, and can resend it from the order.",
      "Shipping is priced from real courier rates to your delivery address, not a flat fee per listing.",
      "Shipping labels are booked for sellers — open the order, print, and hand the parcel over.",
      "Sellers can combine a buyer’s orders going to the same address into one parcel.",
      "Sellers choose which couriers they ship with in their settings.",
      "Checkout uses the delivery address saved on your profile.",
      "Pricing is published on the Pricing page, with no listing fees and no minimum order.",
      "Sales made during the beta were charged 2%, and stay that way.",
      "Pro membership lifts the monthly limit on card scans, and does not change what selling costs.",
      "Everything for selling now lives in one place, under Seller.",
      "Orders are easier to scan, and each order shows what was bought beside the delivery details.",
      "Listing a card asks for less, now that shipping is priced for you.",
    ],
  },
  {
    version: "0.3.2",
    date: "2026-06-14",
    title: "Selling in store",
    notes: [
      "Scan cards with your phone, ring up walk-in customers and take payment at the counter.",
      "Print price tags and QR labels on thermal printers or A4 sheets, including a portrait 30×40 layout.",
      "Add stock in batches by photographing your cards.",
      "Japanese cards are in the catalogue and recognised by the scanner.",
      "A Funds page shows what has cleared, what is on hold and what has been paid out.",
      "Select items across every page of your inventory at once, and print labels for listed items too.",
    ],
  },
  {
    version: "0.3.1",
    date: "2026-05-27",
    title: "Smoother browsing",
    notes: [
      "Swipe through a card’s photos, or use the arrows, with a counter showing which one you are on.",
      "Auction pages load faster, and links shared on WhatsApp or Telegram show the card’s image and title.",
      "Clearer labels on the auction form.",
      "The install prompt has the new logo and no longer sits behind the bottom bar.",
      "Creating and editing a listing is easier to get through.",
    ],
  },
  {
    version: "0.3.0",
    date: "2026-05-21",
    title: "Cleaner cards",
    notes: [
      "Beta members verify their access before using the marketplace.",
      "Card tiles show the grade or condition on the photo, in real card proportions.",
      "Auction tiles show one countdown badge that changes colour as the end gets closer.",
      "Prices show thousands separators, and price fields are marked RM.",
      "The scanner fills in only what it reads reliably — name, number, language and artist.",
      "Listings made from a scan use your own photos.",
      "Card pages are tidier, keeping the set number and the condition or grade.",
    ],
  },
  {
    version: "0.2.0",
    date: "2026-05-21",
    title: "Memberships and more games",
    notes: [
      "Free accounts get 20 card scans a month, and a paid membership removes the limit.",
      "Tag listings as Pokémon, One Piece, Digimon, Magic, Yu-Gi-Oh!, Dragon Ball Super, Lorcana or other.",
      "Filter the shop by game.",
      "The scanner detects a card’s language, and Japanese cards keep their printed set number.",
      "Add TCGo to your home screen on iOS and Android, or install it on your computer.",
      "Dark mode across every page.",
      "Sharper scans, faster identification, and a switch between scanning and typing details in.",
      "An Activity tab on mobile for your listings and bids.",
      "Graded slabs show their grade, like PSA 10, up front.",
      "Auction tiles show the right bid count.",
    ],
  },
  {
    version: "0.1.0",
    date: "2026-05-21",
    title: "Faster listing",
    notes: [
      "Scan several cards in a row when creating listings.",
      "A cleaner marketplace.",
    ],
  },
  {
    version: "0.0.5",
    date: "2026-05-19",
    title: "Beta opens",
    notes: ["Beta access opens."],
  },
  {
    version: "0.0.4",
    date: "2026-05-17",
    title: "Say hello",
    notes: ["The TCGo landing page.", "Our privacy policy."],
  },
  {
    version: "0.0.3",
    date: "2026-05-16",
    title: "Accounts",
    notes: ["Sign in with Google.", "Manage your profile."],
  },
  {
    version: "0.0.2",
    date: "2026-05-15",
    title: "Buy, sell and bid",
    notes: ["List cards for sale.", "Bid in live auctions."],
  },
  {
    version: "0.0.1",
    date: "2026-05-14",
    title: "First prototype",
    notes: ["The first prototype of TCGo."],
  },
];

export const APP_VERSION = RELEASES[0]!.version;

/** Numeric compare: 1.10.0 is above 1.9.0, which a string compare gets wrong. */
export const compareVersions = (a: string, b: string): number => {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
};
