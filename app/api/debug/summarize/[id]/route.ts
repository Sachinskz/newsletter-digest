import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithTokenExchange } from "@/lib/auth-middleware";
import { ensureDataDocuments, getEmailById } from "@/lib/data-api-client";
import { requestNewsletterSummary, buildFallbackSummary } from "@/lib/summarization";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
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

  const startMs = Date.now();
  let summary;
  let usedFallback = false;
  let errorMessage: string | null = null;

  try {
    summary = await requestNewsletterSummary(auth.apiToken, newsletter, "bullet_points");
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);
    summary = buildFallbackSummary(newsletter, "bullet_points");
    usedFallback = true;
  }

  const durationMs = Date.now() - startMs;

  return NextResponse.json({
    emailId: newsletter.id,
    subject: newsletter.subject,
    durationMs,
    usedFallback,
    error: errorMessage,
    summary,
  });
}
