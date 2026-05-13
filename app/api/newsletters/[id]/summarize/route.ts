import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithTokenExchange } from "@/lib/auth-middleware";
import {
  createSummary,
  ensureDataDocuments,
  getEmailById,
  getPreferences,
  getSummaryForEmail,
  markEmailSummarized,
} from "@/lib/data-api-client";
import { buildSummaryPrompt, DEFAULT_SUMMARY_FORMAT, parseSummaryOutput, SUMMARY_SCHEMA } from "@/lib/summarization";

const AGENT_API_URL = process.env.AGENT_API_URL || "http://localhost:8000";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuthWithTokenExchange(request, "agent-api");
  if (auth instanceof NextResponse) return auth;

  const dataAuth = await requireAuthWithTokenExchange(request, "data-api");
  if (dataAuth instanceof NextResponse) return dataAuth;

  const { id } = await params;
  const ids = await ensureDataDocuments(dataAuth.apiToken);
  const newsletter = await getEmailById(dataAuth.apiToken, ids.emails, id);
  if (!newsletter) {
    return NextResponse.json({ error: "Newsletter not found" }, { status: 404 });
  }

  const existing = await getSummaryForEmail(dataAuth.apiToken, ids.summaries, newsletter.id);
  if (existing) {
    return NextResponse.json({ summary: existing, reused: true });
  }

  const preferences = await getPreferences(dataAuth.apiToken, ids.preferences);
  const summaryFormat = preferences?.summaryFormat || DEFAULT_SUMMARY_FORMAT;

  const res = await fetch(`${AGENT_API_URL}/runs/invoke`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth.apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      agent_name: process.env.NEWSLETTER_SUMMARY_AGENT_NAME || "record-extractor",
      input: { prompt: buildSummaryPrompt(newsletter, summaryFormat) },
      response_schema: SUMMARY_SCHEMA,
      agent_tier: process.env.NEWSLETTER_SUMMARY_AGENT_TIER || "simple",
    }),
  });

  const result = await res.json();
  if (!res.ok || result.error) {
    return NextResponse.json(
      { error: "Failed to summarize newsletter", details: result.error || result },
      { status: 502 },
    );
  }

  const output = parseSummaryOutput(result.output);
  const summary = await createSummary(dataAuth.apiToken, ids.summaries, newsletter.id, output, summaryFormat);
  await markEmailSummarized(dataAuth.apiToken, ids.emails, newsletter.id, summary.id);
  return NextResponse.json({ summary });
}
