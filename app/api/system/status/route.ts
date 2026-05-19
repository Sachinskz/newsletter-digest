import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithTokenExchange } from "@/lib/auth-middleware";
import { ensureDataDocuments, listEmails, listSubscriptions } from "@/lib/data-api-client";
import { isSharedMailboxConfigured } from "@/lib/microsoft-oauth";

export async function GET(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, "data-api");
  if (auth instanceof NextResponse) return auth;

  const configured = isSharedMailboxConfigured();
  const mailbox = process.env.MS_SHARED_MAILBOX || null;

  if (!configured) {
    return NextResponse.json({
      configured: false,
      mailbox: null,
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
    articleCount: emails.length,
    subscriptionCount: subscriptions.length,
    lastSyncAt,
  });
}
