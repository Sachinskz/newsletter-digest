import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithTokenExchange } from "@/lib/auth-middleware";
import { ensureDataDocuments, listEmails } from "@/lib/data-api-client";

export async function GET(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, "data-api");
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const ids = await ensureDataDocuments(auth.apiToken);
  const newsletters = await listEmails(auth.apiToken, ids.emails, {
    summaryStatus: searchParams.get("summaryStatus"),
    senderEmail: searchParams.get("senderEmail"),
    from: searchParams.get("from"),
    to: searchParams.get("to"),
  });

  return NextResponse.json({ newsletters });
}
