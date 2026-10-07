<script setup lang="ts">
import { OPERATOR, POLICY_DEFAULTS as D, POLICY_NUMBERS as N } from "~/shared/legal";

definePageMeta({ layout: "landing" });
useHead({ title: "Seller Policy · TCGo" });
</script>

<template>
  <LegalDoc
    title="Seller Policy"
    :summary="`Verify who you are, list only genuine cards you have in hand, describe them honestly, and ship within ${D.shipWithinBusinessDays} business days. You get paid ${D.claimWindowDays} days after delivery, less a ${N.commission} commission.`"
  >
    <p>
      This policy applies to anyone who lists or sells on TCGo, including
      auctions. It is part of our <NuxtLink to="/terms">Terms of Use</NuxtLink>.
      If you sell, you also agree to it.
    </p>

    <h2>1. Who can sell</h2>
    <ul>
      <li>You must be {{ D.minimumAge }} or older, or a business registered in Malaysia.</li>
      <li>
        You must verify your identity (MyKad and selfie, through our provider
        Didit) before listing. Businesses must also give their SSM
        registration number.
      </li>
      <li>Payouts go only to a Malaysian bank account in your own name or your business's name.</li>
      <li>Keep your contact details, pickup address and bank details accurate.</li>
    </ul>

    <h2>2. Information buyers must see</h2>
    <p>
      Malaysian e-commerce rules require sellers on a marketplace to disclose
      certain details. By selling, you agree that TCGo may show buyers your
      name or business name, your SSM registration number if you have one,
      and a way to contact you through TCGo, alongside each listing's
      description, price, payment and delivery terms. TCGo keeps records of
      sellers and sales for at least 3 years, as the law requires.
    </p>

    <h2>3. Listing rules</h2>
    <ul>
      <li>List only items you own and have in hand, ready to ship. No pre-orders unless TCGo has enabled them for your account.</li>
      <li>
        Describe the card accurately: name, set, number, edition, language,
        condition and any flaws. For graded cards, give the grading company,
        grade and certificate number.
      </li>
      <li>
        Use the condition scale honestly. If you're unsure between two grades,
        choose the lower one.
      </li>
      <li>
        Use your own photos of the actual item, not catalogue images, for
        graded cards, sealed product, anything listed as Mint or Near Mint, and
        anything priced at {{ N.highValuePhotoThreshold }} or more. Show flaws
        clearly.
      </li>
      <li>Mark items sold elsewhere as unavailable straight away.</li>
      <li>Set the price you'll honour. Don't change the terms after a buyer has paid.</li>
    </ul>

    <h2>4. Prohibited items</h2>
    <p>You may not list:</p>
    <ul>
      <li>counterfeit, proxy, custom-printed, reprinted or altered cards, or fake graded slabs;</li>
      <li>resealed, weighed, searched or tampered booster packs or sealed product;</li>
      <li>stolen goods, or items you don't have the right to sell;</li>
      <li>items that infringe trademarks or copyright, such as unlicensed merchandise;</li>
      <li>anything illegal to sell in Malaysia, or unrelated to trading cards and collecting, unless TCGo has allowed that category;</li>
      <li>"mystery" or lucky-draw listings where the buyer can't see what they are buying, unless TCGo has approved the format.</li>
    </ul>
    <p>
      <b>Counterfeits get zero tolerance.</b> Selling a fake leads to removal
      of all listings, suspension, a full refund to the buyer at your cost,
      and may be reported to the authorities.
    </p>

    <h2>5. Shipping</h2>
    <ul>
      <li>
        Buyers can cancel within {{ N.cancelMinutes }} minutes of paying, so
        shipping opens after that. Ship within
        {{ D.shipWithinBusinessDays }} business days after it opens, using the
        label booked through TCGo. If you don't, the buyer can cancel for a
        full refund.
      </li>
      <li>
        Pack cards to arrive in the condition listed: sleeve and toploader (or
        semi-rigid) at minimum, in a padded envelope or box. Use extra
        protection for graded and high-value cards.
      </li>
      <li>Hand the parcel to the courier as booked, with the label attached.</li>
      <li>Don't ship to a different address than the one on the order.</li>
    </ul>

    <h2>6. Fees</h2>
    <table>
      <thead>
        <tr><th>Fee</th><th>Amount</th></tr>
      </thead>
      <tbody>
        <tr>
          <td>Commission on online sales</td>
          <td>
            {{ N.commission }} of the item price (excluding shipping), deducted
            from the payout for that order
          </td>
        </tr>
        <tr>
          <td>Payout transfer</td>
          <td>{{ N.withdrawalFee }} per payout to your bank (this is what Billplz charges us)</td>
        </tr>
        <tr>
          <td>POS counter QR sales</td>
          <td>
            {{ N.posFee }} TCGo fee, plus HitPay's own processing fee. Cash
            sales recorded at the counter are free
          </td>
        </tr>
        <tr>
          <td>Shipping</td>
          <td>Paid by the buyer at checkout; TCGo buys the label</td>
        </tr>
        <tr>
          <td>Listing</td>
          <td>Free</td>
        </tr>
        <tr>
          <td>Premium (optional)</td>
          <td>{{ N.premiumMonthly }} a month for extra features. It doesn't change your commission</td>
        </tr>
      </tbody>
    </table>
    <p>
      Once TCGo is registered for Sales and Service Tax (SST), service tax
      will be added to our fees as the law requires. We will give you at
      least {{ D.changeNoticeDays }} days' notice of any fee change. Each
      order keeps the fee that applied when it was paid.
    </p>

    <h2>7. Getting paid</h2>
    <ul>
      <li>
        You appoint TCGo as your limited agent to collect payment from buyers
        for your TCGo orders. Once a buyer pays TCGo, they have paid you.
      </li>
      <li>
        Under Buyer Protection, an order's money becomes payable to you
        {{ D.claimWindowDays }} days after it is delivered, if no claim is
        open. You then request a payout, or it is sent automatically where
        that is switched on, by Billplz transfer to your verified bank
        account.
      </li>
      <li>
        Money is paid per order. TCGo doesn't keep a wallet or stored balance
        for you, and money awaiting release doesn't earn interest.
      </li>
      <li>
        If a claim is open, we hold that order's payout until it is decided.
        If a claim is upheld after you were paid (for example a counterfeit
        found later), you must repay the refunded amount, and we may deduct
        it from your later payouts.
      </li>
      <li>Off-platform, cash and POS sales are paid to you directly and never go through TCGo payouts.</li>
    </ul>

    <h2>8. Claims and returns</h2>
    <p>
      When a buyer makes a claim under the
      <NuxtLink to="/refund-policy">Refund Policy</NuxtLink>, reply within 2
      business days with any evidence you have, such as photos taken before
      packing. TCGo decides the claim. If you are at fault you pay any return
      postage and the refund comes out of that order's payout.
    </p>

    <h2>9. Buyer data</h2>
    <p>
      Use a buyer's name, address and contact details only to fulfil their
      order. Don't add them to mailing lists, share them, or contact them for
      anything else. You must handle them in line with the Personal Data
      Protection Act 2010.
    </p>

    <h2>10. Taxes and the law</h2>
    <p>
      You are responsible for declaring your income and paying your own
      taxes, and for complying with laws that apply to your business,
      including the Consumer Protection Act 1999. If you run a shop, your
      receipts, refunds and walk-in sales are your own responsibility.
    </p>

    <h2>11. No off-platform deals</h2>
    <p>
      Don't ask buyers you met on TCGo to pay outside TCGo for a listed item,
      and don't share payment details in listings or messages. It avoids
      Buyer Protection and is the most common way scams happen.
    </p>

    <h2>12. Enforcement</h2>
    <p>
      If you break this policy we may remove listings, hold payouts for
      affected orders, lower your visibility, restrict or suspend selling, or
      close your account, depending on how serious it is. We'll tell you what
      we did and why, unless the law or safety stops us, and you can ask us to
      review it by emailing {{ OPERATOR.supportEmail }}.
    </p>
  </LegalDoc>
</template>
