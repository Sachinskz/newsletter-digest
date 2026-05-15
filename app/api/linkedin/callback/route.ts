import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithTokenExchange } from "@/lib/auth-middleware";
import {
  DEFAULT_LINKEDIN_CONNECTION_ID,
  ensureDataDocuments,
  upsertLinkedInConnection,
} from "@/lib/data-api-client";
import { getLinkedInProfile } from "@/lib/linkedin-api";
import { encryptForUser, tokenFileIdForConnection } from "@/lib/keystore";
import { exchangeLinkedInCodeForTokens } from "@/lib/linkedin-oauth";

function appUrl(path: string, request: NextRequest): URL {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  return new URL(`${basePath}${path}`, request.url);
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
    return NextResponse.redirect(appUrl(`/settings?linkedin=error&reason=${encodeURIComponent(error)}`, request));
  }

  const expectedState = request.cookies.get("linkedin_oauth_state")?.value;
  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.json({ error: "Invalid LinkedIn OAuth callback state" }, { status: 400 });
  }

  const tokens = await exchangeLinkedInCodeForTokens({ code });
  const profile = await getLinkedInProfile(tokens.access_token);
  if (!profile.sub) {
    return NextResponse.json({ error: "LinkedIn member id was not returned" }, { status: 502 });
  }

  const ids = await ensureDataDocuments(auth.apiToken);
  const tokenFileId = tokenFileIdForConnection(DEFAULT_LINKEDIN_CONNECTION_ID);
  const encryptedTokens = await encryptForUser({
    plaintext: JSON.stringify(tokens),
    fileId: tokenFileId,
    sessionJwt: auth.ssoToken,
    userId: auth.userId,
  });

  await upsertLinkedInConnection(auth.apiToken, ids.linkedinConnections, {
    memberId: profile.sub,
    memberName: profile.name,
    memberEmail: profile.email,
    tokenFileId,
    encryptedTokens,
    accessTokenExpiresAt: tokens.expires_at,
    status: "active",
  });

  const response = NextResponse.redirect(appUrl("/settings?linkedin=connected", request));
  const cookiePath = process.env.NEXT_PUBLIC_BASE_PATH || "/";
  response.cookies.set("linkedin_oauth_state", "", { path: cookiePath, maxAge: 0 });
  return response;
}
