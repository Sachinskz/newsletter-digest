import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithTokenExchange } from "@/lib/auth-middleware";
import { ensureDataDocuments, listSummaries } from "@/lib/data-api-client";

export async function GET(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, "data-api");
  if (auth instanceof NextResponse) return auth;

  const ids = await ensureDataDocuments(auth.apiToken);
  const summaries = await listSummaries(auth.apiToken, ids.summaries);
  return NextResponse.json({ summaries });
}
