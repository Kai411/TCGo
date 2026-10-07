<script setup lang="ts">
import { OPERATOR, POLICY_DEFAULTS as D, POLICY_NUMBERS as N } from "~/shared/legal";

definePageMeta({ layout: "landing" });
useHead({ title: "Terms of Use · TCGo" });
</script>

<template>
  <LegalDoc
    title="Terms of Use"
    summary="TCGo is a marketplace where independent sellers sell trading cards to buyers. TCGo is not the seller. Buyers pay through TCGo, we hold the money under Buyer Protection until the order is delivered, then pay the seller. Buyers and sellers settle problems between themselves first; TCGo only decides where held money goes if they can't agree. Don't sell fakes, don't take deals off the platform, and treat other members fairly."
  >
    <h2>1. Who we are and what these terms cover</h2>
    <p>
      TCGo ("TCGo", "we", "us") is operated by {{ OPERATOR.legalName }}, a
      business registered in Malaysia (SSM {{ OPERATOR.registrationNo }}). These
      Terms of Use ("Terms") are a contract between you and us and apply to
      the TCGo website, web app and every service on it, including the
      marketplace, auctions, collection and inventory tools, market price
      checks, the point-of-sale (POS) counter, shipping bookings and Premium.
    </p>
    <p>These Terms work together with:</p>
    <ul>
      <li><NuxtLink to="/privacy-policy">Privacy Policy</NuxtLink>, which explains how we handle your personal data;</li>
      <li><NuxtLink to="/refund-policy">Refund Policy</NuxtLink>, which explains cancellations, Buyer Protection claims and refunds;</li>
      <li><NuxtLink to="/seller-policy">Seller Policy</NuxtLink>, which applies to you if you list or sell anything.</li>
    </ul>
    <p>
      By creating an account or using TCGo you agree to these Terms. If you do
      not agree, please do not use TCGo.
    </p>

    <h2>2. Eligibility and your account</h2>
    <ul>
      <li>
        You must be at least {{ D.minimumAge }} years old, or have your parent
        or legal guardian's permission and supervision to use TCGo. Selling
        requires you to be {{ D.minimumAge }} or over.
      </li>
      <li>Give accurate details and keep them up to date.</li>
      <li>
        Keep your login secure. You are responsible for what happens on your
        account unless it was caused by our failure to protect it. Tell us
        straight away at {{ OPERATOR.supportEmail }} if you think someone else
        has access.
      </li>
      <li>One person, one account, unless we agree otherwise. Accounts cannot be sold or transferred.</li>
    </ul>

    <h2>3. TCGo's role</h2>
    <p>
      TCGo is an online marketplace operator. Items are listed and sold by
      independent sellers, and the contract of sale for an item is between the
      buyer and the seller. TCGo is not the seller, does not own the items,
      and does not inspect items before they are shipped unless we say so for
      a specific order.
    </p>
    <p>We do, however:</p>
    <ul>
      <li>require sellers to verify their identity and to disclose the information Malaysian law requires;</li>
      <li>collect payment for orders placed on TCGo and release it to the seller under Buyer Protection (section 7);</li>
      <li>monitor listings and remove those that break our rules;</li>
      <li>provide a way to report problems with an order, and decide where held payments go when buyer and seller can't agree.</li>
    </ul>

    <h2>4. Buying</h2>
    <ul>
      <li>
        A listing's price, condition, photos and description are provided by
        the seller. Read them carefully before you buy. Prices are in Malaysian
        Ringgit (RM).
      </li>
      <li>
        Your order is placed when your payment is confirmed. The total at
        checkout shows the item price, shipping and any other charge before you
        pay.
      </li>
      <li>You can cancel an order in the cases set out in section 5.</li>
      <li>
        If you win an auction, you must pay within {{ N.auctionPayHours }}
        hours. If you do not, the result is cancelled and we may restrict your
        bidding.
      </li>
      <li>Bids are binding. Only bid what you intend to pay.</li>
    </ul>

    <h2>5. Cancelling an order</h2>
    <table>
      <thead>
        <tr><th>When</th><th>What happens</th></tr>
      </thead>
      <tbody>
        <tr>
          <td>Before you pay</td>
          <td>You can cancel the order from the order page at no cost.</td>
        </tr>
        <tr>
          <td>Within {{ N.cancelMinutes }} minutes of paying, before shipping is booked</td>
          <td>
            You can cancel from the order page. Sellers can't book shipping
            during these {{ N.cancelMinutes }} minutes. You get the order total
            back, less a processing fee of {{ N.cancelFeePercent }} (maximum
            {{ N.cancelFeeCap }}), and the items go back on sale. You'll need to
            give the bank account and IC number of the account holder so the
            refund can be sent.
          </td>
        </tr>
        <tr>
          <td>After {{ N.cancelMinutes }} minutes, or once shipping is booked</td>
          <td>
            You can no longer cancel yourself. Contact us; we will cancel only
            if the courier hasn't collected the parcel and the seller agrees,
            or if the seller hasn't shipped within
            {{ D.shipWithinBusinessDays }} business days (then with a full
            refund and no fee).
          </td>
        </tr>
        <tr>
          <td>Once the parcel is with the courier</td>
          <td>
            The order can't be cancelled. If something is wrong when it
            arrives, use Report a problem (see the
            <NuxtLink to="/refund-policy">Refund Policy</NuxtLink>).
          </td>
        </tr>
        <tr>
          <td>Auction wins</td>
          <td>
            Can't be cancelled by either side, paid or not, because a bid is a
            commitment. If the winner doesn't pay within
            {{ N.auctionPayHours }} hours, the result is cancelled
            automatically.
          </td>
        </tr>
        <tr>
          <td>Sellers</td>
          <td>
            A seller can cancel an order that hasn't been paid. A seller who
            can't fulfil a paid order must contact us, and the buyer gets a
            full refund with no fee.
          </td>
        </tr>
      </tbody>
    </table>
    <p>
      Refunds are sent by bank transfer through Billplz, usually within
      {{ D.refundWithinBusinessDays }} business days of the cancellation.
    </p>

    <h2>6. Selling</h2>
    <p>
      Anyone selling on TCGo must follow the
      <NuxtLink to="/seller-policy">Seller Policy</NuxtLink>, including
      identity verification, honest listings, shipping on time and the fees
      described there.
    </p>

    <h2>7. Payments and Buyer Protection</h2>
    <ul>
      <li>
        Online payments are processed by Billplz (FPX online banking and other
        methods it supports). We do not see or store your online banking
        password or full card details.
      </li>
      <li>
        By selling on TCGo, each seller appoints TCGo as its limited agent to
        collect the buyer's payment for that order. A buyer's payment to TCGo
        counts as payment to the seller.
      </li>
      <li>
        <b>Buyer Protection:</b> we hold the payment for each order until the
        item is delivered and the {{ D.claimWindowDays }}-day claim period after
        delivery has passed without a claim. Then we release the seller's
        share, less our fees, to the seller's bank account. If a valid claim
        is made, we refund the buyer instead, in whole or part.
      </li>
      <li>
        Buyer Protection is a feature of the TCGo marketplace. It is not a
        bank, deposit, trust, escrow or stored-value service, money held for an
        order does not earn interest, and neither buyers nor sellers hold a
        balance with TCGo that can be spent or transferred elsewhere.
      </li>
      <li>
        Buyer Protection covers only orders paid through TCGo checkout. It
        does not cover deals arranged or paid outside TCGo, cash sales or
        in-person POS sales.
      </li>
    </ul>

    <h2>8. Premium subscriptions</h2>
    <p>
      Premium is an optional monthly subscription (currently
      {{ N.premiumMonthly }} a month) billed through Stripe. It renews
      automatically each month until you cancel. You can cancel at any time
      from your account; Premium then stays active until the end of the
      period you have paid for. We do not give refunds for partial months,
      except where required by law or where we ended the service early
      through no fault of yours. We will give you notice before a price change
      applies to you.
    </p>

    <h2>9. Other tools: collection, prices, POS and shipping</h2>
    <ul>
      <li>
        <b>Market prices</b> shown on TCGo come from third-party sources and
        our own data. They are estimates for information only, may be out of
        date or wrong, and are not an offer, valuation or financial advice.
      </li>
      <li>
        <b>Card identification</b> from photos is automated and can be wrong.
        Check the result before you rely on it or list an item.
      </li>
      <li>
        <b>POS counter:</b> sales you record or take through the counter are
        your own sales to your own customers. You are responsible for them,
        for your receipts and for your taxes. QR payments at the counter are
        processed by HitPay under its own terms.
      </li>
      <li>
        <b>Shipping:</b> labels are booked with our courier partners on your
        behalf. Couriers' own terms, limits and claim procedures apply to
        parcels in their care.
      </li>
    </ul>

    <h2>10. Prohibited items and conduct</h2>
    <p>You must not:</p>
    <ul>
      <li>sell counterfeit, proxy, reprinted or altered cards as genuine, or any item that infringes someone else's rights;</li>
      <li>sell anything illegal in Malaysia, stolen, or listed in the Seller Policy as prohibited;</li>
      <li>misdescribe an item's condition, grade, edition, language or authenticity;</li>
      <li>arrange to complete a TCGo order, or a sale that started on TCGo, outside TCGo to avoid fees or Buyer Protection;</li>
      <li>bid on your own items, bid without intending to pay, or manipulate prices or feedback;</li>
      <li>harass, threaten, scam or defraud anyone;</li>
      <li>scrape, overload, reverse engineer or interfere with TCGo, or access accounts or data that are not yours;</li>
      <li>use TCGo for money laundering or any purpose unrelated to genuine trading.</li>
    </ul>

    <h2>11. Content you post</h2>
    <p>
      You keep ownership of photos, descriptions and other content you post.
      You give us a non-exclusive, royalty-free licence to host, display,
      resize and share that content to run and promote TCGo, for as long as it
      is on TCGo and for a reasonable time after. You confirm you have the
      right to post it. Card names, artwork and trademarks belong to their
      owners; TCGo is not affiliated with or endorsed by The Pokémon Company,
      Nintendo, or any other card publisher.
    </p>

    <h2>12. Suspension and closing accounts</h2>
    <p>
      We may remove listings, hold an order's payout while we investigate,
      limit features, or suspend or close an account if we reasonably believe
      it breaks these Terms or the law, puts other members at risk, or if we
      are required to by an authority. Where it is safe and lawful to do so
      we will tell you why and give you a chance to respond. Money owed to you
      for completed orders that were not part of the problem will still be
      paid. You can close your account at any time by contacting us, after
      any open orders are finished.
    </p>

    <h2>13. Disclaimers</h2>
    <p>
      We work hard to keep TCGo running and accurate, but it is provided "as
      is" and "as available". To the extent the law allows, we do not
      guarantee that TCGo will be uninterrupted or error-free, that any
      listing is accurate, or that any member will complete a transaction.
      Nothing in these Terms excludes a guarantee or right you have under the
      Consumer Protection Act 1999 or other law that cannot be excluded.
    </p>

    <h2>14. Limits on our liability</h2>
    <ul>
      <li>
        To the extent the law allows, TCGo is not liable for indirect or
        consequential loss, loss of profit, or loss caused by another member,
        a courier, a payment provider or an event outside our reasonable
        control.
      </li>
      <li>
        To the extent the law allows, our total liability to you for any claim
        about TCGo is limited to the greater of (a) the fees you paid to TCGo
        in the 6 months before the claim, and (b) RM {{ D.liabilityFloorRm }}.
        This does not limit what we owe under Buyer Protection or any refund
        you are entitled to under the Refund Policy.
      </li>
      <li>
        Nothing in these Terms limits liability for death or personal injury
        caused by our negligence, for fraud, or any other liability that cannot
        legally be limited.
      </li>
    </ul>

    <h2>15. Your responsibility to us</h2>
    <p>
      If you break these Terms or the law and someone makes a claim against
      TCGo because of it, you agree to cover the reasonable losses and costs
      we incur as a result.
    </p>

    <h2>16. Problems and disputes between members</h2>
    <p>
      A sale is a contract between the buyer and the seller, and disputes
      about it are theirs to settle. TCGo is not a party to the sale and does
      not act for either side. We expect buyers and sellers to resolve
      problems with each other first, politely and promptly.
    </p>
    <ul>
      <li>
        To raise a problem with an order, use <b>Report a problem</b> on the
        order page. The seller is told, and the payment for that order stays
        on hold while you talk.
      </li>
      <li>
        If you can't agree, either of you can ask TCGo to step in. Our role is
        limited to deciding, under Buyer Protection, whether the money we are
        holding for that order goes back to the buyer or on to the seller. We
        decide based on the listing, photos, tracking and what both sides tell
        us. See the <NuxtLink to="/refund-policy">Refund Policy</NuxtLink>.
      </li>
      <li>
        Our decision doesn't stop either of you taking the matter further
        against the other, for example to the Tribunal for Consumer Claims
        Malaysia. Any claim about the item itself is between buyer and seller.
      </li>
      <li>
        For a complaint about TCGo itself, email {{ OPERATOR.supportEmail }}.
        We aim to reply within 5 business days.
      </li>
    </ul>

    <h2>17. Changes</h2>
    <p>
      We may update these Terms as TCGo or the law changes. For material
      changes we will notify you by email or in the app at least
      {{ D.changeNoticeDays }} days before they take effect, unless a change is
      needed sooner for legal or security reasons. Orders placed before a
      change stay under the Terms that applied when they were placed.
    </p>

    <h2>18. Governing law</h2>
    <p>
      These Terms are governed by the laws of Malaysia, and the courts of
      Malaysia can hear disputes about them. This doesn't affect your right to
      use the Tribunal for Consumer Claims or any other forum the law gives
      you as a consumer.
    </p>

    <h2>19. General</h2>
    <p>
      If any part of these Terms is found unenforceable, the rest still
      applies. If we don't enforce a right straight away, we can still enforce
      it later. You may not transfer your rights under these Terms; we may
      transfer ours to a successor operating TCGo, such as a company we form,
      and will tell you if we do. These Terms are written in English. Where a
      Bahasa Malaysia version is provided, both versions have equal effect.
    </p>
  </LegalDoc>
</template>
