import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithTokenExchange } from "@/lib/auth-middleware";
import { isContentKind, isContentTone, requestContentGeneration } from "@/lib/content-generation";
import { createGeneratedContent, ensureDataDocuments } from "@/lib/data-api-client";
import type { ClientProfile, LibraryArticle } from "@/lib/editorial-intelligence";

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

  try {
    const output = await requestContentGeneration(auth.apiToken, { article, kind, tone, client });
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
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to generate content",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 502 },
    );
  }
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
