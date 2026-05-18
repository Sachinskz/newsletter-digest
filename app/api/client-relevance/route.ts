import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithTokenExchange } from "@/lib/auth-middleware";
import { buildClientMatchesWithAgent } from "@/lib/client-relevance-agent";
import { deriveLibraryArticles } from "@/lib/editorial-intelligence";
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

  // Also get agent-api token for the relevance agent
  const agentAuth = await requireAuthWithTokenExchange(request, "agent-api");
  if (agentAuth instanceof NextResponse) return agentAuth;

  const refreshedAt = new Date().toISOString();

  const ids = await ensureDataDocuments(auth.apiToken);
  const [clients, newsletters, summaries] = await Promise.all([
    listClientProfiles(auth.apiToken, ids.clients),
    listEmails(auth.apiToken, ids.emails),
    listSummaries(auth.apiToken, ids.summaries),
  ]);

  // Derive articles once and pass to the agent
  const articles = deriveLibraryArticles(newsletters, summaries);

  // Agent-first scoring with deterministic fallback
  const { articleCount, matches: computedMatches, source } = await buildClientMatchesWithAgent(
    agentAuth.apiToken,
    newsletters,
    summaries,
    clients,
    articles,
    refreshedAt,
  );

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
  const matchedClientIds = new Set(matches.map((match) => match.clientId));

  return NextResponse.json({
    clients,
    matches,
    articleCount,
    stats: {
      articleCount,
      clientCount: clients.length,
      matchCount: matches.length,
      matchedClientCount: matchedClientIds.size,
      unmatchedClientCount: Math.max(clients.length - matchedClientIds.size, 0),
    },
    backend: {
      clientProfileDocument: "ready",
      clientCrudRoutes: "ready",
      matchPersistence: "ready",
      refreshMode: "on_read",
      scoringSource: source,
    },
    lastRefreshedAt: refreshedAt,
  });
}
