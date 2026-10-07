<script setup lang="ts">
import { OPERATOR, POLICY_DEFAULTS as D, POLICY_NUMBERS as N } from "~/shared/legal";

definePageMeta({ layout: "landing" });
useHead({ title: "Refund Policy · TCGo" });
</script>

<template>
  <LegalDoc
    title="Refund Policy"
    :summary="`You can cancel within ${N.cancelMinutes} minutes of paying. After delivery you have ${D.claimWindowDays} days to tell us if your order didn't arrive, isn't as described, or is fake. The seller isn't paid until that time has passed, so a valid claim gets your money back.`"
  >
    <p>
      This policy explains when buyers get money back for orders paid through
      TCGo checkout. It is part of our
      <NuxtLink to="/terms">Terms of Use</NuxtLink>. It does not take away any
      right you have under the Consumer Protection Act 1999 or other
      Malaysian law.
    </p>

    <h2>1. What this policy covers</h2>
    <p>
      Orders and auction wins paid through TCGo checkout (Billplz). It does
      not cover:
    </p>
    <ul>
      <li>deals arranged or paid outside TCGo;</li>
      <li>cash or QR sales at a shop's POS counter, which follow that shop's own policy;</li>
      <li>Premium subscriptions, covered in section 7.</li>
    </ul>

    <h2>2. Cancelling before shipping</h2>
    <table>
      <thead>
        <tr><th>Situation</th><th>Refund</th></tr>
      </thead>
      <tbody>
        <tr>
          <td>You cancel within {{ N.cancelMinutes }} minutes of paying, before shipping is booked</td>
          <td>
            The order total, less a processing fee of {{ N.cancelFeePercent }}
            (maximum {{ N.cancelFeeCap }}), which covers the payment and
            refund transfer costs
          </td>
        </tr>
        <tr>
          <td>
            The seller hasn't shipped within {{ D.shipWithinBusinessDays }}
            business days after the cancellation window closes
          </td>
          <td>Full refund, no fee. Contact us to cancel</td>
        </tr>
        <tr>
          <td>The seller cancels, or the item turns out to be unavailable</td>
          <td>Full refund, no fee</td>
        </tr>
        <tr>
          <td>You change your mind after shipping is booked</td>
          <td>No refund, unless the seller agrees</td>
        </tr>
      </tbody>
    </table>

    <h2>3. Buyer Protection claims after delivery</h2>
    <p>
      We hold the payment for every order until it is delivered and
      {{ D.claimWindowDays }} days have passed. Within those
      {{ D.claimWindowDays }} days you can claim if:
    </p>
    <ul>
      <li><b>Not received:</b> tracking shows delivered but you don't have it, or the parcel is lost or stuck in transit;</li>
      <li><b>Not as described:</b> wrong card, set, edition, language or quantity; condition clearly worse than listed; undisclosed damage; or something missing;</li>
      <li><b>Counterfeit:</b> the item is fake, a proxy, or altered;</li>
      <li><b>Damaged in transit</b> because of poor packing or courier handling.</li>
    </ul>
    <p>
      If the order shows as delivered and no claim is made within
      {{ D.claimWindowDays }} days, the order is complete and the payment is
      released to the seller. After that we can still help with counterfeit
      items, but we may no longer be able to recover the money.
    </p>

    <h3>Not covered</h3>
    <ul>
      <li>Changing your mind, or finding a cheaper price elsewhere.</li>
      <li>Small differences that fit the condition the seller listed and their photos.</li>
      <li>Disagreeing with a professional grade on a graded card, unless the slab is fake or tampered with.</li>
      <li>Market price changes after you buy.</li>
      <li>Problems caused after delivery, such as damage from handling.</li>
    </ul>

    <h2>4. How to make a claim</h2>
    <ol>
      <li>
        Email {{ OPERATOR.supportEmail }} within {{ D.claimWindowDays }} days
        of delivery with your order number, what's wrong, and photos or video.
        A video of opening the parcel is the strongest evidence; please record
        one for valuable orders.
      </li>
      <li>Keep the item, packaging and label as you received them.</li>
      <li>
        We ask the seller to respond, usually within 2 business days, and may
        ask either of you for more information.
      </li>
      <li>
        We decide the claim based on the listing, photos, tracking and what
        both sides tell us. We may approve a full refund, a partial refund
        (where you keep the item), or a return.
      </li>
      <li>
        If we ask for a return, send it with tracking within
        {{ D.returnShipDays }} days. The seller pays return postage when the
        claim is the seller's fault. Your refund is sent when the return is
        delivered back.
      </li>
    </ol>
    <p>
      Counterfeit items will not be returned to the seller if doing so would
      put a fake back into circulation; we may keep them as evidence or ask
      you to destroy them.
    </p>

    <h2>5. How refunds are paid</h2>
    <ul>
      <li>
        Refunds are sent to your Malaysian bank account through Billplz. We'll
        ask for the account holder's name, bank, account number and IC number,
        which Billplz needs to send the transfer.
      </li>
      <li>
        We send approved refunds within {{ D.refundWithinBusinessDays }}
        business days. Your bank may take a little longer to show it.
      </li>
      <li>
        Approved claims are refunded in full, including shipping you paid,
        with no processing fee. The fee in section 2 applies only when you
        cancel for your own reasons.
      </li>
    </ul>

    <h2>6. Auctions</h2>
    <p>
      Auction orders follow the same rules once paid. If you win and don't pay
      within {{ N.auctionPayHours }} hours, the result is cancelled; repeated
      non-payment can lead to your bidding being restricted.
    </p>

    <h2>7. Premium subscriptions</h2>
    <p>
      You can cancel Premium at any time and keep it until the end of the paid
      month. We don't refund part months, except where the law requires it,
      where you were charged in error, or where we ended Premium early. Email
      {{ OPERATOR.supportEmail }} about a wrong charge within 30 days.
    </p>

    <h2>8. If you disagree with our decision</h2>
    <p>
      Reply to our decision email with any new information and we'll take
      another look. Our decision under Buyer Protection doesn't stop you or
      the seller taking the matter to the Tribunal for Consumer Claims
      Malaysia or to court.
    </p>
  </LegalDoc>
</template>
