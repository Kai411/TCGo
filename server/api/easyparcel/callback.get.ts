// OAuth callback — exchanges the authorization code for tokens and stores
// them (Firestore appSettings/easyparcel). Lands the admin back on the
// inventory dashboard.

import { epTokenRequest, epSaveTokens } from "~/server/utils/easyparcel";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const code = String(query.code || "");
  const state = String(query.state || "");

  if (!code) {
    throw createError({ statusCode: 400, message: `EasyParcel callback missing code (${query.error || "no error info"})` });
  }
  const expectedState = getCookie(event, "ep_oauth_state");
  if (!expectedState || state !== expectedState) {
    throw createError({ statusCode: 403, message: "OAuth state mismatch — restart from /api/easyparcel/connect" });
  }
  const verifier = getCookie(event, "ep_oauth_verifier") || "";

  const config = useRuntimeConfig();
  const requestUrl = getRequestURL(event);
  const siteUrl = (config.public.siteUrl as string) || requestUrl.origin;

  const { accessToken, refreshToken } = await epTokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: `${siteUrl}/api/easyparcel/callback`,
    ...(verifier ? { code_verifier: verifier } : {}),
  });
  await epSaveTokens(accessToken, refreshToken);

  deleteCookie(event, "ep_oauth_state");
  deleteCookie(event, "ep_oauth_verifier");
  return sendRedirect(event, "/inventory?easyparcel=connected");
});
