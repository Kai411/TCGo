// Start a Didit identity verification for the signed-in user.
//
// Server-side because the API key must never reach the browser. The caller is
// identified from their Firebase ID token, never from anything the client
// sends: `vendor_data` is what the webhook uses to decide whose profile to
// mark verified, so letting the browser choose it would let anyone claim
// someone else's verification.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireUser } from "~/server/utils/auth";
import { DIDIT_BASE, DIDIT_KYC_WORKFLOW_ID } from "~/shared/didit";

export default defineEventHandler(async (event) => {
  const caller = await requireUser(event);

  const config = useRuntimeConfig();
  const apiKey = config.diditApiKey as string;
  if (!apiKey) {
    throw createError({ statusCode: 500, message: "Identity verification is not configured" });
  }

  const db = getAdminFirestore();
  const userRef = db.collection("users").doc(caller.uid);
  const snap = await userRef.get();
  const profile = (snap.data() ?? {}) as Record<string, any>;

  // Already through — don't burn a verification (and a fee) re-running it.
  if (profile.kycStatus === "verified") {
    return { alreadyVerified: true, url: null, sessionId: profile.kycSessionId ?? null };
  }

  const siteUrl =
    (config.public.siteUrl as string) || getRequestURL(event).origin;

  const res = await fetch(`${DIDIT_BASE}/v3/session/`, {
    method: "POST",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      workflow_id: DIDIT_KYC_WORKFLOW_ID,
      // Our Firebase uid. The webhook reads this back to find the profile.
      vendor_data: caller.uid,
      callback: `${siteUrl}/seller/verify?kyc=done`,
      // Echoed on every webhook for this session — useful when reading
      // deliveries in the console months later.
      metadata: { app: "tcgo", email: caller.email ?? null },
    }),
  });

  if (!res.ok) {
    // 403 means the key is missing, wrong, or revoked.
    const detail = await res.text().catch(() => "");
    console.error("[didit] session create failed", res.status, detail.slice(0, 300));
    throw createError({
      statusCode: 502,
      message: "Couldn't start identity verification. Please try again shortly.",
    });
  }

  const session = (await res.json()) as {
    session_id: string;
    url: string;
    status: string;
  };

  // Record that a session is open BEFORE the user starts, so an abandoned
  // flow is still visible to us rather than looking like they never tried.
  await userRef.set(
    {
      kycStatus: profile.kycStatus === "declined" ? "declined" : "in_progress",
      kycSessionId: session.session_id,
      kycStartedAt: Date.now(),
    },
    { merge: true },
  );

  // Only what the client needs. session_token is for native SDKs and is
  // deliberately not returned to a web caller.
  return { url: session.url, sessionId: session.session_id };
});
