import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithTokenExchange } from "@/lib/auth-middleware";
import { ensureDataDocuments, getPreferences, upsertPreferences } from "@/lib/data-api-client";
import { DEFAULT_SUMMARY_FORMAT, isSummaryFormat } from "@/lib/summarization";

export async function GET(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, "data-api");
  if (auth instanceof NextResponse) return auth;

  const ids = await ensureDataDocuments(auth.apiToken);
  const preferences = await getPreferences(auth.apiToken, ids.preferences);

  return NextResponse.json({
    preferences,
    hasPreferences: Boolean(preferences),
    summaryFormat: preferences?.summaryFormat || DEFAULT_SUMMARY_FORMAT,
  });
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, "data-api");
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  const summaryFormat = body?.summaryFormat;
  if (!isSummaryFormat(summaryFormat)) {
    return NextResponse.json({ error: "Invalid summary format" }, { status: 400 });
  }

  const ids = await ensureDataDocuments(auth.apiToken);
  const preferences = await upsertPreferences(auth.apiToken, ids.preferences, summaryFormat);
  return NextResponse.json({ preferences, hasPreferences: true, summaryFormat: preferences.summaryFormat });
}
