import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithTokenExchange } from "@/lib/auth-middleware";
import { buildClientMatches } from "@/lib/client-relevance";
import {
  ensureDataDocuments,
  listClientMatches,
  listClientProfiles,
  listEmails,
  listSummaries,
  replaceClientMatchesForClient,
} from "@/lib/data-api-client";

export async function GET(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, "data-api");
  if (auth instanceof NextResponse) return auth;

  const ids = await ensureDataDocuments(auth.apiToken);
  const [clients, newsletters, summaries] = await Promise.all([
    listClientProfiles(auth.apiToken, ids.clients),
    listEmails(auth.apiToken, ids.emails),
    listSummaries(auth.apiToken, ids.summaries),
  ]);

  const { articleCount, matches: computedMatches } = buildClientMatches(newsletters, summaries, clients);

  await Promise.all(
    clients.map((client) =>
      replaceClientMatchesForClient(
        auth.apiToken,
        ids.clientMatches,
        client.id,
        computedMatches.filter((match) => match.clientId === client.id),
      ),
    ),
  );

  const matches = await listClientMatches(auth.apiToken, ids.clientMatches);

  return NextResponse.json({
    clients,
    matches,
    articleCount,
    lastRefreshedAt: computedMatches[0]?.matchedAt || null,
  });
}
