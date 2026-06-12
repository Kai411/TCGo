// One-time admin connection to EasyParcel (authorization-code OAuth).
// Open this URL in a browser, log into the EasyParcel account, and the
// callback stores the tokens. Re-run anytime to reconnect.
//
// PKCE (S256) + state are included; the verifier/state round-trip via
// short-lived httpOnly cookies.

import crypto from "node:crypto";
import { EP_BASE, epClientCreds } from "~/server/utils/easyparcel";

export default defineEventHandler(async (event) => {
  const { clientId } = epClientCreds();
  const config = useRuntimeConfig();
  const requestUrl = getRequestURL(event);
  const siteUrl = (config.public.siteUrl as string) || requestUrl.origin;
  const redirectUri = `${siteUrl}/api/easyparcel/callback`;

  const state = crypto.randomBytes(16).toString("hex");
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");

  setCookie(event, "ep_oauth_state", state, { httpOnly: true, maxAge: 600, path: "/" });
  setCookie(event, "ep_oauth_verifier", verifier, { httpOnly: true, maxAge: 600, path: "/" });

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return sendRedirect(event, `${EP_BASE}/oauth/login?${params.toString()}`);
});
