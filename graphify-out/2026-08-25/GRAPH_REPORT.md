# Graph Report - PokeTcg  (2026-08-25)

## Corpus Check
- 161 files · ~294,985 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1512 nodes · 1885 edges · 127 communities (116 shown, 11 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 21 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `de83d70d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- delyva.ts
- auctions/new.vue
- listings/new.vue
- profile/index.vue
- items/index.vue
- dependencies
- [uid].vue
- payouts.vue
- auctions/[id].vue
- import.vue
- cart.vue
- ReportForm.vue
- funds.vue
- [id]/index.vue
- collection.vue
- TCGo Roadmap
- CardScanner.vue
- orders/[id].vue
- listings/[id]/edit.vue
- pos.vue
- labels.vue
- shared/payouts.ts
- SellerSalesDashboard.vue
- inventory/index.vue
- useOrders.ts
- AppNavbar.vue
- SearchModal.vue
- activity.vue
- InstallPrompt.vue
- pricing.vue
- useMarketPrice.ts
- beta.vue
- CardFormFields.vue
- useCardConstants.ts
- useCompiledOrders.ts
- inventory/auctions/index.vue
- setup.vue
- CardTile.vue
- CompiledOrderCard.vue
- inventory.vue
- LandingHero.vue
- useAuctions.ts
- listings/index.vue
- seed-pokemon-catalog.mjs
- ListingFilters.vue
- useCardCatalog.ts
- useInstallPrompt.ts
- useInventory.ts
- useReveal.ts
- TCGo — Pokémon TCG Online Marketplace
- CatalogMatch
- snapshot-pokemon-prices.mjs
- TCGo Roadmap / TODO
- LandingPosVisual.vue
- useListingFilters.ts
- LandingPriceVisual.vue
- LandingWaybillVisual.vue
- error.vue
- pages/index.vue
- BetaGate.vue
- LandingNavbar.vue
- sequential-thinking
- FavouriteButton.vue
- Auction
- useCards.ts
- useSearchHistory.ts
- clearSelection
- social-meta.ts
- TCGo Supabase (catalog)
- useStorage.ts
- useFavourites.ts
- useScanQuota.ts
- useTheme.ts
- useUserCollection.ts
- pages/landing.vue
- LandingDashboardVisual.vue
- LandingFeatureRow.vue
- ProfileItem.vue
- useAuth.ts
- usePhoneVerification.ts
- handleFile
- parsePasted
- CardImage.vue
- schema.sql
- useTrustScore.ts
- addFiles
- identifyPhotos
- reconcile
- tsconfig.json
- server/tsconfig.json
- TabStrip.vue
- ThemeToggle.vue
- usd-myr.get.ts
- identify-card.post.ts

## God Nodes (most connected - your core abstractions)
1. `getAdminFirestore()` - 14 edges
2. `TCGo Roadmap` - 13 edges
3. `stateName()` - 11 edges
4. `Membership + Stripe — full build plan` - 10 edges
5. `Auction` - 9 edges
6. `CatalogMatch` - 9 edges
7. `CompiledOrder` - 9 edges
8. `requireUser()` - 9 edges
9. `computeSellerPayout()` - 9 edges
10. `renderThermal()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `fundEntries` --calls--> `categorizeFunds()`  [EXTRACTED]
  components/SellerSalesDashboard.vue → composables/useSellerFunds.ts
- `addressLine` --calls--> `stateName()`  [EXTRACTED]
  pages/cart.vue → shared/my-states.ts
- `pickupLine` --calls--> `stateName()`  [EXTRACTED]
  pages/profile/index.vue → shared/my-states.ts
- `statusLabel` --calls--> `compiledOrderStatusLabel()`  [EXTRACTED]
  components/CompiledOrderCard.vue → composables/useCompiledOrders.ts
- `statusColor` --calls--> `compiledOrderStatusColor()`  [EXTRACTED]
  components/CompiledOrderCard.vue → composables/useCompiledOrders.ts

## Import Cycles
- None detected.

## Communities (127 total, 11 thin omitted)

### Community 0 - "delyva.ts"
Cohesion: 0.05
Nodes (58): useAdmin(), PAYABLE_STATUSES, LineItem, AuthedUser, requireAdmin(), requireUser(), billplzAuthHeader(), billplzBaseUrl() (+50 more)

### Community 1 - "auctions/new.vue"
Cohesion: 0.04
Nodes (38): AuctionDraftFields, canPublishDrafts, cardForm, { createAuction }, draftError, draftFields, DraftFileEntry, dragOver (+30 more)

### Community 2 - "listings/new.vue"
Cohesion: 0.04
Nodes (38): addFiles(), canPublishDrafts, cardForm, { createCard }, { createListedFromCard }, draftError, DraftFields, DraftFileEntry (+30 more)

### Community 3 - "profile/index.vue"
Cohesion: 0.04
Nodes (35): isNewUser, loading, MembershipTier, profile, SubscriptionStatus, UserProfile, addr, addressDirty (+27 more)

### Community 4 - "items/index.vue"
Cohesion: 0.04
Nodes (32): addOpen, allFilteredSelected, allPageSelected, bulkBusy, CONDITIONS, filteredItems, filterTabs, {
  items,
  loading,
  count,
  totalUnits,
  totalValue,
  listenMyInventory,
  addItem,
  updateItem,
  removeItem,
  listItem,
  unlistItem,
  markItemSold,
  setLabelQueue,
} (+24 more)

### Community 5 - "dependencies"
Cohesion: 0.04
Nodes (45): dotenv, firebase, firebase-admin, nuxt, @nuxtjs/tailwindcss, dependencies, firebase, firebase-admin (+37 more)

### Community 6 - "[uid].vue"
Cohesion: 0.05
Nodes (30): activeTab, { auctions }, { cards }, collectionCards, collectionValue, copied, emptyFavouritesCaption, favouriteAuctions (+22 more)

### Community 7 - "payouts.vue"
Cohesion: 0.12
Nodes (18): { authedFetch }, busy, error, execute(), fmt(), { isAdmin }, load(), loading (+10 more)

### Community 8 - "auctions/[id].vue"
Cohesion: 0.06
Nodes (29): activeImageIndex, allImages, antiSnipeActive, { auction, bids, loading, placeBid, setAutoBid }, auctionId, auctionStatus, { authedFetch }, autoBidMax (+21 more)

### Community 9 - "import.vue"
Cohesion: 0.05
Nodes (31): { addMany }, CONDITIONS, DEFAULT_PASTE_HEADERS, defaultCondition, FieldKey, flow, headers, hideUnmatched (+23 more)

### Community 10 - "cart.vue"
Cohesion: 0.06
Nodes (29): CartItem, items, addressLine, { authedFetch }, canCheckout, checkoutLabel, { createCompiledOrders }, destination (+21 more)

### Community 11 - "ReportForm.vue"
Cohesion: 0.07
Nodes (23): close(), description, emit, error, evidenceFiles, fileInput, handleSubmit(), props (+15 more)

### Community 12 - "funds.vue"
Cohesion: 0.11
Nodes (29): useSellerKyc(), {
  available,
  locked,
  queued,
  paidOut,
  availableTotal,
  lockedTotal,
  queuedTotal,
  lastFailureReason,
  requestPayout,
}, bankLine, doRequestPayout(), fmt(), fmtDate(), { listenSellerCompiledOrders }, lockReason() (+21 more)

### Community 13 - "[id]/index.vue"
Cohesion: 0.07
Nodes (26): activeImage, activeImageIndex, { addToCart, isInCart }, allImages, card, cardId, { cards, loading, markInterested }, copied (+18 more)

### Community 14 - "collection.vue"
Cohesion: 0.07
Nodes (27): appliedQuery, applyFilters(), collectionCards, collectionProductIds, effectiveRarityMatch, effectiveSetMatch, {
  entries,
  count,
  isInCollection,
  toggleInCollection,
  listenMyCollection,
}, filtersOpen (+19 more)

### Community 15 - "TCGo Roadmap"
Cohesion: 0.06
Nodes (31): At a glance, Collection tracker (scan-to-own), Competitive landscape (reference), Decisions locked in, Engineering hygiene (background, not version-gated), Env vars (Netlify), Future bets — Tier 3, Later — ergonomic wins (V 0.7.0+) (+23 more)

### Community 16 - "CardScanner.vue"
Cohesion: 0.09
Nodes (26): acceptScan(), blobToBase64(), cameraError, capture(), close(), dragOver, emit, finishScanning() (+18 more)

### Community 17 - "orders/[id].vue"
Cohesion: 0.07
Nodes (22): addr, addressOpen, { authedFetch }, booking, createBillAndRedirect(), { firestore }, {
  getCompiledOrder,
  markShipped,
  markDelivered,
  cancelOrder,
}, isPayable (+14 more)

### Community 18 - "listings/[id]/edit.vue"
Cohesion: 0.07
Nodes (19): CardFormData, card, cardForm, cardId, { cards, loading, deleteCard }, deleting, error, existingImages (+11 more)

### Community 19 - "pos.vue"
Cohesion: 0.10
Nodes (25): quickAdd(), addItem(), beep(), cameraError, checkingOut, checkout(), feedback(), handleDecoded() (+17 more)

### Community 20 - "labels.vue"
Cohesion: 0.10
Nodes (22): buildThermal(), condShort(), fitFont(), fitText(), { items, listenMyInventory, labelQueue }, LabelCard, labelCards, loadImage() (+14 more)

### Community 21 - "shared/payouts.ts"
Cohesion: 0.24
Nodes (15): categorizeFunds(), FundState, useSellerFunds(), computeSellerPayout(), isPayoutEligible(), isPayoutTrackable(), PayableOrder, PAYOUT_HOLD_DAYS (+7 more)

### Community 22 - "SellerSalesDashboard.vue"
Cohesion: 0.09
Nodes (21): actionTiles, avgOrder, Bucket, byStatus(), chartMax, completedCount, deliveredOrders, fundEntries (+13 more)

### Community 23 - "inventory/index.vue"
Cohesion: 0.09
Nodes (18): autoMerging, filteredSales, { items: inventoryItems, listenMyInventory }, mergeableGroups, mergeableOrderIds, merging, nonMergeableSales, posSales (+10 more)

### Community 24 - "useOrders.ts"
Cohesion: 0.12
Nodes (17): carrier, emit, props, showTracking, submitTracking(), trackingNumber, buyerOrders, loadingBuyer (+9 more)

### Community 25 - "AppNavbar.vue"
Cohesion: 0.13
Nodes (16): { cartCount }, desktopLinks, IconActivity(), IconCollection(), IconGavel(), IconShop(), IconUser(), { isAdmin } (+8 more)

### Community 26 - "SearchModal.vue"
Cohesion: 0.14
Nodes (16): auctionResults, { auctions }, cardResults, { cards }, close(), commit(), emit, { history, remember, forget, clear } (+8 more)

### Community 27 - "activity.vue"
Cohesion: 0.11
Nodes (15): activeBids, activePurchases, activeTab, { auctions, loading }, { bidIndex }, {
  buyerCompiledOrders,
  loadingBuyer: ordersLoadingBuyer,
  listenBuyerCompiledOrders,
  markDelivered,
  cancelOrder,
}, participated, route (+7 more)

### Community 28 - "InstallPrompt.vue"
Cohesion: 0.14
Nodes (12): dismissForever(), dismissPrompt(), {
  shouldOfferInstall,
  canPromptNatively,
  isIosSafari,
  promptInstall,
  dismiss,
}, showIosSheet, subline, visible, dismiss(), dismissed (+4 more)

### Community 29 - "pricing.vue"
Cohesion: 0.14
Nodes (9): PREMIUM_ENABLED, checkoutLoading, claimingBonus, freeFeatures, { isPremium, hasClaimedBonus, claimBonusScans }, portalLoading, premiumFeatures, { profile } (+1 more)

### Community 30 - "useMarketPrice.ts"
Cohesion: 0.17
Nodes (11): extractMarketPrice(), MarketPrice, pickTcgPlayerBlock(), VARIANT_ORDER, buildQuery(), CardMarketPrices, TcgApiResponse, TcgCard (+3 more)

### Community 31 - "beta.vue"
Cohesion: 0.13
Nodes (11): expectations, isVerified, normalizedPhone, otp, phone, { profile }, { sendCode, verifyCode, sending, verifying, error, codeSent, reset }, step (+3 more)

### Community 32 - "CardFormFields.vue"
Cohesion: 0.21
Nodes (13): emit, handleImport(), importError, importing, importSuccess, importUrl, onCheckboxInput(), onInput() (+5 more)

### Community 33 - "useCardConstants.ts"
Cohesion: 0.14
Nodes (13): ACE_GRADES, BECKETT_GRADES, CGC_GRADES, getGradesForProvider(), GRADING_PROVIDERS, GradingProvider, ProductType, PSA_GRADES (+5 more)

### Community 34 - "useCompiledOrders.ts"
Cohesion: 0.12
Nodes (17): buyerCompiledOrders, CompiledOrder, CompiledOrderInputItem, CompiledOrderItem, CompiledOrderStatus, CompiledPaymentMethod, groupItemsBySeller(), loadingBuyer (+9 more)

### Community 35 - "inventory/auctions/index.vue"
Cohesion: 0.15
Nodes (12): activeAuctions, { auctions, loading }, { authedFetch }, endedAuctions, getWinner(), myAuctions, settled, settleEnded() (+4 more)

### Community 36 - "setup.vue"
Cohesion: 0.14
Nodes (10): displayName, error, phone, previewUrl, { profile, updateProfile }, router, saving, selectedFile (+2 more)

### Community 37 - "CardTile.vue"
Cohesion: 0.15
Nodes (11): bidCount, conditionLabel, gradeBadgeClasses, imageCount, imageUrl, isAuction, item, linkTo (+3 more)

### Community 38 - "CompiledOrderCard.vue"
Cohesion: 0.18
Nodes (12): counterpartyName, counterpartyProfileLink, counterpartyUid, props, statusColor, statusLabel, statusColor(), statusLabel() (+4 more)

### Community 39 - "inventory.vue"
Cohesion: 0.15
Nodes (4): navItems, route, soonItems, stroke

### Community 40 - "LandingHero.vue"
Cohesion: 0.17
Nodes (10): badge, ctas, game, games, line1, line2, nodes, rail (+2 more)

### Community 41 - "useAuctions.ts"
Cohesion: 0.18
Nodes (9): auctions, AuctionSummary, AutoBid, Bid, firestoreAuctions, initializeAuctions(), loading, summaries (+1 more)

### Community 42 - "listings/index.vue"
Cohesion: 0.17
Nodes (10): activeCards, { cards, loading: cardsLoading, markAsSold }, markingAsSold, { markSoldByListingId }, myCards, soldCards, tab, TabItem (+2 more)

### Community 43 - "seed-pokemon-catalog.mjs"
Cohesion: 0.30
Nodes (11): buildRow(), CATEGORIES, detectLanguage(), extractField(), fetchGroups(), fetchJson(), fetchProducts(), main() (+3 more)

### Community 44 - "ListingFilters.vue"
Cohesion: 0.20
Nodes (8): chips, open, props, shortCondition(), sortOptions, CARD_LANGUAGES, PRODUCT_TYPES, UNGRADED_CONDITIONS

### Community 45 - "useCardCatalog.ts"
Cohesion: 0.23
Nodes (13): CatalogSort, ensureRate(), matchRarity(), ParsedQuery, parseSmartQuery(), pickPrice(), RARITY_ABBREVIATIONS, rowToMatch() (+5 more)

### Community 46 - "useInstallPrompt.ts"
Cohesion: 0.27
Nodes (10): BeforeInstallPromptEvent, checkStandalone(), deferredPrompt, dismissedAt, installedStandalone, isIos(), isIosSafari(), loadDismissed() (+2 more)

### Community 47 - "useInventory.ts"
Cohesion: 0.20
Nodes (10): buildItem(), InventoryItem, InventoryItemInput, InventorySource, InventoryStatus, items, labelQueue, ListOptions (+2 more)

### Community 48 - "useReveal.ts"
Cohesion: 0.24
Nodes (9): Context, forceVisible(), Gsap, loadGsap(), prefersReducedMotion(), RevealApi, Timeline, TweenTarget (+1 more)

### Community 49 - "TCGo — Pokémon TCG Online Marketplace"
Cohesion: 0.20
Nodes (9): Architecture, Commands, Gotchas, graphify, 🧠 Mandatory Workflow (EVERY task, no exceptions), Stack, Step 1 — graphify FIRST, Step 2 — sequential-thinking SECOND (+1 more)

### Community 50 - "CatalogMatch"
Cohesion: 0.27
Nodes (8): CatalogMatch, CatalogPrice, queue, randomId(), ScanQueueItem, ScanStatus, useScanQueue(), ReviewRow

### Community 51 - "snapshot-pokemon-prices.mjs"
Cohesion: 0.36
Nodes (9): aggregatePrices(), CATEGORY_IDS, fetchGroups(), fetchJson(), fetchPrices(), loadKnownProductIds(), main(), supabase (+1 more)

### Community 52 - "TCGo Roadmap / TODO"
Cohesion: 0.20
Nodes (9): Catalog / UX, 🧹 Cleanup, 🗓️ Later / backlog, 🎯 Next — POS (original goal), Payments & fulfillment, 🚦 Pre-deploy / pre-launch checklist, ✅ Shipped, TCGo Roadmap / TODO (+1 more)

### Community 53 - "LandingPosVisual.vue"
Cohesion: 0.22
Nodes (8): chargeBtn, onlinePanel, posPanel, pulse, pulseDot, root, stockNum, syncChip

### Community 54 - "useListingFilters.ts"
Cohesion: 0.25
Nodes (8): FilterableItem, inBucket(), ListingFilters, ProductTypeFilter, SortKey, StatusFilter, TimeLeftBucket, useListingFilters()

### Community 55 - "LandingPriceVisual.vue"
Cohesion: 0.25
Nodes (7): clip, delta, liveDot, marker, price, root, rows

### Community 56 - "LandingWaybillVisual.vue"
Cohesion: 0.25
Nodes (7): bars, cta, label, root, rule1, rule2, tracking

### Community 57 - "error.vue"
Cohesion: 0.25
Nodes (5): description, props, route, statusCode, title

### Community 58 - "pages/index.vue"
Cohesion: 0.32
Nodes (7): activeTcg, availableCards, { cards, loading }, filters, tcgCounts, tcgOf(), { user }

### Community 59 - "BetaGate.vue"
Cohesion: 0.29
Nodes (6): allowedPaths, dismissed, { profile, loading }, route, showBanner, { user }

### Community 60 - "LandingNavbar.vue"
Cohesion: 0.29
Nodes (4): { isAdmin }, mobileMenuOpen, { profile }, { user, authLoading, signInWithGoogle, signOut }

### Community 61 - "sequential-thinking"
Cohesion: 0.33
Nodes (5): graphify, sequential-thinking, graphify-mcp, npx, @modelcontextprotocol/server-sequential-thinking

### Community 62 - "FavouriteButton.vue"
Cohesion: 0.33
Nodes (4): isFav, { isFavourited, toggleFavourite }, props, { user }

### Community 63 - "Auction"
Cohesion: 0.33
Nodes (5): Auction, BidItem, { auctions, loading }, filters, publicAuctions

### Community 64 - "useCards.ts"
Cohesion: 0.40
Nodes (5): Card, cards, initialize(), loading, useCards()

### Community 65 - "useSearchHistory.ts"
Cohesion: 0.47
Nodes (5): history, load(), loaded, persist(), useSearchHistory()

### Community 66 - "clearSelection"
Cohesion: 0.33
Nodes (6): bulkList(), bulkMarkSold(), bulkRemove(), clearSelection(), selectAllFiltered(), toggleSelectAllFiltered()

### Community 68 - "TCGo Supabase (catalog)"
Cohesion: 0.33
Nodes (5): Automated nightly cron, Daily price snapshot, One-time setup, Refreshing, TCGo Supabase (catalog)

### Community 69 - "useStorage.ts"
Cohesion: 0.60
Nodes (3): cdnUrl(), compressImage(), useStorage()

### Community 71 - "useScanQuota.ts"
Cohesion: 0.50
Nodes (4): BONUS_SCANS, firstOfNextMonth(), FREE_SCAN_LIMIT, useScanQuota()

### Community 72 - "useTheme.ts"
Cohesion: 0.50
Nodes (4): applyTheme(), resolved, Theme, useTheme()

### Community 73 - "useUserCollection.ts"
Cohesion: 0.40
Nodes (3): CollectionEntry, entries, loading

### Community 74 - "pages/landing.vue"
Cohesion: 0.40
Nodes (4): cta, intro, secondary, secondaryItems

### Community 75 - "LandingDashboardVisual.vue"
Cohesion: 0.50
Nodes (3): days, root, total

### Community 76 - "LandingFeatureRow.vue"
Cohesion: 0.50
Nodes (3): copy, root, visual

### Community 77 - "ProfileItem.vue"
Cohesion: 0.50
Nodes (3): props, statusChip, statusLabel

### Community 79 - "usePhoneVerification.ts"
Cohesion: 0.83
Nodes (3): clearRecaptcha(), getErrorMessage(), usePhoneVerification()

### Community 80 - "handleFile"
Cohesion: 0.50
Nodes (4): autoMap(), handleFile(), parseCsv(), parseSpreadsheet()

### Community 81 - "parsePasted"
Cohesion: 0.50
Nodes (4): detectDelim(), handlePaste(), parsePasted(), splitByMode()

### Community 83 - "schema.sql"
Cohesion: 0.31
Nodes (7): card_prices, card_prices_touch, cards_catalog, cards_catalog_touch, list_rarities(), search_catalog(), touch_updated_at()

### Community 85 - "addFiles"
Cohesion: 0.67
Nodes (3): addFiles(), handleDrop(), handleFileSelect()

### Community 86 - "identifyPhotos"
Cohesion: 0.67
Nodes (3): blobToBase64(), identifyPhotos(), resizeImage()

### Community 87 - "reconcile"
Cohesion: 0.67
Nodes (3): cell(), reconcile(), toNumber()

## Knowledge Gaps
- **824 isolated node(s):** `graphify-mcp`, `npx`, `@modelcontextprotocol/server-sequential-thinking`, `{ user, authLoading, signInWithGoogle }`, `{ profile }` (+819 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Auction` connect `Auction` to `delyva.ts`, `inventory/auctions/index.vue`, `CardTile.vue`, `[uid].vue`, `useAuctions.ts`, `SearchModal.vue`, `activity.vue`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Why does `Card` connect `useCards.ts` to `pages/index.vue`, `CardTile.vue`, `listings/index.vue`, `[id]/index.vue`, `listings/[id]/edit.vue`, `SearchModal.vue`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Why does `CatalogMatch` connect `CatalogMatch` to `items/index.vue`, `[uid].vue`, `import.vue`, `useCardCatalog.ts`, `collection.vue`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **What connects `graphify-mcp`, `npx`, `@modelcontextprotocol/server-sequential-thinking` to the rest of the system?**
  _824 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `delyva.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05426356589147287 - nodes in this community are weakly interconnected._
- **Should `auctions/new.vue` be split into smaller, more focused modules?**
  _Cohesion score 0.0392156862745098 - nodes in this community are weakly interconnected._
- **Should `listings/new.vue` be split into smaller, more focused modules?**
  _Cohesion score 0.0407843137254902 - nodes in this community are weakly interconnected._