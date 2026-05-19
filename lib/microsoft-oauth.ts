import { createHash, randomBytes } from "crypto";
import type { MicrosoftTokenSet } from "./types";

function getMicrosoftTenantId(): string {
  return process.env.MS_TENANT_ID || "organizations";
}

function getAuthorizeUrl(): string {
  return `https://login.microsoftonline.com/${getMicrosoftTenantId()}/oauth2/v2.0/authorize`;
}

function getTokenUrl(): string {
  return `https://login.microsoftonline.com/${getMicrosoftTenantId()}/oauth2/v2.0/token`;
}

export const MICROSOFT_SCOPES = ["offline_access", "User.Read", "Mail.Read"];
export const APP_ONLY_SCOPE = "https://graph.microsoft.com/.default";

export function getMicrosoftConfig() {
  const clientId = process.env.MS_CLIENT_ID;
  const clientSecret = process.env.MS_CLIENT_SECRET;
  const redirectUri = process.env.MS_REDIRECT_URI;

  if (!clientId) {
    throw new Error("MS_CLIENT_ID is not configured");
  }
  if (!clientSecret) {
    throw new Error("MS_CLIENT_SECRET is not configured");
  }
  if (!redirectUri) {
    throw new Error("MS_REDIRECT_URI is not configured");
  }

  return { clientId, clientSecret, redirectUri };
}

export function generatePkceVerifier(): string {
  return base64Url(randomBytes(48));
}

export function generateState(): string {
  return base64Url(randomBytes(32));
}

export function createCodeChallenge(verifier: string): string {
  return base64Url(createHash("sha256").update(verifier).digest());
}

export function buildAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state: string;
  loginHint?: string;
  prompt?: "login" | "select_account" | "consent" | "none";
  domainHint?: "organizations" | "consumers";
}): string {
  const url = new URL(getAuthorizeUrl());
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", MICROSOFT_SCOPES.join(" "));
  url.searchParams.set("state", params.state);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  if (params.loginHint) {
    url.searchParams.set("login_hint", params.loginHint);
  }
  if (params.prompt) {
    url.searchParams.set("prompt", params.prompt);
  }
  if (params.domainHint) {
    url.searchParams.set("domain_hint", params.domainHint);
  }
  return url.toString();
}

export async function exchangeCodeForTokens(input: {
  code: string;
  codeVerifier: string;
}): Promise<MicrosoftTokenSet> {
  const config = getMicrosoftConfig();
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: config.redirectUri,
    code_verifier: input.codeVerifier,
    scope: MICROSOFT_SCOPES.join(" "),
  });
  return tokenRequest(body);
}

export function getSharedMailboxConfig() {
  const clientId = process.env.MS_CLIENT_ID;
  const clientSecret = process.env.MS_CLIENT_SECRET;
  const tenantId = process.env.MS_TENANT_ID;
  const sharedMailbox = process.env.MS_SHARED_MAILBOX;

  if (!clientId) throw new Error("MS_CLIENT_ID is not configured");
  if (!clientSecret) throw new Error("MS_CLIENT_SECRET is not configured");
  if (!tenantId) throw new Error("MS_TENANT_ID is not configured for shared mailbox");
  if (!sharedMailbox) throw new Error("MS_SHARED_MAILBOX is not configured");

  return { clientId, clientSecret, tenantId, sharedMailbox };
}

export function isSharedMailboxConfigured(): boolean {
  return !!(
    process.env.MS_CLIENT_ID &&
    process.env.MS_CLIENT_SECRET &&
    process.env.MS_TENANT_ID &&
    process.env.MS_SHARED_MAILBOX
  );
}

export async function acquireAppOnlyToken(): Promise<string> {
  const config = getSharedMailboxConfig();
  const tokenUrl = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "client_credentials",
    scope: APP_ONLY_SCOPE,
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Client credentials token request failed (${res.status}): ${JSON.stringify(data)}`);
  }

  return data.access_token;
}

export async function refreshMicrosoftTokens(refreshToken: string): Promise<MicrosoftTokenSet> {
  const config = getMicrosoftConfig();
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: MICROSOFT_SCOPES.join(" "),
  });
  return tokenRequest(body);
}

async function tokenRequest(body: URLSearchParams): Promise<MicrosoftTokenSet> {
  const res = await fetch(getTokenUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Microsoft token request failed (${res.status}): ${JSON.stringify(data)}`);
  }

  return {
    ...data,
    expires_at: new Date(Date.now() + Number(data.expires_in ?? 3600) * 1000).toISOString(),
  };
}

function base64Url(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
