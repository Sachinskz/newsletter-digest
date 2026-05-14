import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithTokenExchange } from "@/lib/auth-middleware";
import {
  createSummary,
  ensureDataDocuments,
  getConnection,
  getEmailByMessageId,
  listEmails,
  getPreferences,
  insertEmail,
  markEmailSummarized,
  updateConnectionStatus,
  upsertConnection,
  upsertSubscriptionFromEmail,
} from "@/lib/data-api-client";
import { decryptForUser, encryptForUser } from "@/lib/keystore";
import { getMessageDetail, listRecentMessages, refreshIfNeeded } from "@/lib/microsoft-graph";
import { isNewsletter } from "@/lib/newsletter-detection";
import { normalizeEmailText } from "@/lib/html-to-text";
import { buildFallbackSummary, DEFAULT_SUMMARY_FORMAT, requestNewsletterSummary } from "@/lib/summarization";
import type { MicrosoftTokenSet } from "@/lib/types";

export async function POST(request: NextRequest) {
  const dataAuth = await requireAuthWithTokenExchange(request, "data-api");
  if (dataAuth instanceof NextResponse) return dataAuth;
  if (!dataAuth.ssoToken) {
    return NextResponse.json({ error: "Missing Busibox session token" }, { status: 401 });
  }
  const agentAuth = await requireAuthWithTokenExchange(request, "agent-api");
  if (agentAuth instanceof NextResponse) return agentAuth;

  const ids = await ensureDataDocuments(dataAuth.apiToken);
  const connection = await getConnection(dataAuth.apiToken, ids.connections);
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
        sessionJwt: dataAuth.ssoToken,
      }),
    );
  } catch (error) {
    await updateConnectionStatus(dataAuth.apiToken, ids.connections, "expired");
    return NextResponse.json({ error: "Could not decrypt Microsoft tokens" }, { status: 401 });
  }

  let refreshed: Awaited<ReturnType<typeof refreshIfNeeded>>;
  try {
    refreshed = await refreshIfNeeded(tokens);
  } catch (error) {
    await updateConnectionStatus(dataAuth.apiToken, ids.connections, "expired");
    return NextResponse.json({ error: "Microsoft token refresh failed. Please reconnect Outlook." }, { status: 401 });
  }

  tokens = refreshed.tokens;
  if (refreshed.refreshed) {
    encryptedTokens = await encryptForUser({
      plaintext: JSON.stringify(tokens),
      fileId: connection.tokenFileId,
      sessionJwt: dataAuth.ssoToken,
      userId: dataAuth.userId,
    });
    await upsertConnection(dataAuth.apiToken, ids.connections, {
      ...connection,
      encryptedTokens,
      accessTokenExpiresAt: tokens.expires_at,
      status: "active",
    });
  }

  const messages = await listRecentMessages(tokens.access_token, 50);
  const preferences = await getPreferences(dataAuth.apiToken, ids.preferences);
  const summaryFormat = preferences?.summaryFormat || DEFAULT_SUMMARY_FORMAT;
  let scanned = 0;
  let detected = 0;
  let inserted = 0;
  let summarized = 0;
  let summaryFailures = 0;
  let skippedExisting = 0;

  for (const item of messages) {
    scanned += 1;
    const detail = await getMessageDetail(tokens.access_token, item.id);
    if (!isNewsletter(detail)) continue;
    detected += 1;

    const existing = await getEmailByMessageId(dataAuth.apiToken, ids.emails, detail.id);
    if (existing) {
      skippedExisting += 1;
      continue;
    }

    const senderEmail = detail.from?.emailAddress?.address?.toLowerCase();
    if (!senderEmail) continue;
    const bodyPlainText = normalizeEmailText(detail.body?.content || detail.bodyPreview || "", detail.body?.contentType);
    if (!bodyPlainText) continue;

    const email = await insertEmail(dataAuth.apiToken, ids.emails, {
      messageId: detail.id,
      senderEmail,
      senderName: detail.from?.emailAddress?.name,
      subject: detail.subject || "(no subject)",
      receivedAt: detail.receivedDateTime || new Date().toISOString(),
      bodyPlainText,
      bodyLengthChars: bodyPlainText.length,
    });
    await upsertSubscriptionFromEmail(dataAuth.apiToken, ids.subscriptions, email);

    const output = await requestNewsletterSummary(agentAuth.apiToken, email, summaryFormat).catch((error) => {
      summaryFailures += 1;
      console.error("[newsletters/sync] Auto-summary failed, using fallback:", {
        emailId: email.id,
        subject: email.subject,
        error: error instanceof Error ? error.message : String(error),
      });
      return buildFallbackSummary(email, summaryFormat);
    });
    const summary = await createSummary(dataAuth.apiToken, ids.summaries, email.id, output, summaryFormat);
    await markEmailSummarized(dataAuth.apiToken, ids.emails, email.id, summary.id);
    summarized += 1;

    inserted += 1;
  }

  const backlog = await listEmails(dataAuth.apiToken, ids.emails, {
    summaryStatus: "unsummarized",
  });

  for (const email of backlog) {
    const output = buildFallbackSummary(email, summaryFormat);
    const summary = await createSummary(dataAuth.apiToken, ids.summaries, email.id, output, summaryFormat);
    await markEmailSummarized(dataAuth.apiToken, ids.emails, email.id, summary.id);
    summarized += 1;
  }

  await upsertConnection(dataAuth.apiToken, ids.connections, {
    ...connection,
    encryptedTokens,
    accessTokenExpiresAt: tokens.expires_at,
    lastSyncAt: new Date().toISOString(),
    status: "active",
  });

  return NextResponse.json({ scanned, detected, inserted, summarized, summaryFailures, skippedExisting });
}
