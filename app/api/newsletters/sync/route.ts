import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithTokenExchange } from "@/lib/auth-middleware";
import {
  ensureDataDocuments,
  getConnection,
  getEmailByMessageId,
  insertEmail,
  updateConnectionStatus,
  upsertConnection,
  upsertSubscriptionFromEmail,
} from "@/lib/data-api-client";
import { decryptForUser, encryptForUser } from "@/lib/keystore";
import { getMessageDetail, listRecentMessages, refreshIfNeeded } from "@/lib/microsoft-graph";
import { isNewsletter } from "@/lib/newsletter-detection";
import { normalizeEmailText } from "@/lib/html-to-text";
import type { MicrosoftTokenSet } from "@/lib/types";

export async function POST(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, "data-api");
  if (auth instanceof NextResponse) return auth;
  if (!auth.ssoToken) {
    return NextResponse.json({ error: "Missing Busibox session token" }, { status: 401 });
  }

  const ids = await ensureDataDocuments(auth.apiToken);
  const connection = await getConnection(auth.apiToken, ids.connections);
  if (!connection || connection.status !== "active") {
    return NextResponse.json({ error: "Microsoft account is not connected" }, { status: 401 });
  }

  let tokens: MicrosoftTokenSet;
  let encryptedTokens = connection.encryptedTokens;
  try {
    tokens = JSON.parse(
      await decryptForUser({
        encryptedContent: connection.encryptedTokens,
        fileId: connection.tokenFileId,
        sessionJwt: auth.ssoToken,
      }),
    );
  } catch (error) {
    await updateConnectionStatus(auth.apiToken, ids.connections, "expired");
    return NextResponse.json({ error: "Could not decrypt Microsoft tokens" }, { status: 401 });
  }

  let refreshed: Awaited<ReturnType<typeof refreshIfNeeded>>;
  try {
    refreshed = await refreshIfNeeded(tokens);
  } catch (error) {
    await updateConnectionStatus(auth.apiToken, ids.connections, "expired");
    return NextResponse.json({ error: "Microsoft token refresh failed. Please reconnect Outlook." }, { status: 401 });
  }

  tokens = refreshed.tokens;
  if (refreshed.refreshed) {
    encryptedTokens = await encryptForUser({
      plaintext: JSON.stringify(tokens),
      fileId: connection.tokenFileId,
      sessionJwt: auth.ssoToken,
      userId: auth.userId,
    });
    await upsertConnection(auth.apiToken, ids.connections, {
      ...connection,
      encryptedTokens,
      accessTokenExpiresAt: tokens.expires_at,
      status: "active",
    });
  }

  const messages = await listRecentMessages(tokens.access_token, 50);
  let scanned = 0;
  let detected = 0;
  let inserted = 0;
  let skippedExisting = 0;

  for (const item of messages) {
    scanned += 1;
    const detail = await getMessageDetail(tokens.access_token, item.id);
    if (!isNewsletter(detail)) continue;
    detected += 1;

    const existing = await getEmailByMessageId(auth.apiToken, ids.emails, detail.id);
    if (existing) {
      skippedExisting += 1;
      continue;
    }

    const senderEmail = detail.from?.emailAddress?.address?.toLowerCase();
    if (!senderEmail) continue;
    const bodyPlainText = normalizeEmailText(detail.body?.content || detail.bodyPreview || "", detail.body?.contentType);
    if (!bodyPlainText) continue;

    const email = await insertEmail(auth.apiToken, ids.emails, {
      messageId: detail.id,
      senderEmail,
      senderName: detail.from?.emailAddress?.name,
      subject: detail.subject || "(no subject)",
      receivedAt: detail.receivedDateTime || new Date().toISOString(),
      bodyPlainText,
      bodyLengthChars: bodyPlainText.length,
    });
    await upsertSubscriptionFromEmail(auth.apiToken, ids.subscriptions, email);
    inserted += 1;
  }

  await upsertConnection(auth.apiToken, ids.connections, {
    ...connection,
    encryptedTokens,
    accessTokenExpiresAt: tokens.expires_at,
    lastSyncAt: new Date().toISOString(),
    status: "active",
  });

  return NextResponse.json({ scanned, detected, inserted, skippedExisting });
}
