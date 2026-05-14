import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithTokenExchange } from "@/lib/auth-middleware";
import {
  deleteClientProfile,
  deleteClientMatchesForClient,
  ensureDataDocuments,
  getClientProfileById,
  updateClientProfile,
} from "@/lib/data-api-client";

function normalizeTopics(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
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
  if (value === undefined) return undefined;
  if (value === null || value === "") return undefined;
  const num = Number(value);
  if (!Number.isFinite(num)) return undefined;
  return Math.max(0, Math.min(100, Math.round(num)));
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuthWithTokenExchange(request, "data-api");
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const updates: Record<string, unknown> = {};

  if (typeof body?.name === "string") updates.name = body.name.trim();
  if (typeof body?.sector === "string") updates.sector = body.sector.trim();
  if (typeof body?.priorities === "string") updates.priorities = body.priorities.trim();
  if (typeof body?.accountOwner === "string") updates.accountOwner = body.accountOwner.trim() || undefined;
  if (typeof body?.relationshipStage === "string") {
    updates.relationshipStage = body.relationshipStage.trim() || undefined;
  }
  if (typeof body?.notes === "string") updates.notes = body.notes.trim() || undefined;

  const topics = normalizeTopics(body?.topics);
  if (topics !== undefined) updates.topics = topics;

  const matchThreshold = parseThreshold(body?.matchThreshold);
  if (body && "matchThreshold" in body) updates.matchThreshold = matchThreshold;

  if ("name" in updates && !updates.name) {
    return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
  }
  if ("sector" in updates && !updates.sector) {
    return NextResponse.json({ error: "sector cannot be empty" }, { status: 400 });
  }
  if ("priorities" in updates && !updates.priorities) {
    return NextResponse.json({ error: "priorities cannot be empty" }, { status: 400 });
  }
  if ("topics" in updates && Array.isArray(updates.topics) && updates.topics.length === 0) {
    return NextResponse.json({ error: "topics cannot be empty" }, { status: 400 });
  }

  const ids = await ensureDataDocuments(auth.apiToken);
  const client = await updateClientProfile(auth.apiToken, ids.clients, id, updates);
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  return NextResponse.json({ client });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuthWithTokenExchange(request, "data-api");
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  const ids = await ensureDataDocuments(auth.apiToken);
  const existing = await getClientProfileById(auth.apiToken, ids.clients, id);
  if (!existing) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  await deleteClientProfile(auth.apiToken, ids.clients, id);
  await deleteClientMatchesForClient(auth.apiToken, ids.clientMatches, id);
  return NextResponse.json({ success: true });
}
