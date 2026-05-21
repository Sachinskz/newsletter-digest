import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithTokenExchange } from "@/lib/auth-middleware";
import {
  createSummary,
  ensureDataDocuments,
  getEmailByMessageId,
  listEmails,
  insertEmail,
  markEmailSummarized,
  upsertSubscriptionFromEmail,
} from "@/lib/data-api-client";
import { getSharedMailboxMessageDetail, listSharedMailboxMessages } from "@/lib/microsoft-graph";
import { isNewsletter } from "@/lib/newsletter-detection";
import { normalizeEmailText } from "@/lib/html-to-text";
import { buildFallbackSummary, DEFAULT_SUMMARY_FORMAT, requestNewsletterSummary } from "@/lib/summarization";
import { acquireAppOnlyTokenWithCredentials, isSharedMailboxConfiguredFromEnv, loadSharedMailboxCredentials } from "@/lib/ms-config";
import type { NewsletterEmail, NewsletterSummary } from "@/lib/types";

export async function POST(request: NextRequest) {
  const dataAuth = await requireAuthWithTokenExchange(request, "data-api");
  if (dataAuth instanceof NextResponse) return dataAuth;

  const agentAuth = await requireAuthWithTokenExchange(request, "agent-api");
  if (agentAuth instanceof NextResponse) return agentAuth;

  const envConfigured = isSharedMailboxConfiguredFromEnv();
  console.log("[system/sync] Env configured:", envConfigured, "| ssoToken present:", Boolean(dataAuth.ssoToken));

  let creds = envConfigured
    ? {
        clientId: process.env.MS_CLIENT_ID!,
        clientSecret: process.env.MS_CLIENT_SECRET!,
        tenantId: process.env.MS_TENANT_ID!,
        sharedMailbox: process.env.MS_SHARED_MAILBOX!,
      }
    : null;

  if (!creds && dataAuth.ssoToken) {
    console.log("[system/sync] Falling back to Config API for credentials...");
    creds = await loadSharedMailboxCredentials(dataAuth.userId, dataAuth.ssoToken);
    console.log("[system/sync] Config API result:", creds ? "credentials loaded" : "no credentials found");
  }

  if (!creds) {
    return NextResponse.json(
      { error: "Shared mailbox is not configured. Set MS_TENANT_ID and MS_SHARED_MAILBOX in env or Config API." },
      { status: 503 },
    );
  }

  let appToken: string;
  try {
    appToken = await acquireAppOnlyTokenWithCredentials(creds);
  } catch (error) {
    console.error("[system/sync] Failed to acquire app-only token:", error);
    return NextResponse.json(
      { error: "Failed to authenticate with Microsoft. Check MS_CLIENT_ID, MS_CLIENT_SECRET, and MS_TENANT_ID." },
      { status: 502 },
    );
  }

  const ids = await ensureDataDocuments(dataAuth.apiToken);
  const summaryFormat = DEFAULT_SUMMARY_FORMAT;

  const messages = await listSharedMailboxMessages(appToken, creds.sharedMailbox, 50);

  let scanned = 0;
  let detected = 0;
  let inserted = 0;
  let summarized = 0;
  let summaryFailures = 0;
  let skippedExisting = 0;

  for (const item of messages) {
    scanned += 1;
    const detail = await getSharedMailboxMessageDetail(appToken, creds.sharedMailbox, item.id);
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

    const { output, metadata } = await summarizeWithMetadata(agentAuth.apiToken, email, summaryFormat, () => {
      summaryFailures += 1;
    });
    const summary = await createSummary(dataAuth.apiToken, ids.summaries, email.id, output, summaryFormat, metadata);
    await markEmailSummarized(dataAuth.apiToken, ids.emails, email.id, summary.id);
    summarized += 1;
    inserted += 1;
  }

  const backlog = await listEmails(dataAuth.apiToken, ids.emails, { summaryStatus: "unsummarized" });
  for (const email of backlog) {
    const output = buildFallbackSummary(email, summaryFormat);
    const summary = await createSummary(dataAuth.apiToken, ids.summaries, email.id, output, summaryFormat, {
      generationSource: "fallback",
      generationModel: "deterministic-backfill",
      generationError: "Backfilled during shared mailbox sync.",
    });
    await markEmailSummarized(dataAuth.apiToken, ids.emails, email.id, summary.id);
    summarized += 1;
  }

  return NextResponse.json({
    source: "shared-mailbox",
    mailbox: creds.sharedMailbox,
    scanned,
    detected,
    inserted,
    summarized,
    summaryFailures,
    skippedExisting,
  });
}

async function summarizeWithMetadata(
  agentToken: string,
  email: NewsletterEmail,
  summaryFormat: Parameters<typeof requestNewsletterSummary>[2],
  onFallback: (error: unknown) => void,
) {
  try {
    const output = await requestNewsletterSummary(agentToken, email, summaryFormat);
    return {
      output,
      metadata: {
        generationSource: "llm",
        generationModel: process.env.NEWSLETTER_SUMMARY_AGENT_NAME || "newsletter-analyst",
      } satisfies Pick<NewsletterSummary, "generationSource" | "generationModel" | "generationError">,
    };
  } catch (error) {
    onFallback(error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[system/sync] Auto-summary failed, using fallback:", {
      emailId: email.id,
      subject: email.subject,
      error: errorMessage,
    });
    return {
      output: buildFallbackSummary(email, summaryFormat),
      metadata: {
        generationSource: "fallback",
        generationModel: "deterministic-fallback",
        generationError: errorMessage,
      } satisfies Pick<NewsletterSummary, "generationSource" | "generationModel" | "generationError">,
    };
  }
}
