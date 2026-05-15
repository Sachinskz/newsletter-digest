import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithTokenExchange } from "@/lib/auth-middleware";
import {
  createSummary,
  deleteSummaryForEmail,
  ensureDataDocuments,
  getEmailById,
  getPreferences,
  getSummaryForEmail,
  markEmailSummarized,
} from "@/lib/data-api-client";
import { buildFallbackSummary, DEFAULT_SUMMARY_FORMAT, requestNewsletterSummary } from "@/lib/summarization";

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

  const force = request.nextUrl.searchParams.get("force") === "true";
  const existing = await getSummaryForEmail(dataAuth.apiToken, ids.summaries, newsletter.id);
  if (existing && !force) {
    return NextResponse.json({ summary: existing, reused: true });
  }
  if (existing && force) {
    await deleteSummaryForEmail(dataAuth.apiToken, ids.summaries, newsletter.id);
  }

  const preferences = await getPreferences(dataAuth.apiToken, ids.preferences);
  const summaryFormat = preferences?.summaryFormat || DEFAULT_SUMMARY_FORMAT;

  try {
    const output = await requestNewsletterSummary(auth.apiToken, newsletter, summaryFormat).catch((error) => {
      console.error("[newsletters/summarize] All summarization paths failed, using fallback:", {
        emailId: newsletter.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return buildFallbackSummary(newsletter, summaryFormat);
    });
    const summary = await createSummary(dataAuth.apiToken, ids.summaries, newsletter.id, output, summaryFormat);
    await markEmailSummarized(dataAuth.apiToken, ids.emails, newsletter.id, summary.id);
    return NextResponse.json({ summary });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to summarize newsletter",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 502 },
    );
  }
}
