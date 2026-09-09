# Graph Report - PokeTcg  (2026-09-07)

## Corpus Check
- 331 files · ~428,105 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 3030 nodes · 4655 edges · 232 communities (206 shown, 26 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 91 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `82e06399`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- delyva.ts
- items/index.vue
- auctions/new.vue
- profile/index.vue
- listings/new.vue
- dependencies
- [uid].vue
- billplz.ts
- auctions/[id].vue
- import.vue
- cart.vue
- reports.vue
- CompiledOrderCard.vue
- [id]/index.vue
- TCGo Roadmap
- CardScanner.vue
- orders/[id].vue
- pos.vue
- labels.vue
- listings/[id]/edit.vue
- verify.vue
- SellerSalesDashboard.vue
- seller/orders/index.vue
- useOrders.ts
- AppNavbar.vue
- SearchModal.vue
- activity.vue
- InstallPrompt.vue
- membership/index.vue
- useMarketPrice.ts
- pages/login.vue
- CardFormFields.vue
- book-shipment.ts
- useCompiledOrders.ts
- useListingFilters.ts
- setup.vue
- CardTile.vue
- shared/payouts.ts
- backdate-delivery.mjs
- LandingHero.vue
- useAuctions.ts
- CardSearchPicker.vue
- seed-pokemon-catalog.mjs
- ListingFilters.vue
- useCardCatalog.ts
- useInstallPrompt.ts
- shipping-quote.ts
- useReveal.ts
- TCGo — Pokémon TCG Online Marketplace
- CatalogMatch
- snapshot-pokemon-prices.mjs
- TCGo Roadmap / TODO
- LandingPosVisual.vue
- pricing.vue
- LandingPriceVisual.vue
- LandingWaybillVisual.vue
- error.vue
- pages/index.vue
- search-query.ts
- LandingNavbar.vue
- sequential-thinking
- FavouriteButton.vue
- payouts.vue
- collection/index.vue
- useSearchHistory.ts
- payouts/[id].vue
- social-meta.ts
- TCGo Supabase (catalog)
- staff-auth.ts
- useFavourites.ts
- useScanQuota.ts
- useTheme.ts
- useUserCollection.ts
- create-charge.post.ts
- LandingDashboardVisual.vue
- LandingFeatureRow.vue
- ProfileItem.vue
- useAuth.ts
- onboarding.ts
- seller/auctions/index.vue
- layouts/seller.vue
- CardImage.vue
- schema.sql
- useTrustScore.ts
- [productId].vue
- useCards.ts
- ShipmentTimeline.vue
- tsconfig.json
- server/tsconfig.json
- TabStrip.vue
- ThemeToggle.vue
- usd-myr.get.ts
- identify-card.post.ts
- default.vue
- nuxt.config.ts
- settle.post.ts
- finance.ts
- LandingInventoryVisual.vue
- AddMethodPicker.vue
- seller/index.vue
- ChoiceGroup.vue
- pos-payment.ts
- confirm
- funds/index.vue
- account.vue
- payout-details.ts
- [...path].vue
- auth-codes.ts
- firebase-admin.ts
- payment/success.vue
- handleFile
- settings.vue
- photo-policy.ts
- isAvailable
- parsePasted
- clear-order-history.mjs
- usePaymentResult.ts
- identifyPhotos
- staff.vue
- reconcile
- stripe/webhook.post.ts
- mintcondition/index.vue
- seed-mock-listings.mjs
- admin.vue
- AdminIdentityPanel.vue
- payouts/index.vue
- AdminStat.vue
- KycVerifyCard.vue
- CollectedBadge.vue
- pages/onboarding.vue
- sales/index.vue
- delivery-stage.ts
- logs.vue
- utils/oplog.ts
- AutoPayoutPanel.vue
- join-parcel.ts
- auto-run.post.ts
- backfill-payouts.mjs
- useProfile.ts
- login.vue
- CartDrawer.vue
- SellerOnboardingTour.vue
- useShopOrdering.ts
- addManual
- PriceTrendChart.vue
- notifications.ts
- invoices/[id].vue
- seller/onboarding.vue
- AddressBook.vue
- releases.ts
- pos-settle.ts
- PosPaymentSheet.vue
- settlement.ts
- qrcode.d.ts
- payout-ledger.ts
- merge.post.ts
- sales/[id].vue
- wipe-firebase.mjs
- listing-lifecycle.ts
- addresses.ts
- locked.vue
- buyer-qr.ts
- seller-sales.ts
- NotificationBell.vue
- addItem
- showToast
- sales-summary.ts
- PaymentCardFan.vue
- VerifiedBadge.vue
- didit.ts
- shared/shipping.ts
- useCart.ts
- execute-payout.ts
- listingMatchesCard
- formatHistoryDate
- alias.mjs
- groupShipping
- groupState
- formatMyr
- gradedRows
- handleRelatedToggle
- loadDetail
- WhatsNewSheet.vue
- PosPaymentProvider
- startCamera
- addPhotoToListingCandidate
- closeAdd

## God Nodes (most connected - your core abstractions)
1. `getAdminFirestore()` - 60 edges
2. `requireStaff()` - 28 edges
3. `requireUser()` - 27 edges
4. `noteError()` - 22 edges
5. `confirm` - 18 edges
6. `isAvailable()` - 18 edges
7. `stateName()` - 18 edges
8. `noteAction()` - 15 edges
9. `CompiledOrder` - 14 edges
10. `CatalogMatch` - 13 edges

## Surprising Connections (you probably didn't know these)
- `confirmRemove()` --calls--> `confirm`  [INFERRED]
  components/AddressBook.vue → pages/mintcondition/account.vue
- `runNow()` --calls--> `confirm`  [INFERRED]
  components/AutoPayoutPanel.vue → pages/mintcondition/account.vue
- `cardResults` --indirect_call--> `isAvailable()`  [INFERRED]
  components/SearchModal.vue → shared/card-availability.ts
- `topSets` --calls--> `isAvailable()`  [EXTRACTED]
  components/SearchModal.vue → shared/card-availability.ts
- `topSellers` --calls--> `isAvailable()`  [EXTRACTED]
  components/SearchModal.vue → shared/card-availability.ts

## Import Cycles
- None detected.

## Communities (232 total, 26 thin omitted)

### Community 0 - "delyva.ts"
Cohesion: 0.13
Nodes (20): DELYVA_BASE, DelyvaAddress, delyvaBase(), delyvaConfig(), delyvaConsignmentNo(), DelyvaContact, delyvaCreateOrder(), delyvaGet() (+12 more)

### Community 1 - "items/index.vue"
Cohesion: 0.03
Nodes (52): addMode, addOpen, allFilteredSelected, allPageSelected, bulkBusy, cardForm, { cards, loading: cardsLoading }, CONDITIONS (+44 more)

### Community 2 - "auctions/new.vue"
Cohesion: 0.04
Nodes (43): addFiles(), AuctionDraftFields, canPublishDrafts, cardForm, { createAuction }, draftError, draftFields, DraftFileEntry (+35 more)

### Community 3 - "profile/index.vue"
Cohesion: 0.06
Nodes (23): claimingBonus, editFavouritesPublic, editName, fullPhone, { goToLogin }, { isPremium, used: scansUsed, hasClaimedBonus, bonusRemaining, claimBonusScans }, { openAll }, periodEndLabel (+15 more)

### Community 4 - "listings/new.vue"
Cohesion: 0.04
Nodes (39): addFiles(), canPublishDrafts, cardForm, { createCard }, { createListedFromCard }, draftError, DraftFields, DraftFileEntry (+31 more)

### Community 5 - "dependencies"
Cohesion: 0.04
Nodes (48): @didit-protocol/sdk-web, dotenv, firebase, firebase-admin, nuxt, @nuxtjs/tailwindcss, dependencies, @didit-protocol/sdk-web (+40 more)

### Community 6 - "[uid].vue"
Cohesion: 0.05
Nodes (32): activeTab, { auctions }, { cards }, collectionCards, collectionValue, { containerEl, setTabRef, indicatorStyle, measure }, copied, emptyFavouritesCaption (+24 more)

### Community 7 - "billplz.ts"
Cohesion: 0.28
Nodes (14): PAYABLE_STATUSES, asciiSafe(), billplzAuthHeader(), billplzBaseUrl(), billplzBillState(), billplzDeleteBill(), billplzForm(), checksumOf() (+6 more)

### Community 8 - "auctions/[id].vue"
Cohesion: 0.06
Nodes (30): activeImageIndex, allImages, antiSnipeActive, { auction, bids, loading, placeBid, setAutoBid }, auctionId, auctionStatus, { authedFetch }, autoBidMax (+22 more)

### Community 9 - "import.vue"
Cohesion: 0.05
Nodes (32): { addMany }, CONDITIONS, DEFAULT_PASTE_HEADERS, defaultCondition, FieldKey, flow, { goToLogin }, headers (+24 more)

### Community 10 - "cart.vue"
Cohesion: 0.06
Nodes (24): addressLine, allSelected, { authedFetch }, canCheckout, checkoutLabel, { createCompiledOrders }, destination, { goToLogin } (+16 more)

### Community 11 - "reports.vue"
Cohesion: 0.06
Nodes (34): close(), description, emit, error, evidenceFiles, fileInput, handleSubmit(), props (+26 more)

### Community 12 - "CompiledOrderCard.vue"
Cohesion: 0.15
Nodes (16): counterpartyName, counterpartyProfileLink, counterpartyUid, props, statusColor, statusLabel, props, shortDate (+8 more)

### Community 13 - "[id]/index.vue"
Cohesion: 0.06
Nodes (30): activeImage, activeImageIndex, { addToCart, isInCart }, allImages, { authLoading }, card, cardId, { cards, loading, markInterested, recordView } (+22 more)

### Community 15 - "TCGo Roadmap"
Cohesion: 0.06
Nodes (31): At a glance, Collection tracker (scan-to-own), Competitive landscape (reference), Decisions locked in, Engineering hygiene (background, not version-gated), Env vars (Netlify), Future bets — Tier 3, Later — ergonomic wins (V 0.7.0+) (+23 more)

### Community 16 - "CardScanner.vue"
Cohesion: 0.09
Nodes (27): acceptScan(), blobToBase64(), cameraError, capture(), close(), dragOver, emit, finishScanning() (+19 more)

### Community 17 - "orders/[id].vue"
Cohesion: 0.03
Nodes (56): compiledOrderStatusLabel(), actionHints, addr, addressOpen, { authedFetch }, backLabel, backTo, booking (+48 more)

### Community 18 - "pos.vue"
Cohesion: 0.05
Nodes (34): attemptDeclined, { authedFetch }, awaitingBuyerScan, blocked, blockedIds, BlockedItem, cameraError, cancelling (+26 more)

### Community 19 - "labels.vue"
Cohesion: 0.07
Nodes (34): buildItem(), InventoryItem, InventoryItemInput, InventorySource, InventoryStatus, items, labelQueue, ListOptions (+26 more)

### Community 20 - "listings/[id]/edit.vue"
Cohesion: 0.12
Nodes (15): CardFormData, card, cardForm, cardId, { cards, loading, deleteCard }, deleting, error, existingImages (+7 more)

### Community 21 - "verify.vue"
Cohesion: 0.13
Nodes (20): accountCheck, accountError, billplzSandbox, form, { goToLogin }, { profile, updateProfile }, save(), saved (+12 more)

### Community 22 - "SellerSalesDashboard.vue"
Cohesion: 0.07
Nodes (28): actionTiles, avgOrder, axisMax, Bucket, byStatus(), chartMax, completedCount, counterDiscount (+20 more)

### Community 23 - "seller/orders/index.vue"
Cohesion: 0.11
Nodes (19): hasWaybill(), lastTracked, ORDER_QUEUE_LABELS, OrderQueue, useSellerOrders(), EMPTY_CAPTIONS, emptyCaption, emptyLabel (+11 more)

### Community 24 - "useOrders.ts"
Cohesion: 0.12
Nodes (17): carrier, emit, props, showTracking, submitTracking(), trackingNumber, buyerOrders, loadingBuyer (+9 more)

### Community 25 - "AppNavbar.vue"
Cohesion: 0.08
Nodes (25): activeTabKey, { cartCount }, cartOpen, {
  containerEl: tabsEl,
  setTabRef,
  indicatorStyle,
  measure: measureTab,
}, desktopLinks, desktopSellOpen, { goToLogin }, { hasUnread: sellerHasUnread, listen: listenNotifications } (+17 more)

### Community 26 - "SearchModal.vue"
Cohesion: 0.12
Nodes (18): auctionResults, { auctions }, cardResults, { cards }, close(), commit(), { dismissKeyboard }, emit (+10 more)

### Community 27 - "activity.vue"
Cohesion: 0.08
Nodes (26): actionRank(), activeBids, activeFilterLabel, activePurchases, activeTab, { auctions, loading }, { bidIndex }, {
  buyerCompiledOrders,
  loadingBuyer: ordersLoadingBuyer,
  listenBuyerCompiledOrders,
  markDelivered,
} (+18 more)

### Community 28 - "InstallPrompt.vue"
Cohesion: 0.13
Nodes (13): dismissForever(), dismissPrompt(), {
  shouldOfferInstall,
  canPromptNatively,
  isIosSafari,
  promptInstall,
  dismiss,
}, showIosSheet, subline, visible, dismiss(), dismissed (+5 more)

### Community 29 - "membership/index.vue"
Cohesion: 0.13
Nodes (10): PREMIUM_ENABLED, checkoutLoading, claimingBonus, freeFeatures, { goToLogin }, { isPremium, hasClaimedBonus, claimBonusScans }, portalLoading, premiumFeatures (+2 more)

### Community 30 - "useMarketPrice.ts"
Cohesion: 0.17
Nodes (11): extractMarketPrice(), MarketPrice, pickTcgPlayerBlock(), VARIANT_ORDER, buildQuery(), CardMarketPrices, TcgApiResponse, TcgCard (+3 more)

### Community 31 - "pages/login.vue"
Cohesion: 0.11
Nodes (28): backToStart(), busy, clear(), code, cooldown, destination(), displayName, email (+20 more)

### Community 32 - "CardFormFields.vue"
Cohesion: 0.10
Nodes (27): applyCatalogCard(), conditionChoices, emit, filledExtras, manualQuery, moreOpen, onCheckboxInput(), onInput() (+19 more)

### Community 33 - "book-shipment.ts"
Cohesion: 0.24
Nodes (13): BookResult, bookShipmentForOrder(), nextCollection(), NOTE: deliberately does NOT set status to "shipped". Booking a waybill, delyvaCancelOrder(), DelyvaOrderState, delyvaQuote(), QuotedShipping (+5 more)

### Community 34 - "useCompiledOrders.ts"
Cohesion: 0.11
Nodes (20): props, lastTracked, useBuyerTracking(), buyerCompiledOrders, CompiledOrder, CompiledOrderInputItem, CompiledOrderItem, CompiledOrderStatus (+12 more)

### Community 35 - "useListingFilters.ts"
Cohesion: 0.25
Nodes (8): FilterableItem, inBucket(), ListingFilters, ProductTypeFilter, SortKey, StatusFilter, TimeLeftBucket, useListingFilters()

### Community 36 - "setup.vue"
Cohesion: 0.14
Nodes (10): displayName, error, phone, previewUrl, { profile, updateProfile }, router, saving, selectedFile (+2 more)

### Community 37 - "CardTile.vue"
Cohesion: 0.12
Nodes (15): bidCount, conditionLabel, gradeBadgeClasses, imageCount, imageUrl, isAuction, item, linkTo (+7 more)

### Community 38 - "shared/payouts.ts"
Cohesion: 0.22
Nodes (21): categorizeFunds(), FundState, useSellerFunds(), computeSellerPayout(), isPayoutEligible(), isPayoutTrackable(), PAYOUT_HOLD_DAYS, PAYOUT_HOLD_MS (+13 more)

### Community 39 - "backdate-delivery.mjs"
Cohesion: 0.18
Nodes (8): args, before, daysIdx, db, env, list, orderId, ref

### Community 40 - "LandingHero.vue"
Cohesion: 0.17
Nodes (10): badge, ctas, game, games, line1, line2, nodes, rail (+2 more)

### Community 41 - "useAuctions.ts"
Cohesion: 0.12
Nodes (15): Auction, auctions, AuctionSummary, AutoBid, Bid, firestoreAuctions, initializeAuctions(), loading (+7 more)

### Community 42 - "CardSearchPicker.vue"
Cohesion: 0.08
Nodes (26): choose(), { dismissKeyboard }, emit, fetchPage(), goToPage(), lang, lastNumber, lastQuery (+18 more)

### Community 43 - "seed-pokemon-catalog.mjs"
Cohesion: 0.28
Nodes (12): buildRow(), CATEGORIES, detectLanguage(), extractField(), fetchGroups(), fetchJson(), fetchProducts(), main() (+4 more)

### Community 44 - "ListingFilters.vue"
Cohesion: 0.12
Nodes (15): chips, DEFAULT_OPEN, groups, isOpen(), manual, open, props, shortCondition() (+7 more)

### Community 45 - "useCardCatalog.ts"
Cohesion: 0.26
Nodes (14): buildPriceTrend(), CatalogSort, CollectionPriceTrend, dayTime(), ensureRate(), historyPoints(), pickPrice(), PricePoint (+6 more)

### Community 46 - "useInstallPrompt.ts"
Cohesion: 0.27
Nodes (10): BeforeInstallPromptEvent, checkStandalone(), deferredPrompt, dismissedAt, installedStandalone, isIos(), isIosSafari(), loadDismissed() (+2 more)

### Community 47 - "shipping-quote.ts"
Cohesion: 0.26
Nodes (11): buyerShippingPrice(), courierBrands(), isQuotableRate(), MAX_PLAUSIBLE_RATE_MYR, MIN_PLAUSIBLE_RATE_MYR, quotableRates(), quoteForOrder(), roundUpTo() (+3 more)

### Community 48 - "useReveal.ts"
Cohesion: 0.24
Nodes (9): Context, forceVisible(), Gsap, loadGsap(), prefersReducedMotion(), RevealApi, Timeline, TweenTarget (+1 more)

### Community 49 - "TCGo — Pokémon TCG Online Marketplace"
Cohesion: 0.20
Nodes (9): Architecture, Commands, Gotchas, graphify, 🧠 Mandatory Workflow (EVERY task, no exceptions), Stack, Step 1 — graphify FIRST, Step 2 — sequential-thinking SECOND (+1 more)

### Community 50 - "CatalogMatch"
Cohesion: 0.24
Nodes (8): CatalogMatch, CatalogPrice, queue, randomId(), ScanQueueItem, ScanStatus, useScanQueue(), ReviewRow

### Community 51 - "snapshot-pokemon-prices.mjs"
Cohesion: 0.33
Nodes (10): aggregatePrices(), CATEGORY_IDS, fetchGroups(), fetchJson(), fetchPrices(), loadKnownProductIds(), main(), pace() (+2 more)

### Community 52 - "TCGo Roadmap / TODO"
Cohesion: 0.20
Nodes (9): Catalog / UX, 🧹 Cleanup, 🗓️ Later / backlog, 🎯 Next — POS (original goal), Payments & fulfillment, 🚦 Pre-deploy / pre-launch checklist, ✅ Shipped, TCGo Roadmap / TODO (+1 more)

### Community 53 - "LandingPosVisual.vue"
Cohesion: 0.25
Nodes (7): lines, paid, qrBtn, root, rows, tapBtn, total

### Community 54 - "pricing.vue"
Cohesion: 0.04
Nodes (51): cta, intro, pricing, pricingStats, secondary, secondaryItems, avgSale, breakdown (+43 more)

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
Cohesion: 0.12
Nodes (18): activeTcg, availableCards, { cards, loading }, { discoveryOrder }, filters, onScroll(), page, pageCards (+10 more)

### Community 59 - "search-query.ts"
Cohesion: 0.14
Nodes (22): parsed, looksLikeCardNumber(), NUMBER_PREFIXES, numberCandidates(), NumberSplit, PREFIXED, splitCardNumber(), initialsOf() (+14 more)

### Community 60 - "LandingNavbar.vue"
Cohesion: 0.22
Nodes (6): { goToLogin }, { isAdmin }, mobileLinks, mobileMenuOpen, { profile }, {user, authLoading,  signOut}

### Community 61 - "sequential-thinking"
Cohesion: 0.33
Nodes (5): graphify, sequential-thinking, graphify-mcp, npx, @modelcontextprotocol/server-sequential-thinking

### Community 62 - "FavouriteButton.vue"
Cohesion: 0.33
Nodes (4): isFav, { isFavourited, toggleFavourite }, props, { user }

### Community 63 - "payouts.vue"
Cohesion: 0.12
Nodes (18): submit(), busy, error, execute(), fmt(), isAdmin, load(), loading (+10 more)

### Community 64 - "collection/index.vue"
Cohesion: 0.05
Nodes (40): appliedQuery, applyFilters(), busyIds, collectionCards, collectionLoading, collectionProductIds, { dismissKeyboard }, effectiveRarityMatch (+32 more)

### Community 65 - "useSearchHistory.ts"
Cohesion: 0.47
Nodes (5): history, load(), loaded, persist(), useSearchHistory()

### Community 66 - "payouts/[id].vue"
Cohesion: 0.15
Nodes (9): { authedFetch }, history, loading, nextStep, payout, route, { user }, payoutHistory() (+1 more)

### Community 68 - "TCGo Supabase (catalog)"
Cohesion: 0.33
Nodes (5): Automated nightly cron, Daily price snapshot, One-time setup, Refreshing, TCGo Supabase (catalog)

### Community 69 - "staff-auth.ts"
Cohesion: 0.11
Nodes (33): noteAction(), burnPasswordTime(), createSession(), destroySession(), hashPassword(), hashToken(), loadRole(), loadRoles() (+25 more)

### Community 71 - "useScanQuota.ts"
Cohesion: 0.50
Nodes (4): BONUS_SCANS, firstOfNextMonth(), FREE_SCAN_LIMIT, useScanQuota()

### Community 72 - "useTheme.ts"
Cohesion: 0.39
Nodes (8): applyTheme(), init(), lightHolds, resolved, systemPrefersDark(), Theme, useLightOnlySurface(), useTheme()

### Community 73 - "useUserCollection.ts"
Cohesion: 0.40
Nodes (3): CollectionEntry, entries, loading

### Community 74 - "create-charge.post.ts"
Cohesion: 0.36
Nodes (10): Body, releaseExpiredReservations(), isDiscounted(), lineDiscount(), PosPaymentMethod, PosSaleLine, posTotals(), recordedPosFee() (+2 more)

### Community 75 - "LandingDashboardVisual.vue"
Cohesion: 0.50
Nodes (3): days, root, total

### Community 76 - "LandingFeatureRow.vue"
Cohesion: 0.50
Nodes (3): copy, root, visual

### Community 77 - "ProfileItem.vue"
Cohesion: 0.50
Nodes (3): props, statusChip, statusLabel

### Community 78 - "useAuth.ts"
Cohesion: 0.33
Nodes (3): AUTH_MESSAGES, authLoading, user

### Community 79 - "onboarding.ts"
Cohesion: 0.16
Nodes (20): hasBankDetails(), hasDeliveryAddress(), hasHandover(), hasIdentity(), hasSellerContact(), isOnboardingExempt(), isSellerOnboardingExempt(), ONBOARDING_STEPS (+12 more)

### Community 80 - "seller/auctions/index.vue"
Cohesion: 0.14
Nodes (13): activeAuctions, { auctions, loading }, { authedFetch }, endedAuctions, getWinner(), { goToLogin }, myAuctions, settled (+5 more)

### Community 81 - "layouts/seller.vue"
Cohesion: 0.09
Nodes (12): isActive(), navItems, openSheet, PRIMARY, primaryNav, route, sheetIsActive(), SheetKey (+4 more)

### Community 83 - "schema.sql"
Cohesion: 0.31
Nodes (7): card_prices, card_prices_touch, cards_catalog, cards_catalog_touch, list_rarities(), search_catalog(), touch_updated_at()

### Community 85 - "[productId].vue"
Cohesion: 0.06
Nodes (30): card, { cards: marketplaceCards, loading: listingsLoading }, collectionBusy, collectionButtonLabel, fullTrend, { getCardWithPrice, getPriceHistory, getRelatedCards }, GradedPriceRow, historyAgeDays (+22 more)

### Community 86 - "useCards.ts"
Cohesion: 0.12
Nodes (17): Card, cards, initialize(), loading, useCards(), activeCards, { cards, loading: cardsLoading, markAsSold }, { goToLogin } (+9 more)

### Community 87 - "ShipmentTimeline.vue"
Cohesion: 0.20
Nodes (7): emptyMessage, etaLabel, events, LABEL_OVERRIDES, props, TrackEvent, Tracking

### Community 119 - "settle.post.ts"
Cohesion: 0.29
Nodes (7): useAdmin(), ADMIN_UIDS, isAdminUid(), AUCTION_PAYMENT_WINDOW_HOURS, AUCTION_PAYMENT_WINDOW_MS, AUCTION_SETTLED_STATUSES, auctionHasEnded()

### Community 127 - "finance.ts"
Cohesion: 0.15
Nodes (26): actualCommission(), BILLPLZ_FPX_FEE, BILLPLZ_PAYOUT_FEE, commissionAtLaunch(), courierCost(), FinanceOrder, FinancePayout, FinancePosSale (+18 more)

### Community 128 - "LandingInventoryVisual.vue"
Cohesion: 0.22
Nodes (8): chargeBtn, onlinePanel, posPanel, pulse, pulseDot, root, stockNum, syncChip

### Community 129 - "AddMethodPicker.vue"
Cohesion: 0.29
Nodes (6): AddMethod, ALL, props, scanBlocked, showQuota, visible

### Community 130 - "seller/index.vue"
Cohesion: 0.18
Nodes (8): { goToLogin }, { items: inventoryItems, listenMyInventory }, posSales, router, { sellerCompiledOrders, loadingSeller, listenSellerCompiledOrders }, { startAutoMerge }, { startIfNew: startTourIfNew }, {user}

### Community 131 - "ChoiceGroup.vue"
Cohesion: 0.33
Nodes (5): Choice, colsClass, normalised, props, sizeClass

### Community 132 - "pos-payment.ts"
Cohesion: 0.20
Nodes (12): hitpay, hitpayBase(), hitpayConfig(), hitpayHeaders(), isPlatformMode(), isPosPaymentConfigured(), isSellerConnected(), MerchantCredential (+4 more)

### Community 133 - "confirm"
Cohesion: 0.15
Nodes (14): removeGroup(), confirm, cancelPaidOrder(), cancelShipment(), handleCancel(), handleMarkDelivered(), bulkMarkSold(), bulkRemove() (+6 more)

### Community 134 - "funds/index.vue"
Cohesion: 0.12
Nodes (17): { authedFetch: syncFetch }, {
  available,
  locked,
  queued,
  paidOut,
  availableTotal,
  withdrawalFee,
  payoutPreview,
  canWithdraw,
  lockedTotal,
  queuedTotal,
  lastFailureReason,
  requestPayout,
}, doRequestPayout(), fmt(), { goToLogin }, isSubmitted(), { listenSellerCompiledOrders }, monthLabel (+9 more)

### Community 135 - "account.vue"
Cohesion: 0.11
Nodes (21): buildHeaders(), ready(), StaffMe, state(), useMcFetch(), useStaffAuth(), busy, current (+13 more)

### Community 136 - "payout-details.ts"
Cohesion: 0.24
Nodes (12): useSellerKyc(), bankLine, accountHint, selectedBank, bankByCode(), resolveBankCode(), kycGatePassed(), MY_STATES (+4 more)

### Community 138 - "auth-codes.ts"
Cohesion: 0.08
Nodes (38): SAME_ANSWER, REFUSAL, CODE_TTL_MS, codeKey(), CodePurpose, consumeCode(), ConsumeResult, digest() (+30 more)

### Community 139 - "firebase-admin.ts"
Cohesion: 0.15
Nodes (13): MIN_PASSWORD_LENGTH, REFUSAL, CANCELLABLE, PROBES, AuthedUser, requireAdmin(), requireUser(), cancelShipmentForOrder() (+5 more)

### Community 140 - "payment/success.vue"
Cohesion: 0.14
Nodes (14): BROWSE, copy, delayed, formatDate(), { orderId, order, phase, view, paying, payNow }, orderPath, PURCHASES, receiptLine (+6 more)

### Community 141 - "handleFile"
Cohesion: 0.50
Nodes (4): autoMap(), handleFile(), parseCsv(), parseSpreadsheet()

### Community 142 - "settings.vue"
Cohesion: 0.11
Nodes (14): { authedFetch }, availableCouriers, courierNotice, couriersLoading, { goToLogin }, handover, HANDOVER_OPTIONS, pickupLine (+6 more)

### Community 145 - "photo-policy.ts"
Cohesion: 0.25
Nodes (7): bulkList(), listPhotoOk, handleSubmit(), HIGH_VALUE_THRESHOLD, PhotoRequirement, photoRequirementMet(), TOP_CONDITIONS

### Community 147 - "isAvailable"
Cohesion: 0.21
Nodes (13): available, reserved, BlockedItem, checkStockAvailability(), reserveItems(), StockUnavailableError, AvailabilityView, availableOnly() (+5 more)

### Community 148 - "parsePasted"
Cohesion: 0.50
Nodes (4): detectDelim(), handlePaste(), parsePasted(), splitByMode()

### Community 149 - "clear-order-history.mjs"
Cohesion: 0.15
Nodes (12): args, backup, confirmed, db, env, held, path, PRESERVED (+4 more)

### Community 150 - "usePaymentResult.ts"
Cohesion: 0.13
Nodes (19): {}, emit, { goToLogin }, PaymentResultCopy, PaymentResultCta, PaymentResultPhase, usePaymentResult(), copy (+11 more)

### Community 151 - "identifyPhotos"
Cohesion: 0.67
Nodes (3): blobToBase64(), identifyPhotos(), resizeImage()

### Community 152 - "staff.vue"
Cohesion: 0.07
Nodes (25): busy, catalogue, createdId, dialog, dialogError, error, form, grouped (+17 more)

### Community 153 - "reconcile"
Cohesion: 0.67
Nodes (3): cell(), reconcile(), toNumber()

### Community 155 - "mintcondition/index.vue"
Cohesion: 0.09
Nodes (17): data, error, isAdmin, loading, { mcFetch }, { me, can }, mrr, Overview (+9 more)

### Community 156 - "seed-mock-listings.mjs"
Cohesion: 0.12
Nodes (20): args, clean, CONDITIONS, confirmed, db, env, GRADERS, H (+12 more)

### Community 157 - "admin.vue"
Cohesion: 0.14
Nodes (6): allNav, { me, can, logout }, navItems, route, soonItems, stroke

### Community 158 - "AdminIdentityPanel.vue"
Cohesion: 0.17
Nodes (11): badge, data, error, fmtDate(), Identity, loading, { mcFetch }, nameMismatch (+3 more)

### Community 159 - "payouts/index.vue"
Cohesion: 0.17
Nodes (8): { authedFetch }, { goToLogin }, load(), loading, payouts, reload(), {user}, PAYOUT_STATUS_LABEL

### Community 160 - "AdminStat.vue"
Cohesion: 0.50
Nodes (3): props, toneClass, valueClass

### Community 161 - "KycVerifyCard.vue"
Cohesion: 0.20
Nodes (9): { authedFetch }, error, { profile }, route, start(), starting, status, teardown() (+1 more)

### Community 164 - "pages/onboarding.vue"
Cohesion: 0.11
Nodes (17): addr, busy, code, cooldown, email, error, notice, { profile, saveAddresses, loading: loadingProfile } (+9 more)

### Community 165 - "sales/index.vue"
Cohesion: 0.11
Nodes (11): { authedFetch }, channel, data, error, loading, period, periodCards, selected (+3 more)

### Community 166 - "delivery-stage.ts"
Cohesion: 0.13
Nodes (17): cancelled, copied, courierNote, current, props, BUYER_TIMELINE, CANCELLED_CODE_MIN, COLLECTED_CODE_MIN (+9 more)

### Community 167 - "logs.vue"
Cohesion: 0.10
Nodes (13): area, busy, error, kind, load(), loading, { mcFetch }, nextBefore (+5 more)

### Community 168 - "utils/oplog.ts"
Cohesion: 0.16
Nodes (18): ACTION_LOG_TTL_DAYS, actorOf(), ERROR_LOG_TTL_DAYS, logAction(), LogActionInput, logError(), LogErrorInput, noteError() (+10 more)

### Community 169 - "AutoPayoutPanel.vue"
Cohesion: 0.13
Nodes (17): busy, { can }, canEdit, config, dryRun(), error, fields, load() (+9 more)

### Community 170 - "join-parcel.ts"
Cohesion: 0.26
Nodes (12): joinPaidOrderToParcel(), JoinResult, round2(), Destination, destKey(), findOpenParcelFor(), norm(), closedReason() (+4 more)

### Community 171 - "auto-run.post.ts"
Cohesion: 0.23
Nodes (9): AutoPayoutConfig, AutoPayoutDecision, CandidateBatch, configProblem(), decideAutoPayouts(), DEFAULT_AUTO_PAYOUT, MAX_AUTO_ATTEMPTS, SKIP_LABELS (+1 more)

### Community 172 - "backfill-payouts.mjs"
Cohesion: 0.15
Nodes (10): confirmed, db, env, fixable, locked, MONEY_MOVED, overpaid, reprice (+2 more)

### Community 173 - "useProfile.ts"
Cohesion: 0.24
Nodes (8): isNewUser, loading, MembershipTier, profile, SubscriptionStatus, UserProfile, Address, KycStatus

### Community 174 - "login.vue"
Cohesion: 0.25
Nodes (8): busy, error, go(), { login, ensure }, password, route, staffId, submit()

### Community 175 - "CartDrawer.vue"
Cohesion: 0.16
Nodes (11): allSelected, close(), emit, { items, cartTotal, removeFromCart }, onKey(), props, removeOne(), selected (+3 more)

### Community 176 - "SellerOnboardingTour.vue"
Cohesion: 0.14
Nodes (23): { active, stop }, allSteps, begin(), centred(), findTarget(), finish(), focusTarget(), index (+15 more)

### Community 177 - "useShopOrdering.ts"
Cohesion: 0.26
Nodes (10): hashScrollMarginTop(), scrollBehavior(), shopSavedTop(), dayKey(), Orderable, rank(), sessionSeed(), SHOP_PAGE_SIZE (+2 more)

### Community 179 - "addManual"
Cohesion: 0.40
Nodes (5): addManual(), blankCardForm(), noteAdded(), onScanFinished(), resetManual()

### Community 180 - "PriceTrendChart.vue"
Cohesion: 0.13
Nodes (16): active, areaPath, linePath, onMove(), onTouch(), pick(), plot, props (+8 more)

### Community 181 - "notifications.ts"
Cohesion: 0.17
Nodes (15): items, loading, useNotifications(), notify(), AppNotification, badgeLabel(), byNewest(), DraftNotification (+7 more)

### Community 182 - "invoices/[id].vue"
Cohesion: 0.27
Nodes (8): { firestore }, fmt(), issuedOn, loading, order, paidOn, placedOn, route

### Community 183 - "seller/onboarding.vue"
Cohesion: 0.11
Nodes (18): accountOk, bankOptions, busy, config, error, form, HANDOVER_OPTIONS, { profile, updateProfile, loading: loadingProfile } (+10 more)

### Community 184 - "AddressBook.vue"
Cohesion: 0.19
Nodes (14): addresses, blank(), busy, cancel(), commit(), editing, error, form (+6 more)

### Community 185 - "releases.ts"
Cohesion: 0.33
Nodes (9): useWhatsNew(), APP_VERSION, compareVersions(), MAX_SHOWN, Release, RELEASES, unseenReleases(), allNotes (+1 more)

### Community 186 - "pos-settle.ts"
Cohesion: 0.43
Nodes (6): releaseItems(), settleItems(), finalisePosSale(), FinaliseResult, PosOutcome, PosSaleStatus

### Community 190 - "PosPaymentSheet.vue"
Cohesion: 0.33
Nodes (5): countdown, now, props, receiptEmail, secondsLeft

### Community 191 - "settlement.ts"
Cohesion: 0.23
Nodes (14): lines, postage, props, splitFee(), feeCharged(), KNOWN_RATES, payoutAmount(), rateCharged() (+6 more)

### Community 195 - "payout-ledger.ts"
Cohesion: 0.45
Nodes (6): getMassPaymentInstruction(), mapInstructionStatus(), settlePayout(), PayoutBatch, PayoutBatchStatus, PayoutEvent

### Community 196 - "merge.post.ts"
Cohesion: 0.26
Nodes (12): addressKey(), combineItems(), MergeableOrder, mergeGroupKey(), MergeMode, mergeModeFor(), MergeOrderItem, paidFinancials() (+4 more)

### Community 197 - "sales/[id].vue"
Cohesion: 0.15
Nodes (8): { authedFetch }, error, loading, route, sale, statusClass, { user }, METHOD_LABELS

### Community 198 - "wipe-firebase.mjs"
Cohesion: 0.15
Nodes (12): auth, authUsers, backup, backupPath, confirmed, db, env, includeStaff (+4 more)

### Community 199 - "listing-lifecycle.ts"
Cohesion: 0.26
Nodes (12): daysUntilExpiry(), expiresAt(), isDeleted(), isExpired(), isExpiringSoon(), isListable(), LifecycleView, listableOnly() (+4 more)

### Community 200 - "addresses.ts"
Cohesion: 0.26
Nodes (15): confirmRemove(), save(), useMyProfile(), defaultAddress(), FlatDelivery, formatAddress(), fromFlatFields(), isCompleteAddress() (+7 more)

### Community 201 - "locked.vue"
Cohesion: 0.22
Nodes (8): fmtDate(), { goToLogin }, { listenSellerCompiledOrders }, { locked, lockedTotal }, lockReason(), nextUnlock, open, {user}

### Community 202 - "buyer-qr.ts"
Cohesion: 0.29
Nodes (8): error, qr, { user }, BUYER_QR_PREFIX, buyerQrPayload(), isPlausibleEmail(), normaliseEmail(), parseBuyerQr()

### Community 203 - "seller-sales.ts"
Cohesion: 0.31
Nodes (10): CONCLUDED_ORDER_STATUSES, lineFromItem(), loadSellerSale(), loadSellerSales(), round2(), SaleChannel, SaleOrigin, SellerSale (+2 more)

### Community 204 - "NotificationBell.vue"
Cohesion: 0.20
Nodes (5): { notifications, loading, unread, hasUnread, listen, markRead, markAllRead }, open, panel, route, { user }

### Community 205 - "addItem"
Cohesion: 0.29
Nodes (7): addItem(), beep(), feedback(), handleDecoded(), loop(), resolveBuyer(), sendReceipt()

### Community 206 - "showToast"
Cohesion: 0.24
Nodes (10): cancelPayment(), closeSheet(), openPayment(), payCash(), removeBlocked(), resetReceipt(), showToast(), startPayment() (+2 more)

### Community 207 - "sales-summary.ts"
Cohesion: 0.30
Nodes (10): EMPTY_TOTALS, round2(), SalesPeriods, SalesTotals, startOfDayMs(), STATUS_LABELS, summariseByMethod(), summariseByPeriod() (+2 more)

### Community 208 - "PaymentCardFan.vue"
Cohesion: 0.25
Nodes (7): cards, GLOW, LABEL, LAYOUT, props, TONE, PaymentBadge

### Community 209 - "VerifiedBadge.vue"
Cohesion: 0.25
Nodes (5): open, panel, props, trigger, verifiedOn

### Community 210 - "didit.ts"
Cohesion: 0.22
Nodes (7): DIDIT_BASE, DIDIT_KYC_WORKFLOW_ID, DIDIT_WEBHOOK_MAX_SKEW_SECONDS, DiditStatus, isKycVerified(), KYC_REQUIRED, kycStatusFor()

### Community 211 - "shared/shipping.ts"
Cohesion: 0.25
Nodes (7): handlePlaceOrders(), clearCart(), EAST_MALAYSIA_STATES, regionForState(), ShippableOrder, ShippingRegion, totalForRegion()

### Community 212 - "useCart.ts"
Cohesion: 0.40
Nodes (3): CartItem, items, SellerGroup

### Community 213 - "execute-payout.ts"
Cohesion: 0.33
Nodes (5): createMassPaymentCollection(), ExecuteActor, executePayoutBatch(), ExecuteResult, PayoutClaimError

### Community 214 - "listingMatchesCard"
Cohesion: 0.67
Nodes (4): activeGradedListings, listingMatchesCard(), normalizeNumber(), normalizeText()

### Community 216 - "formatHistoryDate"
Cohesion: 0.67
Nodes (3): formatHistoryDate(), historyCoverageLabel, unavailableRangeLabel

### Community 227 - "WhatsNewSheet.vue"
Cohesion: 0.40
Nodes (3): dismissButton, headline, { open, showing, dismiss }

### Community 229 - "startCamera"
Cohesion: 0.67
Nodes (3): armBuyerScan(), primeAudio(), startCamera()

## Knowledge Gaps
- **1495 isolated node(s):** `graphify-mcp`, `npx`, `@modelcontextprotocol/server-sequential-thinking`, `props`, `ALL` (+1490 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **26 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `confirm` connect `confirm` to `funds/index.vue`, `account.vue`, `addresses.ts`, `AutoPayoutPanel.vue`, `orders/[id].vue`, `photo-policy.ts`, `useCards.ts`, `payouts.vue`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Why does `InventoryItem` connect `labels.vue` to `items/index.vue`, `pos.vue`, `SellerSalesDashboard.vue`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Why does `CatalogMatch` connect `CatalogMatch` to `CardFormFields.vue`, `collection/index.vue`, `items/index.vue`, `[uid].vue`, `import.vue`, `CardSearchPicker.vue`, `useCardCatalog.ts`, `[productId].vue`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Are the 17 inferred relationships involving `confirm` (e.g. with `confirmRemove()` and `runNow()`) actually correct?**
  _`confirm` has 17 INFERRED edges - model-reasoned connections that need verification._
- **What connects `graphify-mcp`, `npx`, `@modelcontextprotocol/server-sequential-thinking` to the rest of the system?**
  _1495 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `delyva.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12987012987012986 - nodes in this community are weakly interconnected._
- **Should `items/index.vue` be split into smaller, more focused modules?**
  _Cohesion score 0.027777777777777776 - nodes in this community are weakly interconnected._