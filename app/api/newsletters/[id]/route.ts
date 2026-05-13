import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithTokenExchange } from "@/lib/auth-middleware";
import { ensureDataDocuments, getEmailById, getSummaryForEmail } from "@/lib/data-api-client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuthWithTokenExchange(request, "data-api");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const ids = await ensureDataDocuments(auth.apiToken);
  const newsletter = await getEmailById(auth.apiToken, ids.emails, id);
  if (!newsletter) {
    return NextResponse.json({ error: "Newsletter not found" }, { status: 404 });
  }

  const summary = await getSummaryForEmail(auth.apiToken, ids.summaries, newsletter.id);
  return NextResponse.json({ newsletter, summary });
}
