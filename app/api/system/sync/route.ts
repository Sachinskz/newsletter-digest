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
import { acquireAppOnlyTokenWithCredentials, isSharedMailboxConfiguredFromEnv, loadSharedMailboxCredentialsWithDiagnostics } from "@/lib/ms-config";
import type { NewsletterEmail, NewsletterSummary } from "@/lib/types";

const MESSAGE_LIST_LIMIT = readPositiveInt("NEWSLETTER_SYNC_FETCH_LIMIT", 15);
const MAX_DETAIL_CHECKS_PER_SYNC = readPositiveInt("NEWSLETTER_SYNC_MAX_DETAIL_CHECKS", 8);
const MAX_NEW_NEWSLETTERS_PER_SYNC = readPositiveInt("NEWSLETTER_SYNC_MAX_NEW", 1);
const MAX_BACKFILLS_PER_SYNC = readPositiveInt("NEWSLETTER_SYNC_MAX_BACKFILL", 1);
const GRAPH_TIMEOUT_MS = readPositiveInt("NEWSLETTER_SYNC_GRAPH_TIMEOUT_MS", 10_000);
const SUMMARY_TIMEOUT_MS = readPositiveInt("NEWSLETTER_SYNC_SUMMARY_TIMEOUT_MS", 12_000);

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

  let configError: string | null = null;
  let configApiUrl: string | null = null;
  let missingKeys: string[] = [];

  if (!creds && dataAuth.ssoToken) {
    console.log("[system/sync] Falling back to Config API for credentials...");
    const configResult = await loadSharedMailboxCredentialsWithDiagnostics(dataAuth.userId, dataAuth.ssoToken);
    creds = configResult.credentials;
    configError = configResult.error;
    configApiUrl = configResult.configApiUrl;
    missingKeys = configResult.missingKeys;
    console.log("[system/sync] Config API result:", creds ? "credentials loaded" : "no credentials found");
  }

  if (!creds) {
    if (configError) {
      return NextResponse.json(
        {
          error: "Shared mailbox config could not be loaded from Config API.",
          details: configError,
          configApiUrl,
          missingKeys,
        },
        { status: 502 },
      );
    }

    return NextResponse.json(
      {
        error: "Shared mailbox is not configured. Save all Microsoft shared mailbox credentials in Settings or supply them via env.",
        configApiUrl,
        missingKeys,
      },
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

  let messages: Awaited<ReturnType<typeof listSharedMailboxMessages>>;
  try {
    messages = await withTimeout(
      listSharedMailboxMessages(appToken, creds.sharedMailbox, MESSAGE_LIST_LIMIT),
      GRAPH_TIMEOUT_MS,
      `Graph inbox list exceeded ${GRAPH_TIMEOUT_MS}ms`,
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[system/sync] Graph API error:", msg);
    const is403 = msg.includes("403");
    return NextResponse.json(
      {
        error: is403
          ? "Access denied reading shared mailbox. The Azure app needs Mail.Read Application permission with admin consent."
          : `Microsoft Graph error: ${msg}`,
      },
      { status: 502 },
    );
  }

  let scanned = 0;
  let detected = 0;
  let inserted = 0;
  let summarized = 0;
  let summaryFailures = 0;
  let skippedExisting = 0;
  let detailFailures = 0;
  let reachedSyncCap = false;

  for (const item of messages.slice(0, MAX_DETAIL_CHECKS_PER_SYNC)) {
    scanned += 1;
    let detail;
    try {
      detail = await withTimeout(
        getSharedMailboxMessageDetail(appToken, creds.sharedMailbox, item.id),
        GRAPH_TIMEOUT_MS,
        `Graph message detail exceeded ${GRAPH_TIMEOUT_MS}ms`,
      );
    } catch (error) {
      detailFailures += 1;
      console.error("[system/sync] Skipping message detail after failure:", {
        messageId: item.id,
        error: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

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

    if (inserted >= MAX_NEW_NEWSLETTERS_PER_SYNC) {
      reachedSyncCap = true;
      break;
    }
  }

  const backlog = await listEmails(dataAuth.apiToken, ids.emails, { summaryStatus: "unsummarized" });
  for (const email of backlog.slice(0, MAX_BACKFILLS_PER_SYNC)) {
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
    fetchedCandidates: messages.length,
    scanned,
    detected,
    inserted,
    summarized,
    summaryFailures,
    detailFailures,
    skippedExisting,
    reachedSyncCap,
    fetchWindow: MESSAGE_LIST_LIMIT,
    detailChecksPerSync: MAX_DETAIL_CHECKS_PER_SYNC,
    maxNewPerSync: MAX_NEW_NEWSLETTERS_PER_SYNC,
  });
}

async function summarizeWithMetadata(
  agentToken: string,
  email: NewsletterEmail,
  summaryFormat: Parameters<typeof requestNewsletterSummary>[2],
  onFallback: (error: unknown) => void,
) {
  try {
    const output = await withTimeout(
      requestNewsletterSummary(agentToken, email, summaryFormat),
      SUMMARY_TIMEOUT_MS,
      `Summary generation exceeded ${SUMMARY_TIMEOUT_MS}ms`,
    );
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

function readPositiveInt(key: string, fallback: number): number {
  const raw = process.env[key];
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
