import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithTokenExchange } from "@/lib/auth-middleware";
import { GENERATED_CONTENT_SCHEMA, buildContentPrompt, isContentKind, isContentTone, parseGeneratedContentOutput } from "@/lib/content-generation";
import { createGeneratedContent, ensureDataDocuments } from "@/lib/data-api-client";
import type { ClientProfile, LibraryArticle } from "@/lib/editorial-intelligence";

const AGENT_API_URL = process.env.AGENT_API_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, "agent-api");
  if (auth instanceof NextResponse) return auth;

  const dataAuth = await requireAuthWithTokenExchange(request, "data-api");
  if (dataAuth instanceof NextResponse) return dataAuth;

  const body = await request.json().catch(() => null);
  const article = body?.article;
  const client = body?.client || null;
  const kind = body?.kind;
  const tone = body?.tone || "Analytical";

  if (!isLibraryArticle(article)) {
    return NextResponse.json({ error: "Invalid article payload" }, { status: 400 });
  }
  if (!isContentKind(kind)) {
    return NextResponse.json({ error: "Invalid content type" }, { status: 400 });
  }
  if (!isContentTone(tone)) {
    return NextResponse.json({ error: "Invalid content tone" }, { status: 400 });
  }
  if (kind === "email" && !isClientProfile(client)) {
    return NextResponse.json({ error: "Client email generation requires a client" }, { status: 400 });
  }

  const res = await fetch(`${AGENT_API_URL}/runs/invoke`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth.apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      agent_name: process.env.NEWSLETTER_CONTENT_AGENT_NAME || "record-extractor",
      input: { prompt: buildContentPrompt({ article, kind, tone, client }) },
      response_schema: GENERATED_CONTENT_SCHEMA,
      agent_tier: process.env.NEWSLETTER_CONTENT_AGENT_TIER || "simple",
    }),
  });

  const result = await res.json();
  if (!res.ok || result.error) {
    return NextResponse.json(
      { error: "Failed to generate content", details: result.error || result },
      { status: 502 },
    );
  }

  const output = parseGeneratedContentOutput(result.output);
  const ids = await ensureDataDocuments(dataAuth.apiToken);
  const content = await createGeneratedContent(dataAuth.apiToken, ids.generatedContent, {
    articleId: article.id,
    articleTitle: article.title,
    articleSource: article.source,
    kind,
    tone,
    ...(client ? { clientName: client.name, clientSector: client.sector } : {}),
    output,
  });

  return NextResponse.json({ content });
}

function isLibraryArticle(value: unknown): value is LibraryArticle {
  if (!value || typeof value !== "object") return false;
  const article = value as Partial<LibraryArticle>;
  return (
    typeof article.id === "string" &&
    typeof article.title === "string" &&
    typeof article.source === "string" &&
    typeof article.category === "string" &&
    typeof article.summary === "string" &&
    typeof article.why === "string" &&
    typeof article.importance === "number" &&
    typeof article.novelty === "number" &&
    typeof article.urgency === "number" &&
    Array.isArray(article.companies) &&
    Array.isArray(article.topics)
  );
}

function isClientProfile(value: unknown): value is ClientProfile {
  if (!value || typeof value !== "object") return false;
  const client = value as Partial<ClientProfile>;
  return (
    typeof client.id === "string" &&
    typeof client.name === "string" &&
    typeof client.sector === "string" &&
    typeof client.priorities === "string" &&
    Array.isArray(client.topics)
  );
}
