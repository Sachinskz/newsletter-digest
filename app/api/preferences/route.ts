import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithTokenExchange } from "@/lib/auth-middleware";
import { ensureDataDocuments, getPreferences, upsertPreferences } from "@/lib/data-api-client";
import { DEFAULT_SUMMARY_FORMAT, isSummaryFormat } from "@/lib/summarization";
import type { RankingPriority } from "@/lib/types";

const ALLOWED_PRIORITIES: RankingPriority[] = [
  "Revenue opportunities",
  "Client relevance",
  "Competitive moves",
  "Risk and regulation",
  "Tools we can deploy quickly",
];

export async function GET(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, "data-api");
  if (auth instanceof NextResponse) return auth;

  const ids = await ensureDataDocuments(auth.apiToken);
  const preferences = await getPreferences(auth.apiToken, ids.preferences);

  return NextResponse.json({
    preferences,
    hasPreferences: Boolean(preferences),
    hasProfile: hasBriefingProfile(preferences),
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

  const interests = normalizeStringList(body?.interests);
  const rankingPriorities = normalizeRankingPriorities(body?.rankingPriorities);
  if (body?.rankingPriorities && !rankingPriorities) {
    return NextResponse.json({ error: "Invalid ranking priorities" }, { status: 400 });
  }

  const ids = await ensureDataDocuments(auth.apiToken);
  const preferences = await upsertPreferences(auth.apiToken, ids.preferences, {
    summaryFormat,
    roleTitle: normalizeOptionalString(body?.roleTitle),
    primaryFocus: normalizeOptionalString(body?.primaryFocus),
    interests,
    wantsToKnow: normalizeOptionalString(body?.wantsToKnow),
    rankingPriorities: rankingPriorities || undefined,
  });
  return NextResponse.json({
    preferences,
    hasPreferences: true,
    hasProfile: hasBriefingProfile(preferences),
    summaryFormat: preferences.summaryFormat,
  });
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : "";
}

function normalizeStringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, 12);
}

function normalizeRankingPriorities(value: unknown): RankingPriority[] | undefined | null {
  if (!Array.isArray(value)) return undefined;
  const normalized = value.filter((item): item is RankingPriority => typeof item === "string" && ALLOWED_PRIORITIES.includes(item as RankingPriority));
  return normalized.length === value.length ? normalized : null;
}

function hasBriefingProfile(preferences: Awaited<ReturnType<typeof getPreferences>>): boolean {
  if (!preferences) return false;
  return Boolean(
    (preferences.roleTitle && preferences.roleTitle.trim()) ||
      (preferences.primaryFocus && preferences.primaryFocus.trim()) ||
      preferences.interests.length ||
      (preferences.wantsToKnow && preferences.wantsToKnow.trim()) ||
      preferences.rankingPriorities.length,
  );
}
