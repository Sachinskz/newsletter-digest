import { randomBytes } from "crypto";
import type { LinkedInTokenSet } from "./types";

const LINKEDIN_AUTHORIZE_URL = "https://www.linkedin.com/oauth/v2/authorization";
const LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
export const LINKEDIN_SCOPES = ["openid", "profile", "email", "w_member_social"];

export function getLinkedInConfig() {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI;

  if (!clientId) {
    throw new Error("LINKEDIN_CLIENT_ID is not configured");
  }
  if (!clientSecret) {
    throw new Error("LINKEDIN_CLIENT_SECRET is not configured");
  }
  if (!redirectUri) {
    throw new Error("LINKEDIN_REDIRECT_URI is not configured");
  }

  return { clientId, clientSecret, redirectUri };
}

export function generateLinkedInState(): string {
  return base64Url(randomBytes(32));
}

export function buildLinkedInAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  prompt?: "login" | "consent";
}) {
  const url = new URL(LINKEDIN_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("state", params.state);
  url.searchParams.set("scope", LINKEDIN_SCOPES.join(" "));
  if (params.prompt) {
    url.searchParams.set("prompt", params.prompt);
  }
  return url.toString();
}

export async function exchangeLinkedInCodeForTokens(input: { code: string }): Promise<LinkedInTokenSet> {
  const config = getLinkedInConfig();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });
  return linkedInTokenRequest(body);
}

async function linkedInTokenRequest(body: URLSearchParams): Promise<LinkedInTokenSet> {
  const res = await fetch(LINKEDIN_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`LinkedIn token request failed (${res.status}): ${JSON.stringify(data)}`);
  }

  return {
    ...data,
    expires_at: new Date(Date.now() + Number(data?.expires_in ?? 3600) * 1000).toISOString(),
  };
}

function base64Url(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
