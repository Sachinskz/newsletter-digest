import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithTokenExchange } from "@/lib/auth-middleware";
import { createClientProfile, ensureDataDocuments, listClientProfiles } from "@/lib/data-api-client";

function normalizeTopics(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function parseThreshold(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const num = Number(value);
  if (!Number.isFinite(num)) return undefined;
  return Math.max(0, Math.min(100, Math.round(num)));
}

export async function GET(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, "data-api");
  if (auth instanceof NextResponse) return auth;

  const ids = await ensureDataDocuments(auth.apiToken);
  const clients = await listClientProfiles(auth.apiToken, ids.clients);
  return NextResponse.json({ clients });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, "data-api");
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const sector = typeof body?.sector === "string" ? body.sector.trim() : "";
  const priorities = typeof body?.priorities === "string" ? body.priorities.trim() : "";
  const topics = normalizeTopics(body?.topics);

  if (!name || !sector || !priorities || topics.length === 0) {
    return NextResponse.json(
      { error: "name, sector, priorities, and at least one topic are required" },
      { status: 400 },
    );
  }

  const ids = await ensureDataDocuments(auth.apiToken);
  const client = await createClientProfile(auth.apiToken, ids.clients, {
    name,
    sector,
    topics,
    priorities,
    accountOwner: typeof body?.accountOwner === "string" ? body.accountOwner.trim() || undefined : undefined,
    relationshipStage:
      typeof body?.relationshipStage === "string" ? body.relationshipStage.trim() || undefined : undefined,
    notes: typeof body?.notes === "string" ? body.notes.trim() || undefined : undefined,
    matchThreshold: parseThreshold(body?.matchThreshold),
  });

  return NextResponse.json({ client }, { status: 201 });
}
