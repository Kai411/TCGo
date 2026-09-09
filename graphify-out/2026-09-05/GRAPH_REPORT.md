# Graph Report - PokeTcg  (2026-08-31)

## Corpus Check
- 287 files · ~390,924 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2666 nodes · 3909 edges · 194 communities (175 shown, 19 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 83 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `94b3ebfa`
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
- beta.vue
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
- BetaGate.vue
- LandingNavbar.vue
- sequential-thinking
- FavouriteButton.vue
- payouts.vue
- collection/index.vue
- useSearchHistory.ts
- invoice-email.ts
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
- usePhoneVerification.ts
- seller/auctions/index.vue
- layouts/seller.vue
- CardImage.vue
- schema.sql
- useTrustScore.ts
- [productId].vue
- listings/index.vue
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
- pricing.ts
- AdminStat.vue
- didit.ts
- CollectedBadge.vue
- payouts/[id].vue
- sales/index.vue
- logs.vue
- utils/oplog.ts
- AutoPayoutPanel.vue
- join-parcel.ts
- auto-run.post.ts
- backfill-payouts.mjs
- KycVerifyCard.vue
- login.vue
- CartDrawer.vue
- SellerOnboardingTour.vue
- useShopOrdering.ts
- addManual
- payouts/index.vue
- addPhotoToListingCandidate
- invoices/[id].vue
- closeAdd
- payout-ledger.ts
- PosPaymentSheet.vue
- settlement.ts
- qrcode.d.ts
- Auction
- merge.post.ts
- locked.vue

## God Nodes (most connected - your core abstractions)
1. `getAdminFirestore()` - 55 edges
2. `requireStaff()` - 28 edges
3. `requireUser()` - 25 edges
4. `isAvailable()` - 18 edges
5. `confirm` - 17 edges
6. `noteError()` - 17 edges
7. `stateName()` - 17 edges
8. `CatalogMatch` - 13 edges
9. `CompiledOrder` - 13 edges
10. `noteAction()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `runNow()` --calls--> `confirm`  [INFERRED]
  components/AutoPayoutPanel.vue → pages/mintcondition/account.vue
- `cardResults` --indirect_call--> `isAvailable()`  [INFERRED]
  components/SearchModal.vue → shared/card-availability.ts
- `fundEntries` --calls--> `categorizeFunds()`  [EXTRACTED]
  components/SellerSalesDashboard.vue → composables/useSellerFunds.ts
- `addressLine` --calls--> `stateName()`  [EXTRACTED]
  pages/cart.vue → shared/my-states.ts
- `tcgCounts` --indirect_call--> `isAvailable()`  [INFERRED]
  pages/index.vue → shared/card-availability.ts

## Import Cycles
- None detected.

## Communities (194 total, 19 thin omitted)

### Community 0 - "delyva.ts"
Cohesion: 0.14
Nodes (19): DELYVA_BASE, DelyvaAddress, delyvaBase(), delyvaConfig(), delyvaConsignmentNo(), DelyvaContact, delyvaCreateOrder(), delyvaGet() (+11 more)

### Community 1 - "items/index.vue"
Cohesion: 0.03
Nodes (51): addMode, addOpen, allFilteredSelected, allPageSelected, bulkBusy, cardForm, { cards, loading: cardsLoading }, CONDITIONS (+43 more)

### Community 2 - "auctions/new.vue"
Cohesion: 0.04
Nodes (42): addFiles(), AuctionDraftFields, canPublishDrafts, cardForm, { createAuction }, draftError, draftFields, DraftFileEntry (+34 more)

### Community 3 - "profile/index.vue"
Cohesion: 0.06
Nodes (25): addr, addressDirty, claimingBonus, editFavouritesPublic, editName, fullPhone, { isPremium, used: scansUsed, hasClaimedBonus, bonusRemaining, claimBonusScans }, periodEndLabel (+17 more)

### Community 4 - "listings/new.vue"
Cohesion: 0.04
Nodes (38): addFiles(), canPublishDrafts, cardForm, { createCard }, { createListedFromCard }, draftError, DraftFields, DraftFileEntry (+30 more)

### Community 5 - "dependencies"
Cohesion: 0.04
Nodes (47): @didit-protocol/sdk-web, dotenv, firebase, firebase-admin, nuxt, @nuxtjs/tailwindcss, dependencies, @didit-protocol/sdk-web (+39 more)

### Community 6 - "[uid].vue"
Cohesion: 0.05
Nodes (31): activeTab, { auctions }, { cards }, collectionCards, collectionValue, { containerEl, setTabRef, indicatorStyle, measure }, copied, emptyFavouritesCaption (+23 more)

### Community 7 - "billplz.ts"
Cohesion: 0.17
Nodes (21): PAYABLE_STATUSES, asciiSafe(), billplzAuthHeader(), billplzBaseUrl(), billplzBillState(), billplzDeleteBill(), billplzForm(), checksumOf() (+13 more)

### Community 8 - "auctions/[id].vue"
Cohesion: 0.06
Nodes (29): activeImageIndex, allImages, antiSnipeActive, { auction, bids, loading, placeBid, setAutoBid }, auctionId, auctionStatus, { authedFetch }, autoBidMax (+21 more)

### Community 9 - "import.vue"
Cohesion: 0.05
Nodes (31): { addMany }, CONDITIONS, DEFAULT_PASTE_HEADERS, defaultCondition, FieldKey, flow, headers, hideUnmatched (+23 more)

### Community 10 - "cart.vue"
Cohesion: 0.05
Nodes (37): CartItem, items, addressLine, allSelected, { authedFetch }, canCheckout, checkoutLabel, { createCompiledOrders } (+29 more)

### Community 11 - "reports.vue"
Cohesion: 0.06
Nodes (34): close(), description, emit, error, evidenceFiles, fileInput, handleSubmit(), props (+26 more)

### Community 12 - "CompiledOrderCard.vue"
Cohesion: 0.14
Nodes (16): counterpartyName, counterpartyProfileLink, counterpartyUid, props, statusColor, statusLabel, props, shortDate (+8 more)

### Community 13 - "[id]/index.vue"
Cohesion: 0.06
Nodes (29): activeImage, activeImageIndex, { addToCart, isInCart }, allImages, { authLoading }, card, cardId, { cards, loading, markInterested, recordView } (+21 more)

### Community 15 - "TCGo Roadmap"
Cohesion: 0.06
Nodes (31): At a glance, Collection tracker (scan-to-own), Competitive landscape (reference), Decisions locked in, Engineering hygiene (background, not version-gated), Env vars (Netlify), Future bets — Tier 3, Later — ergonomic wins (V 0.7.0+) (+23 more)

### Community 16 - "CardScanner.vue"
Cohesion: 0.09
Nodes (26): acceptScan(), blobToBase64(), cameraError, capture(), close(), dragOver, emit, finishScanning() (+18 more)

### Community 17 - "orders/[id].vue"
Cohesion: 0.04
Nodes (53): actionHints, addr, addressOpen, { authedFetch }, backLabel, backTo, booking, bookShipment() (+45 more)

### Community 18 - "pos.vue"
Cohesion: 0.06
Nodes (43): addItem(), attemptDeclined, { authedFetch }, beep(), blocked, blockedIds, BlockedItem, cameraError (+35 more)

### Community 19 - "labels.vue"
Cohesion: 0.07
Nodes (34): buildItem(), InventoryItem, InventoryItemInput, InventorySource, InventoryStatus, items, labelQueue, ListOptions (+26 more)

### Community 20 - "listings/[id]/edit.vue"
Cohesion: 0.12
Nodes (15): CardFormData, card, cardForm, cardId, { cards, loading, deleteCard }, deleting, error, existingImages (+7 more)

### Community 21 - "verify.vue"
Cohesion: 0.13
Nodes (20): accountError, bankOptions, billplzSandbox, form, { profile, updateProfile }, save(), saved, saving (+12 more)

### Community 22 - "SellerSalesDashboard.vue"
Cohesion: 0.07
Nodes (28): actionTiles, avgOrder, axisMax, Bucket, byStatus(), chartMax, completedCount, counterDiscount (+20 more)

### Community 23 - "seller/orders/index.vue"
Cohesion: 0.12
Nodes (17): hasWaybill(), lastTracked, ORDER_QUEUE_LABELS, OrderQueue, useSellerOrders(), EMPTY_CAPTIONS, emptyCaption, emptyLabel (+9 more)

### Community 24 - "useOrders.ts"
Cohesion: 0.12
Nodes (17): carrier, emit, props, showTracking, submitTracking(), trackingNumber, buyerOrders, loadingBuyer (+9 more)

### Community 25 - "AppNavbar.vue"
Cohesion: 0.09
Nodes (22): activeTabKey, { cartCount }, cartOpen, {
  containerEl: tabsEl,
  setTabRef,
  indicatorStyle,
  measure: measureTab,
}, desktopLinks, desktopSellOpen, IconActivity(), IconCollection() (+14 more)

### Community 26 - "SearchModal.vue"
Cohesion: 0.15
Nodes (15): auctionResults, { auctions }, cardResults, { cards }, close(), commit(), emit, { history, remember, forget, clear } (+7 more)

### Community 27 - "activity.vue"
Cohesion: 0.08
Nodes (24): actionRank(), activeBids, activeFilterLabel, activePurchases, activeTab, { auctions, loading }, { bidIndex }, {
  buyerCompiledOrders,
  loadingBuyer: ordersLoadingBuyer,
  listenBuyerCompiledOrders,
  markDelivered,
} (+16 more)

### Community 28 - "InstallPrompt.vue"
Cohesion: 0.14
Nodes (12): dismissForever(), dismissPrompt(), {
  shouldOfferInstall,
  canPromptNatively,
  isIosSafari,
  promptInstall,
  dismiss,
}, showIosSheet, subline, visible, dismiss(), dismissed (+4 more)

### Community 29 - "membership/index.vue"
Cohesion: 0.14
Nodes (9): PREMIUM_ENABLED, checkoutLoading, claimingBonus, freeFeatures, { isPremium, hasClaimedBonus, claimBonusScans }, portalLoading, premiumFeatures, { profile } (+1 more)

### Community 30 - "useMarketPrice.ts"
Cohesion: 0.17
Nodes (11): extractMarketPrice(), MarketPrice, pickTcgPlayerBlock(), VARIANT_ORDER, buildQuery(), CardMarketPrices, TcgApiResponse, TcgCard (+3 more)

### Community 31 - "beta.vue"
Cohesion: 0.13
Nodes (11): expectations, isVerified, normalizedPhone, otp, phone, { profile }, { sendCode, verifyCode, sending, verifying, error, codeSent, reset }, step (+3 more)

### Community 32 - "CardFormFields.vue"
Cohesion: 0.10
Nodes (27): applyCatalogCard(), conditionChoices, emit, filledExtras, manualQuery, moreOpen, onCheckboxInput(), onInput() (+19 more)

### Community 33 - "book-shipment.ts"
Cohesion: 0.23
Nodes (14): BookResult, bookShipmentForOrder(), nextCollection(), NOTE: deliberately does NOT set status to "shipped". Booking a waybill, delyvaCancelOrder(), DelyvaOrderState, delyvaQuote(), QuotedShipping (+6 more)

### Community 34 - "useCompiledOrders.ts"
Cohesion: 0.11
Nodes (18): props, buyerCompiledOrders, CompiledOrder, CompiledOrderInputItem, CompiledOrderItem, CompiledOrderStatus, CompiledPaymentMethod, groupItemsBySeller() (+10 more)

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
Cohesion: 0.23
Nodes (18): categorizeFunds(), FundState, useSellerFunds(), computeSellerPayout(), isPayoutEligible(), isPayoutTrackable(), PAYOUT_HOLD_MS, payoutEligibleAt() (+10 more)

### Community 39 - "backdate-delivery.mjs"
Cohesion: 0.18
Nodes (8): args, before, daysIdx, db, env, list, orderId, ref

### Community 40 - "LandingHero.vue"
Cohesion: 0.17
Nodes (10): badge, ctas, game, games, line1, line2, nodes, rail (+2 more)

### Community 41 - "useAuctions.ts"
Cohesion: 0.18
Nodes (9): auctions, AuctionSummary, AutoBid, Bid, firestoreAuctions, initializeAuctions(), loading, summaries (+1 more)

### Community 42 - "CardSearchPicker.vue"
Cohesion: 0.06
Nodes (36): choose(), emit, fetchPage(), goToPage(), lang, lastQuery, loading, page (+28 more)

### Community 43 - "seed-pokemon-catalog.mjs"
Cohesion: 0.30
Nodes (11): buildRow(), CATEGORIES, detectLanguage(), extractField(), fetchGroups(), fetchJson(), fetchProducts(), main() (+3 more)

### Community 44 - "ListingFilters.vue"
Cohesion: 0.12
Nodes (15): chips, DEFAULT_OPEN, groups, isOpen(), manual, open, props, shortCondition() (+7 more)

### Community 45 - "useCardCatalog.ts"
Cohesion: 0.17
Nodes (19): buildPriceTrend(), CatalogSort, CollectionPriceTrend, dayTime(), ensureRate(), historyPoints(), matchRarity(), ParsedQuery (+11 more)

### Community 46 - "useInstallPrompt.ts"
Cohesion: 0.27
Nodes (10): BeforeInstallPromptEvent, checkStandalone(), deferredPrompt, dismissedAt, installedStandalone, isIos(), isIosSafari(), loadDismissed() (+2 more)

### Community 47 - "shipping-quote.ts"
Cohesion: 0.23
Nodes (11): buyerShippingPrice(), courierBrands(), CourierRate, isQuotableRate(), MAX_PLAUSIBLE_RATE_MYR, MIN_PLAUSIBLE_RATE_MYR, quotableRates(), roundUpTo() (+3 more)

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
Cohesion: 0.36
Nodes (9): aggregatePrices(), CATEGORY_IDS, fetchGroups(), fetchJson(), fetchPrices(), loadKnownProductIds(), main(), supabase (+1 more)

### Community 52 - "TCGo Roadmap / TODO"
Cohesion: 0.20
Nodes (9): Catalog / UX, 🧹 Cleanup, 🗓️ Later / backlog, 🎯 Next — POS (original goal), Payments & fulfillment, 🚦 Pre-deploy / pre-launch checklist, ✅ Shipped, TCGo Roadmap / TODO (+1 more)

### Community 53 - "LandingPosVisual.vue"
Cohesion: 0.25
Nodes (7): lines, paid, qrBtn, root, rows, tapBtn, total

### Community 54 - "pricing.vue"
Cohesion: 0.06
Nodes (31): avgSale, breakdown, calc, compare, comparison, counterMethods, cta, currentPlan (+23 more)

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

### Community 63 - "payouts.vue"
Cohesion: 0.12
Nodes (18): submit(), busy, error, execute(), fmt(), isAdmin, load(), loading (+10 more)

### Community 64 - "collection/index.vue"
Cohesion: 0.05
Nodes (36): appliedQuery, applyFilters(), busyIds, collectionCards, collectionLoading, collectionProductIds, effectiveRarityMatch, effectiveSetMatch (+28 more)

### Community 65 - "useSearchHistory.ts"
Cohesion: 0.47
Nodes (5): history, load(), loaded, persist(), useSearchHistory()

### Community 66 - "invoice-email.ts"
Cohesion: 0.24
Nodes (10): esc(), fmtDate(), InvoiceEmail, money(), renderInvoiceEmail(), MailAddress, mailConfigured(), sendMail() (+2 more)

### Community 68 - "TCGo Supabase (catalog)"
Cohesion: 0.33
Nodes (5): Automated nightly cron, Daily price snapshot, One-time setup, Refreshing, TCGo Supabase (catalog)

### Community 69 - "staff-auth.ts"
Cohesion: 0.11
Nodes (35): noteAction(), burnPasswordTime(), createSession(), destroySession(), hashPassword(), hashToken(), loadRole(), loadRoles() (+27 more)

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
Cohesion: 0.20
Nodes (17): discountOf(), totals, Body, releaseExpiredReservations(), releaseItems(), settleItems(), finalisePosSale(), FinaliseResult (+9 more)

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

### Community 80 - "seller/auctions/index.vue"
Cohesion: 0.15
Nodes (12): activeAuctions, { auctions, loading }, { authedFetch }, endedAuctions, getWinner(), myAuctions, settled, settleEnded() (+4 more)

### Community 81 - "layouts/seller.vue"
Cohesion: 0.12
Nodes (5): navItems, route, soonItems, { start: startTour }, stroke

### Community 83 - "schema.sql"
Cohesion: 0.31
Nodes (7): card_prices, card_prices_touch, cards_catalog, cards_catalog_touch, list_rarities(), search_catalog(), touch_updated_at()

### Community 85 - "[productId].vue"
Cohesion: 0.05
Nodes (44): activeGradedListings, card, { cards: marketplaceCards, loading: listingsLoading }, collectionBusy, collectionButtonLabel, formatHistoryDate(), formatMyr(), formatPriceRange() (+36 more)

### Community 86 - "listings/index.vue"
Cohesion: 0.12
Nodes (16): Card, cards, initialize(), loading, useCards(), activeCards, { cards, loading: cardsLoading, markAsSold }, handleMarkAsSold() (+8 more)

### Community 87 - "ShipmentTimeline.vue"
Cohesion: 0.20
Nodes (7): emptyMessage, etaLabel, events, LABEL_OVERRIDES, props, TrackEvent, Tracking

### Community 119 - "settle.post.ts"
Cohesion: 0.29
Nodes (7): useAdmin(), ADMIN_UIDS, isAdminUid(), AUCTION_PAYMENT_WINDOW_HOURS, AUCTION_PAYMENT_WINDOW_MS, AUCTION_SETTLED_STATUSES, auctionHasEnded()

### Community 127 - "finance.ts"
Cohesion: 0.16
Nodes (23): actualCommission(), BILLPLZ_FPX_FEE, BILLPLZ_PAYOUT_FEE, commissionAtLaunch(), courierCost(), FinanceOrder, FinancePayout, incomeTaxProvision() (+15 more)

### Community 128 - "LandingInventoryVisual.vue"
Cohesion: 0.22
Nodes (8): chargeBtn, onlinePanel, posPanel, pulse, pulseDot, root, stockNum, syncChip

### Community 129 - "AddMethodPicker.vue"
Cohesion: 0.29
Nodes (6): AddMethod, ALL, props, scanBlocked, showQuota, visible

### Community 130 - "seller/index.vue"
Cohesion: 0.20
Nodes (7): { items: inventoryItems, listenMyInventory }, posSales, router, { sellerCompiledOrders, loadingSeller, listenSellerCompiledOrders }, { startAutoMerge }, { startIfNew: startTourIfNew }, { user, signInWithGoogle }

### Community 131 - "ChoiceGroup.vue"
Cohesion: 0.33
Nodes (5): Choice, colsClass, normalised, props, sizeClass

### Community 132 - "pos-payment.ts"
Cohesion: 0.14
Nodes (13): hitpay, hitpayBase(), hitpayConfig(), hitpayHeaders(), isPlatformMode(), isPosPaymentConfigured(), isSellerConnected(), MerchantCredential (+5 more)

### Community 133 - "confirm"
Cohesion: 0.15
Nodes (14): removeGroup(), confirm, cancelPaidOrder(), cancelShipment(), handleCancel(), handleMarkDelivered(), bulkMarkSold(), bulkRemove() (+6 more)

### Community 134 - "funds/index.vue"
Cohesion: 0.13
Nodes (16): { authedFetch: syncFetch }, {
  available,
  locked,
  queued,
  paidOut,
  availableTotal,
  lockedTotal,
  queuedTotal,
  lastFailureReason,
  requestPayout,
}, doRequestPayout(), fmt(), isSubmitted(), { listenSellerCompiledOrders }, monthLabel, monthStart (+8 more)

### Community 135 - "account.vue"
Cohesion: 0.15
Nodes (12): busy, current, done, error, first, { mcFetch }, { me, refresh }, mismatch (+4 more)

### Community 136 - "payout-details.ts"
Cohesion: 0.42
Nodes (8): bankLine, bankByCode(), bankName(), resolveBankCode(), payoutDetailsComplete(), PayoutProfile, PayoutRecipient, toPayoutRecipient()

### Community 139 - "firebase-admin.ts"
Cohesion: 0.18
Nodes (11): CANCELLABLE, PROBES, AuthedUser, requireAdmin(), requireUser(), cancelShipmentForOrder(), getAdminApp(), getAdminAuth() (+3 more)

### Community 140 - "payment/success.vue"
Cohesion: 0.14
Nodes (14): BROWSE, copy, delayed, formatDate(), { orderId, order, phase, view, paying, payNow }, orderPath, PURCHASES, receiptLine (+6 more)

### Community 141 - "handleFile"
Cohesion: 0.50
Nodes (4): autoMap(), handleFile(), parseCsv(), parseSpreadsheet()

### Community 142 - "settings.vue"
Cohesion: 0.12
Nodes (13): { authedFetch }, availableCouriers, courierNotice, couriersLoading, handover, HANDOVER_OPTIONS, pickupLine, preferredCouriers (+5 more)

### Community 145 - "photo-policy.ts"
Cohesion: 0.25
Nodes (7): bulkList(), listPhotoOk, handleSubmit(), HIGH_VALUE_THRESHOLD, PhotoRequirement, photoRequirementMet(), TOP_CONDITIONS

### Community 147 - "isAvailable"
Cohesion: 0.18
Nodes (15): topSellers, topSets, available, reserved, BlockedItem, checkStockAvailability(), reserveItems(), StockUnavailableError (+7 more)

### Community 148 - "parsePasted"
Cohesion: 0.50
Nodes (4): detectDelim(), handlePaste(), parsePasted(), splitByMode()

### Community 149 - "clear-order-history.mjs"
Cohesion: 0.15
Nodes (12): args, backup, confirmed, db, env, held, path, PRESERVED (+4 more)

### Community 150 - "usePaymentResult.ts"
Cohesion: 0.09
Nodes (25): cards, GLOW, LABEL, LAYOUT, props, TONE, emit, { signInWithGoogle } (+17 more)

### Community 151 - "identifyPhotos"
Cohesion: 0.67
Nodes (3): blobToBase64(), identifyPhotos(), resizeImage()

### Community 152 - "staff.vue"
Cohesion: 0.06
Nodes (32): buildHeaders(), ready(), StaffMe, state(), useMcFetch(), useStaffAuth(), busy, catalogue (+24 more)

### Community 153 - "reconcile"
Cohesion: 0.67
Nodes (3): cell(), reconcile(), toNumber()

### Community 155 - "mintcondition/index.vue"
Cohesion: 0.10
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

### Community 159 - "pricing.ts"
Cohesion: 0.14
Nodes (15): cta, intro, pricing, pricingStats, secondary, secondaryItems, BETA_PRICING, BETA_RATE (+7 more)

### Community 160 - "AdminStat.vue"
Cohesion: 0.50
Nodes (3): props, toneClass, valueClass

### Community 161 - "didit.ts"
Cohesion: 0.18
Nodes (10): useSellerKyc(), DIDIT_BASE, DIDIT_KYC_WORKFLOW_ID, DIDIT_WEBHOOK_MAX_SKEW_SECONDS, DiditStatus, isKycVerified(), KYC_REQUIRED, kycGatePassed() (+2 more)

### Community 164 - "payouts/[id].vue"
Cohesion: 0.15
Nodes (9): { authedFetch }, history, loading, nextStep, payout, route, { user }, payoutHistory() (+1 more)

### Community 165 - "sales/index.vue"
Cohesion: 0.05
Nodes (39): { authedFetch }, error, loading, route, sale, statusClass, { user }, { authedFetch } (+31 more)

### Community 167 - "logs.vue"
Cohesion: 0.10
Nodes (13): area, busy, error, kind, load(), loading, { mcFetch }, nextBefore (+5 more)

### Community 168 - "utils/oplog.ts"
Cohesion: 0.17
Nodes (17): ACTION_LOG_TTL_DAYS, actorOf(), ERROR_LOG_TTL_DAYS, logAction(), LogActionInput, logError(), LogErrorInput, StaffPrincipal (+9 more)

### Community 169 - "AutoPayoutPanel.vue"
Cohesion: 0.13
Nodes (17): busy, { can }, canEdit, config, dryRun(), error, fields, load() (+9 more)

### Community 170 - "join-parcel.ts"
Cohesion: 0.22
Nodes (12): joinPaidOrderToParcel(), JoinResult, round2(), Destination, destKey(), findOpenParcelFor(), norm(), closedReason() (+4 more)

### Community 171 - "auto-run.post.ts"
Cohesion: 0.23
Nodes (9): AutoPayoutConfig, AutoPayoutDecision, CandidateBatch, configProblem(), decideAutoPayouts(), DEFAULT_AUTO_PAYOUT, MAX_AUTO_ATTEMPTS, SKIP_LABELS (+1 more)

### Community 172 - "backfill-payouts.mjs"
Cohesion: 0.15
Nodes (10): confirmed, db, env, fixable, locked, MONEY_MOVED, overpaid, reprice (+2 more)

### Community 173 - "KycVerifyCard.vue"
Cohesion: 0.11
Nodes (13): { authedFetch }, error, { profile }, starting, status, tone, isNewUser, loading (+5 more)

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

### Community 180 - "payouts/index.vue"
Cohesion: 0.18
Nodes (7): { authedFetch }, load(), loading, payouts, reload(), { user, signInWithGoogle }, PAYOUT_STATUS_LABEL

### Community 182 - "invoices/[id].vue"
Cohesion: 0.27
Nodes (8): { firestore }, fmt(), issuedOn, loading, order, paidOn, placedOn, route

### Community 185 - "payout-ledger.ts"
Cohesion: 0.42
Nodes (5): mapInstructionStatus(), settlePayout(), PayoutBatch, PayoutBatchStatus, PayoutEvent

### Community 190 - "PosPaymentSheet.vue"
Cohesion: 0.40
Nodes (4): countdown, now, props, secondsLeft

### Community 191 - "settlement.ts"
Cohesion: 0.22
Nodes (15): lines, postage, props, recordedSst(), splitFee(), feeCharged(), KNOWN_RATES, payoutAmount() (+7 more)

### Community 195 - "Auction"
Cohesion: 0.29
Nodes (6): Auction, BidItem, { auctions, loading }, filters, publicAuctions, AuctionStatus

### Community 196 - "merge.post.ts"
Cohesion: 0.26
Nodes (12): addressKey(), combineItems(), MergeableOrder, mergeGroupKey(), MergeMode, mergeModeFor(), MergeOrderItem, paidFinancials() (+4 more)

### Community 201 - "locked.vue"
Cohesion: 0.22
Nodes (8): fmtDate(), { listenSellerCompiledOrders }, { locked, lockedTotal }, lockReason(), nextUnlock, open, { user, signInWithGoogle }, PAYOUT_HOLD_DAYS

## Knowledge Gaps
- **1339 isolated node(s):** `graphify-mcp`, `npx`, `@modelcontextprotocol/server-sequential-thinking`, `props`, `ALL` (+1334 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `confirm` connect `confirm` to `funds/index.vue`, `account.vue`, `AutoPayoutPanel.vue`, `orders/[id].vue`, `photo-policy.ts`, `listings/index.vue`, `payouts.vue`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Why does `InventoryItem` connect `labels.vue` to `items/index.vue`, `pos.vue`, `SellerSalesDashboard.vue`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Why does `CatalogMatch` connect `CatalogMatch` to `CardFormFields.vue`, `collection/index.vue`, `items/index.vue`, `[uid].vue`, `import.vue`, `CardSearchPicker.vue`, `useCardCatalog.ts`, `[productId].vue`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `isAvailable()` (e.g. with `cardResults` and `availableCards`) actually correct?**
  _`isAvailable()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Are the 16 inferred relationships involving `confirm` (e.g. with `runNow()` and `removeGroup()`) actually correct?**
  _`confirm` has 16 INFERRED edges - model-reasoned connections that need verification._
- **What connects `graphify-mcp`, `npx`, `@modelcontextprotocol/server-sequential-thinking` to the rest of the system?**
  _1339 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `delyva.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1380952380952381 - nodes in this community are weakly interconnected._