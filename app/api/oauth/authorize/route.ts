import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithTokenExchange } from "@/lib/auth-middleware";
import {
  buildAuthorizeUrl,
  createCodeChallenge,
  generatePkceVerifier,
  generateState,
  getMicrosoftConfig,
} from "@/lib/microsoft-oauth";

const COOKIE_MAX_AGE = 10 * 60;

export async function GET(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, "data-api");
  if (auth instanceof NextResponse) return auth;

  const requestUrl = new URL(request.url);
  const config = getMicrosoftConfig();
  const verifier = generatePkceVerifier();
  const state = generateState();
  const loginHint = requestUrl.searchParams.get("mailbox") || process.env.MS_LOGIN_HINT || undefined;
  const requestedPrompt = requestUrl.searchParams.get("prompt");
  const prompt =
    requestedPrompt === "login" ||
    requestedPrompt === "select_account" ||
    requestedPrompt === "consent" ||
    requestedPrompt === "none"
      ? requestedPrompt
      : loginHint
        ? "login"
        : undefined;
  const url = buildAuthorizeUrl({
    clientId: config.clientId,
    redirectUri: config.redirectUri,
    codeChallenge: createCodeChallenge(verifier),
    state,
    loginHint,
    prompt,
    domainHint: "organizations",
  });

  const response = NextResponse.redirect(url);
  const cookiePath = process.env.NEXT_PUBLIC_BASE_PATH || "/";
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: cookiePath,
    maxAge: COOKIE_MAX_AGE,
  };
  response.cookies.set("newsletter_oauth_verifier", verifier, cookieOptions);
  response.cookies.set("newsletter_oauth_state", state, cookieOptions);
  return response;
}
