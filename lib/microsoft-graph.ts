import type { GraphMessageDetail, GraphMessageListItem, MicrosoftProfile, MicrosoftTokenSet } from "./types";
import { refreshMicrosoftTokens } from "./microsoft-oauth";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

export async function getMicrosoftProfile(accessToken: string): Promise<MicrosoftProfile> {
  return graphFetch<MicrosoftProfile>(accessToken, "/me?$select=id,displayName,mail,userPrincipalName");
}

export async function listRecentMessages(
  accessToken: string,
  limit = 50,
): Promise<GraphMessageListItem[]> {
  const select = ["id", "subject", "receivedDateTime", "from", "bodyPreview"].join(",");
  const path = `/me/mailFolders/inbox/messages?$top=${limit}&$orderby=receivedDateTime desc&$select=${select}`;
  const data = await graphFetch<{ value?: GraphMessageListItem[] }>(accessToken, path);
  return data.value ?? [];
}

export async function getMessageDetail(
  accessToken: string,
  messageId: string,
): Promise<GraphMessageDetail> {
  const select = ["id", "subject", "receivedDateTime", "from", "bodyPreview", "body", "internetMessageHeaders"].join(",");
  return graphFetch<GraphMessageDetail>(accessToken, `/me/messages/${encodeURIComponent(messageId)}?$select=${select}`);
}

export async function listSharedMailboxMessages(
  accessToken: string,
  mailbox: string,
  limit = 50,
): Promise<GraphMessageListItem[]> {
  const select = ["id", "subject", "receivedDateTime", "from", "bodyPreview"].join(",");
  const path = `/users/${encodeURIComponent(mailbox)}/mailFolders/inbox/messages?$top=${limit}&$orderby=receivedDateTime desc&$select=${select}`;
  const data = await graphFetch<{ value?: GraphMessageListItem[] }>(accessToken, path);
  return data.value ?? [];
}

export async function getSharedMailboxMessageDetail(
  accessToken: string,
  mailbox: string,
  messageId: string,
): Promise<GraphMessageDetail> {
  const select = ["id", "subject", "receivedDateTime", "from", "bodyPreview", "body", "internetMessageHeaders"].join(",");
  return graphFetch<GraphMessageDetail>(accessToken, `/users/${encodeURIComponent(mailbox)}/messages/${encodeURIComponent(messageId)}?$select=${select}`);
}

export async function refreshIfNeeded(tokens: MicrosoftTokenSet): Promise<{
  tokens: MicrosoftTokenSet;
  refreshed: boolean;
}> {
  const expiresAt = new Date(tokens.expires_at).getTime();
  if (Number.isFinite(expiresAt) && expiresAt - Date.now() > 120_000) {
    return { tokens, refreshed: false };
  }
  if (!tokens.refresh_token) {
    throw new Error("Microsoft refresh token is missing");
  }

  const refreshed = await refreshMicrosoftTokens(tokens.refresh_token);
  return {
    tokens: {
      ...tokens,
      ...refreshed,
      refresh_token: refreshed.refresh_token || tokens.refresh_token,
    },
    refreshed: true,
  };
}

async function graphFetch<T>(accessToken: string, path: string): Promise<T> {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      Prefer: 'outlook.body-content-type="html"',
    },
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(`Microsoft Graph request failed (${res.status}): ${text}`);
  }
  return data as T;
}
