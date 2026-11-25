# Privacy runbook: data breaches and deletion requests

What to do, in order, when personal data may have leaked, and how to handle a member's request to delete or see their data. Keep it short enough to follow under stress.

> **Lawyer review needed.** The legal deadlines and duties below are our reading of the PDPA 2010 as amended in 2024 and the Commissioner's data breach notification guideline. They are not legal advice. Items marked **[LAWYER]** must be confirmed by a Malaysian lawyer before launch, and this file updated to match.

Owner: kai (until a Data Protection Officer is appointed). DPO contact for notices: `OPERATOR.privacyEmail` in `shared/legal.ts` (still a placeholder).

## Part A: data breach

A breach is any loss of, or access to, personal data by someone who shouldn't have it: a leaked key, a wrong Firestore rule, a staff account used by someone else, a laptop with an export on it, a provider (Firebase, Didit, Billplz, Mailtrap, Supabase, Cloudinary, Netlify) telling us they were breached.

### 1. First hour: contain

Start a written timeline now (time, what you saw, what you did). Everything below goes in it.

1. **Note the clock.** Write down the time you first became aware. The 72-hour window below counts from here **[LAWYER]**.
2. **Stop the leak.** Whichever applies:
   - A leaked server key: rotate it at the provider, then update the variable on every site (Netlify old and new) and redeploy. Server keys are listed under `runtimeConfig` in `nuxt.config.ts` (Firebase service account, Billplz, Didit, Mailtrap, Stripe, Supabase service key, VAPID).
   - A staff account: Mint Condition > Staff, deactivate it and revoke its sessions. If a role was misused, edit the role (saving revokes every holder's sessions).
   - A member account taken over: disable the user in Firebase console > Authentication until it's sorted out.
   - A Firestore rules hole: paste a fixed full `firestore.rules` from latest staging (a paste replaces everything).
   - Public files (chat photos on Cloudinary are readable by link): delete the asset in Cloudinary.
3. **Keep the evidence.** Don't delete logs. Export what matters from Mint Condition > Logs (Actions and Errors) and the provider's own logs before any retention period removes them. Every staff look-up of an identity record is in Logs > Actions, area Identity, action `identity.viewed`, with staff ID and IP.

### 2. Within 24 hours: assess

Answer these in the timeline:

- What data: which fields (IC number, bank account, address, phone, email, verified name, chat, passwords are only hashed by Firebase)?
- Whose data and roughly how many people? Use the uids in the logs.
- How it happened, and is it fully stopped?
- **Is significant harm likely?** Treat it as likely if IC numbers, bank details, or identity documents are involved, if the data could be used for fraud or identity theft, or if it affects many people **[LAWYER]**.

### 3. Within 72 hours: tell the Commissioner

If the breach is likely to cause significant harm, notify the Personal Data Protection Commissioner as soon as practicable and within 72 hours of becoming aware **[LAWYER: confirm deadline, form and channel]**. If facts are still missing, notify on time with what you know and follow up. If notifying late, write down why.

Include: what happened and when, data and people affected, likely consequences, what we did to contain it, what affected people should do, and the contact person.

### 4. Within 7 days: tell affected members

If significant harm is likely, tell affected members without unnecessary delay, and no later than 7 days after notifying the Commissioner **[LAWYER]**. Email them (not only an in-app notice), in plain words: what happened, what data, what we've done, what they should do (change password, watch their bank account, beware of calls quoting their IC), and how to contact us.

If Billplz-held money or bank details are involved, also tell Billplz.

### 5. Afterwards: record and fix

- Keep a breach record for every breach, even ones not reported: the timeline, the assessment, the decision to notify or not and why, and copies of notices. Keep it for at least 2 years **[LAWYER]**. Store it outside the repo (no personal data in git).
- Fix the root cause in a PR and note it in `docs/PROJECT_NOTES.md` if it changes a project-wide rule.

## Part B: access and deletion requests

There is no self-serve "close my account" or "download my data" feature yet. Requests arrive by email to the privacy address (Privacy Policy sections 5 and 7).

1. **Log the request** in the privacy request register (kept outside the repo, no IC or bank numbers in it): date, uid, email, what they asked for.
2. **Confirm it's them.** Reply from the address on the account, or ask them to sign in and send a Help Center enquiry.
3. **Reply within 21 days** (the Privacy Policy promises this) **[LAWYER]**.
4. **Deletion:** delete or anonymise the account, private profile, chats, enquiries, listings and Firebase Auth user. **Keep** order, payment, payout, refund and seller records for the retention periods in Privacy Policy section 5; anonymise the name on them where the law allows **[LAWYER]**. Didit holds the ID images and biometrics; ask Didit to delete the session if the member asks.
5. **Close the entry** in the register with what was deleted, what was kept and why, and the date.
