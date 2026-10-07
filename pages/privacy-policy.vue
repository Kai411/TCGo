<script setup lang="ts">
import { OPERATOR, POLICY_DEFAULTS as D } from "~/shared/legal";

definePageMeta({ layout: "landing" });
useHead({ title: "Privacy Policy · TCGo" });
</script>

<template>
  <LegalDoc
    title="Privacy Policy"
    summary="We collect what we need to run a safe card marketplace: your account, orders, chat messages, addresses, and for sellers, identity and bank details. We share it only with the services that make TCGo work and with the other party to your order as needed to deliver it. We never sell your data."
  >
    <p>
      This notice is given under the Personal Data Protection Act 2010
      (PDPA). It explains what personal data {{ OPERATOR.legalName }}
      ("TCGo", "we") collects, why, who we share it with and your rights. It
      applies to everyone who uses TCGo, including buyers, sellers, shops
      using the POS counter and visitors.
    </p>

    <h2>1. What we collect</h2>
    <table>
      <thead>
        <tr><th>Data</th><th>When we collect it</th></tr>
      </thead>
      <tbody>
        <tr>
          <td>Name, display name, email, profile photo, and a password (stored only in hashed form by Firebase) or your Google account identifier</td>
          <td>When you create an account or sign in with Google</td>
        </tr>
        <tr>
          <td>Phone number, delivery addresses and pickup address</td>
          <td>When you buy, sell or book shipping</td>
        </tr>
        <tr>
          <td>Orders, bids, listings, photos, collection and inventory records, POS sales, favourites and reports you make</td>
          <td>When you use those features</td>
        </tr>
        <tr>
          <td>Chat messages you send and receive, the photos and the orders or listings you attach, and safety warnings shown on a message</td>
          <td>When you use chat</td>
        </tr>
        <tr>
          <td>When you were last online, and your average time to reply in chat</td>
          <td>Automatically while you have TCGo open, and when you reply to a message</td>
        </tr>
        <tr>
          <td>Payment records: amount, status, reference and payment method. Not your online banking password or full card number</td>
          <td>When you pay through Billplz, subscribe through Stripe or pay at a counter through HitPay</td>
        </tr>
        <tr>
          <td>Bank account name, bank and account number</td>
          <td>Sellers, for payouts. Buyers, when a refund is due</td>
        </tr>
        <tr>
          <td>MyKad / IC number</td>
          <td>When needed to send a refund or payout through Billplz</td>
        </tr>
        <tr>
          <td>Identity verification: photo of your ID document, a selfie and liveness check, face match result and IP-based checks. We keep the result, your verified name, document type and issuing state</td>
          <td>Sellers, during verification through our provider Didit</td>
        </tr>
        <tr>
          <td>Device and usage data: IP address, browser, pages used, error logs</td>
          <td>Automatically when you use TCGo</td>
        </tr>
      </tbody>
    </table>
    <p>
      <b>Sensitive data.</b> The selfie and face matching used for identity
      verification involve biometric data, which the PDPA treats as sensitive
      personal data. We only process it with your explicit consent, given
      when you start verification, and only to confirm you are who you say
      you are.
    </p>

    <h2>2. Why we use it</h2>
    <ul>
      <li>To create and secure your account and confirm your email.</li>
      <li>To run orders: take payment, hold it under Buyer Protection, arrange shipping, pay sellers and send refunds.</li>
      <li>To verify sellers, prevent fraud and counterfeits, and keep the marketplace safe.</li>
      <li>To meet legal duties, including keeping seller and transaction records required by the Consumer Protection (Electronic Trade Transactions) Regulations and tax law.</li>
      <li>To handle reports, complaints and Buyer Protection claims.</li>
      <li>To let buyers and sellers message each other, and to warn you before you send a message that looks risky, such as one with a phone number, bank details, an address or a request to pay outside TCGo. This check runs automatically on the text of each message; it warns, it never blocks.</li>
      <li>To send service messages: order updates, receipts, invoices, security alerts. You can't opt out of these while you have an account, as they are part of the service.</li>
      <li>To send news or offers, only if you opt in. You can opt out any time.</li>
      <li>To improve TCGo, for example by understanding which features are used.</li>
    </ul>
    <p>
      Giving us your data is voluntary, but if you don't provide what a
      feature needs (for example a delivery address to ship, or identity
      verification to sell), you won't be able to use that feature.
    </p>

    <h2>3. Who we share it with</h2>
    <h3>Other members</h3>
    <ul>
      <li>Your display name, profile photo, listings, verified badge and public profile are visible to everyone.</li>
      <li>When you buy, the seller gets what they need to fulfil the order, such as your name and order details. Shipping labels carry the delivery details couriers need.</li>
      <li>We don't show a seller's pickup address or bank details to buyers.</li>
      <li>When you message someone, they see your messages and anything you attach. Signed-in members can see when you were last online and your average reply time, in chat and on your profile.</li>
      <li>Photos sent in chat are stored on Cloudinary and can be opened by anyone who has the photo's link, so don't send photos of documents you want to keep private.</li>
      <li>Messages are private between the two people in the conversation. Authorised TCGo staff may read a conversation only to handle a report, a Buyer Protection claim, or suspected fraud.</li>
    </ul>
    <h3>Service providers</h3>
    <p>These companies process data for us, under their own security and privacy terms:</p>
    <ul>
      <li><b>Google Firebase / Google Cloud</b>: sign-in, database and hosting of app data.</li>
      <li><b>Google Gemini</b>: identifying cards from photos you choose to scan or upload.</li>
      <li><b>Billplz</b>: online payments, seller payouts and refunds.</li>
      <li><b>Stripe</b>: Premium subscription billing.</li>
      <li><b>HitPay</b>: QR payments at the POS counter.</li>
      <li><b>Didit</b>: seller identity verification.</li>
      <li><b>Delyva and its courier partners</b>: shipping quotes, labels and tracking.</li>
      <li><b>Cloudinary</b>: storing and serving images.</li>
      <li><b>Resend</b>: sending emails such as codes, receipts and invoices.</li>
      <li><b>Supabase</b>: card catalogue and price data.</li>
      <li><b>Netlify</b>: website hosting.</li>
    </ul>
    <p>
      Card price data comes from third-party sources such as TCGplayer,
      Cardmarket and Collectr. We only send them what is needed to look up a
      card, not your personal data.
    </p>
    <h3>Others</h3>
    <p>
      We may disclose data where the law requires it, to a regulator, court
      or the police; to protect members from fraud or harm; or to a successor
      if TCGo's business is transferred, who must keep using it under this
      policy. We do not sell your personal data.
    </p>

    <h2>4. Data stored outside Malaysia</h2>
    <p>
      Several of the providers above store or process data on servers outside
      Malaysia (for example in Singapore, the United States or the European
      Union). We transfer data only to providers that protect it to a
      standard at least comparable to the PDPA, as permitted by section 129
      of the PDPA.
    </p>

    <h2>5. How long we keep it</h2>
    <ul>
      <li>Account data: while your account is open, and up to 12 months after it is closed to deal with any remaining questions.</li>
      <li>Order, payment, payout and seller records: 7 years, as required for tax and accounting, and at least 3 years for seller records under consumer protection rules.</li>
      <li>Identity verification images and biometrics: held by Didit under its retention policy; we keep only the result and the details listed in section 1.</li>
      <li>Chat messages and photos: while your account is open, so both sides can refer back to them if there is a problem with an order, then as for account data.</li>
      <li>Logs: up to 12 months.</li>
    </ul>
    <p>After that we delete or anonymise it.</p>

    <h2>6. Security</h2>
    <p>
      We protect data with access controls, encryption in transit, and by
      limiting who on our team can see payment and identity details. No system
      is perfectly secure. If a breach is likely to cause significant harm, we
      will notify the Personal Data Protection Commissioner within 72 hours
      and affected users without undue delay, as the PDPA requires. Keep your
      own password safe and don't share login codes.
    </p>

    <h2>7. Your rights</h2>
    <p>Under the PDPA you can:</p>
    <ul>
      <li>ask for a copy of the personal data we hold about you;</li>
      <li>ask us to correct data that is wrong or incomplete;</li>
      <li>withdraw consent, or ask us to stop or limit processing, including for marketing;</li>
      <li>ask us to transfer your data to another service where the law gives you that right;</li>
      <li>ask us to close your account and delete your data, subject to the records we must keep by law.</li>
    </ul>
    <p>
      Email {{ OPERATOR.privacyEmail }}. We'll reply within 21 days. We may
      need to confirm your identity first, and may charge a fee the PDPA
      allows for a copy of your data.
    </p>

    <h2>8. Cookies and local storage</h2>
    <p>
      We use cookies and browser storage to keep you signed in, remember your
      cart and preferences such as dark mode, and make the app work offline.
      We do not currently use advertising cookies. If we add analytics or
      advertising tools we will update this policy first. Blocking cookies
      may stop parts of TCGo working.
    </p>

    <h2>9. Children</h2>
    <p>
      TCGo is not meant for children under 13, and we don't knowingly collect
      their data. Users under {{ D.minimumAge }} may only use TCGo with a
      parent or guardian's consent, and cannot sell. If you believe a child
      has given us data, contact us and we'll delete it.
    </p>

    <h2>10. Changes</h2>
    <p>
      We'll post any update here with a new effective date, and tell you by
      email or in the app if the change is significant.
    </p>

    <h2>11. Contact</h2>
    <p>
      {{ OPERATOR.legalName }}, {{ OPERATOR.address }}.<br />
      Privacy requests: {{ OPERATOR.privacyEmail }}. Other questions:
      {{ OPERATOR.supportEmail }}.
    </p>
    <p>
      If you're not satisfied with our answer, you can complain to the
      Personal Data Protection Commissioner of Malaysia (Jabatan
      Perlindungan Data Peribadi).
    </p>
  </LegalDoc>
</template>
