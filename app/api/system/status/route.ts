import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithTokenExchange } from "@/lib/auth-middleware";
import { ensureDataDocuments, listEmails, listSubscriptions } from "@/lib/data-api-client";
import { isSharedMailboxConfiguredFromEnv, loadSharedMailboxCredentialsWithDiagnostics } from "@/lib/ms-config";

export async function GET(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, "data-api");
  if (auth instanceof NextResponse) return auth;

  let configured = isSharedMailboxConfiguredFromEnv();
  let mailbox = process.env.MS_SHARED_MAILBOX || null;
  let configIssue: string | null = null;
  let configApiUrl: string | null = null;
  let missingKeys: string[] = [];

  if (!configured && auth.ssoToken) {
    const result = await loadSharedMailboxCredentialsWithDiagnostics(auth.userId, auth.ssoToken);
    configApiUrl = result.configApiUrl;
    missingKeys = result.missingKeys;
    configIssue = result.error;
    if (result.credentials) {
      configured = true;
      mailbox = result.credentials.sharedMailbox;
    }
  }

  if (!configured) {
    return NextResponse.json({
      configured: false,
      mailbox: null,
      configApiUrl,
      configIssue,
      missingKeys,
      articleCount: 0,
      subscriptionCount: 0,
      lastSyncAt: null,
    });
  }

  const ids = await ensureDataDocuments(auth.apiToken);
  const emails = await listEmails(auth.apiToken, ids.emails);
  const subscriptions = await listSubscriptions(auth.apiToken, ids.subscriptions);

  const lastSyncAt = emails.length > 0
    ? emails.reduce((latest, e) => (e.fetchedAt > latest ? e.fetchedAt : latest), emails[0].fetchedAt)
    : null;

  return NextResponse.json({
    configured: true,
    mailbox,
    configApiUrl,
    configIssue,
    missingKeys,
    articleCount: emails.length,
    subscriptionCount: subscriptions.length,
    lastSyncAt,
  });
}
