import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithTokenExchange } from "@/lib/auth-middleware";
import { ensureDataDocuments, upsertConnection, DEFAULT_CONNECTION_ID } from "@/lib/data-api-client";
import { exchangeCodeForTokens } from "@/lib/microsoft-oauth";
import { getMicrosoftProfile } from "@/lib/microsoft-graph";
import { encryptForUser, tokenFileIdForConnection } from "@/lib/keystore";

function appUrl(path: string, request: NextRequest): URL {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const fwdHost = request.headers.get("x-forwarded-host");
  const fwdProto = request.headers.get("x-forwarded-proto") || "https";
  const base = fwdHost ? `${fwdProto}://${fwdHost}` : request.url;
  return new URL(`${basePath}${path}`, base);
}

export async function GET(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, "data-api");
  if (auth instanceof NextResponse) return auth;
  if (!auth.ssoToken) {
    return NextResponse.json({ error: "Missing Busibox session token" }, { status: 401 });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  if (error) {
    return NextResponse.redirect(appUrl(`/settings?oauth=error&reason=${encodeURIComponent(error)}`, request));
  }

  const expectedState = request.cookies.get("newsletter_oauth_state")?.value;
  const verifier = request.cookies.get("newsletter_oauth_verifier")?.value;
  if (!code || !state || !expectedState || !verifier || state !== expectedState) {
    return NextResponse.json({ error: "Invalid OAuth callback state" }, { status: 400 });
  }

  const tokens = await exchangeCodeForTokens({ code, codeVerifier: verifier });
  const profile = await getMicrosoftProfile(tokens.access_token);
  const accountEmail = profile.mail || profile.userPrincipalName;
  if (!accountEmail) {
    return NextResponse.json({ error: "Microsoft account email was not returned" }, { status: 502 });
  }

  const documentIds = await ensureDataDocuments(auth.apiToken);
  const tokenFileId = tokenFileIdForConnection(DEFAULT_CONNECTION_ID);
  const encryptedTokens = await encryptForUser({
    plaintext: JSON.stringify(tokens),
    fileId: tokenFileId,
    sessionJwt: auth.ssoToken,
    userId: auth.userId,
  });

  await upsertConnection(auth.apiToken, documentIds.connections, {
    accountEmail,
    accountName: profile.displayName,
    tokenFileId,
    encryptedTokens,
    accessTokenExpiresAt: tokens.expires_at,
    status: "active",
  });

  const response = NextResponse.redirect(appUrl("/settings?connected=1", request));
  const cookiePath = process.env.NEXT_PUBLIC_BASE_PATH || "/";
  response.cookies.set("newsletter_oauth_verifier", "", { path: cookiePath, maxAge: 0 });
  response.cookies.set("newsletter_oauth_state", "", { path: cookiePath, maxAge: 0 });
  return response;
}
