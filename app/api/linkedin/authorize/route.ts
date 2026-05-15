import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithTokenExchange } from "@/lib/auth-middleware";
import { buildLinkedInAuthorizeUrl, generateLinkedInState, getLinkedInConfig } from "@/lib/linkedin-oauth";

const COOKIE_MAX_AGE = 10 * 60;

function appUrl(path: string, request: NextRequest): URL {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  return new URL(`${basePath}${path}`, request.url);
}

export async function GET(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, "data-api");
  if (auth instanceof NextResponse) return auth;

  try {
    const config = getLinkedInConfig();
    const state = generateLinkedInState();
    const requestUrl = new URL(request.url);
    const prompt = requestUrl.searchParams.get("prompt") === "login" ? "login" : undefined;
    const url = buildLinkedInAuthorizeUrl({
      clientId: config.clientId,
      redirectUri: config.redirectUri,
      state,
      prompt,
    });

    const response = NextResponse.redirect(url);
    const cookiePath = process.env.NEXT_PUBLIC_BASE_PATH || "/";
    response.cookies.set("linkedin_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: cookiePath,
      maxAge: COOKIE_MAX_AGE,
    });
    return response;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "LinkedIn OAuth is not configured";
    return NextResponse.redirect(appUrl(`/settings?linkedin=config-error&reason=${encodeURIComponent(reason)}`, request));
  }
}
