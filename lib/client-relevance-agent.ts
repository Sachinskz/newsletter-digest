/**
 * Client Relevance Agent Integration.
 *
 * Calls the BusiBox `client-relevance-scorer` agent for semantic article↔client matching.
 * Falls back to deterministic scoring (client-relevance.ts) if the agent is unavailable.
 *
 * The agent provides:
 * - Semantic understanding of why an article matters to a client
 * - Context-aware scoring beyond keyword overlap
 * - Outreach angles for relationship managers
 * - Urgency assessment based on timing, not just importance
 */

import type { LibraryArticle } from "./editorial-intelligence";
import type { NewsletterClientMatch, NewsletterClientProfile } from "./types";
import { buildClientMatches } from "./client-relevance";
import type { NewsletterEmail, NewsletterSummary } from "./types";

const AGENT_API_URL = process.env.AGENT_API_URL || "http://localhost:8000";
const RELEVANCE_AGENT_NAME = process.env.CLIENT_RELEVANCE_AGENT_NAME || "client-relevance-scorer";
const RELEVANCE_AGENT_TIER = process.env.CLIENT_RELEVANCE_AGENT_TIER || "complex";
const RELEVANCE_TIMEOUT_MS = Number(process.env.CLIENT_RELEVANCE_TIMEOUT_MS || 60000);

// ---------------------------------------------------------------------------
// Agent input/output types
// ---------------------------------------------------------------------------

interface AgentRelevanceMatch {
  articleId: string;
  score: number;
  reason: string;
  angle: string;
  urgency: "high" | "medium" | "low";
}

interface AgentRelevanceOutput {
  clientId: string;
  clientName: string;
  matches: AgentRelevanceMatch[];
  summary: string;
}

// ---------------------------------------------------------------------------
// Agent invocation
// ---------------------------------------------------------------------------

/**
 * Score articles against a single client using the BusiBox agent.
 * Returns null if the agent is unavailable (caller should fall back to deterministic).
 */
async function invokeRelevanceAgent(
  agentApiToken: string,
  client: NewsletterClientProfile,
  articles: LibraryArticle[],
): Promise<AgentRelevanceOutput | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RELEVANCE_TIMEOUT_MS);

  const prompt = JSON.stringify({
    client: {
      id: client.id,
      name: client.name,
      sector: client.sector,
      topics: client.topics,
      priorities: client.priorities,
      relationshipStage: client.relationshipStage || "existing",
      matchThreshold: client.matchThreshold ?? 42,
    },
    articles: articles.map((a) => ({
      id: a.id,
      title: a.title,
      source: a.source,
      category: a.category,
      summary: a.summary,
      why: a.why,
      topics: a.topics,
      companies: a.companies,
      importance: a.importance,
      novelty: a.novelty,
      urgency: a.urgency,
      receivedAt: a.receivedAt,
    })),
  });

  try {
    const res = await fetch(`${AGENT_API_URL}/runs/invoke`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${agentApiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        agent_name: RELEVANCE_AGENT_NAME,
        agent_tier: RELEVANCE_AGENT_TIER,
        input: { prompt },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "no body");
      console.warn(
        `[ClientRelevanceAgent] Agent returned ${res.status}: ${errBody.slice(0, 200)}`,
      );
      return null;
    }

    const data = await res.json();

    if (data.status === "failed" || data.error) {
      console.warn("[ClientRelevanceAgent] Agent run failed:", data.error || "unknown");
      return null;
    }

    if (!data.output) {
      console.warn("[ClientRelevanceAgent] Agent returned no output");
      return null;
    }

    // Parse the output — may be a string or object
    const output = typeof data.output === "string" ? JSON.parse(data.output) : data.output;
    return output as AgentRelevanceOutput;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.warn(`[ClientRelevanceAgent] Timed out after ${RELEVANCE_TIMEOUT_MS}ms`);
    } else {
      console.warn(
        "[ClientRelevanceAgent] Invocation error:",
        error instanceof Error ? error.message : String(error),
      );
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Convert agent output to app match format
// ---------------------------------------------------------------------------

function agentMatchToAppMatch(
  agentMatch: AgentRelevanceMatch,
  client: NewsletterClientProfile,
  article: LibraryArticle,
  matchedAt: string,
): Omit<NewsletterClientMatch, "id"> {
  return {
    clientId: client.id,
    clientName: client.name,
    clientSector: client.sector,
    articleId: article.id,
    articleTitle: article.title,
    articleSource: article.source,
    articleCategory: article.category,
    articleSummary: article.summary,
    articleWhy: article.why,
    articleReceivedAt: article.receivedAt,
    articleImportance: article.importance,
    articleNovelty: article.novelty,
    articleUrgency: article.urgency,
    articleCompanies: article.companies,
    articleTopics: article.topics,
    score: agentMatch.score,
    reason: agentMatch.reason,
    matchedAt,
  };
}

// ---------------------------------------------------------------------------
// Public API — agent-first with deterministic fallback
// ---------------------------------------------------------------------------

/**
 * Build client matches using the BusiBox agent for semantic scoring.
 * Falls back to deterministic matching if agent is unavailable.
 *
 * @param agentApiToken - Token for agent-api calls
 * @param newsletters - All synced newsletter emails
 * @param summaries - All generated summaries
 * @param clients - All client profiles
 * @param articles - Pre-derived library articles
 * @param matchedAt - Timestamp for the match batch
 */
export async function buildClientMatchesWithAgent(
  agentApiToken: string,
  newsletters: NewsletterEmail[],
  summaries: NewsletterSummary[],
  clients: NewsletterClientProfile[],
  articles: LibraryArticle[],
  matchedAt = new Date().toISOString(),
): Promise<{
  articleCount: number;
  matches: Array<Omit<NewsletterClientMatch, "id">>;
  source: "agent" | "deterministic";
}> {
  // If no articles or no clients, short-circuit
  if (articles.length === 0 || clients.length === 0) {
    return { articleCount: articles.length, matches: [], source: "deterministic" };
  }

  // Try agent-based scoring for each client
  const allMatches: Array<Omit<NewsletterClientMatch, "id">> = [];
  let agentSuccess = false;

  // Process clients sequentially (agent calls are heavy)
  for (const client of clients) {
    const agentResult = await invokeRelevanceAgent(agentApiToken, client, articles);

    if (agentResult) {
      agentSuccess = true;
      // Map agent matches to app format
      for (const agentMatch of agentResult.matches) {
        const article = articles.find((a) => a.id === agentMatch.articleId);
        if (article && agentMatch.score >= (client.matchThreshold ?? 42)) {
          allMatches.push(agentMatchToAppMatch(agentMatch, client, article, matchedAt));
        }
      }
    } else {
      // Agent failed for this client — use deterministic fallback for just this client
      console.log(
        `[ClientRelevanceAgent] Falling back to deterministic for client: ${client.name}`,
      );
      const { matches: deterministicMatches } = buildClientMatches(
        newsletters,
        summaries,
        [client],
        matchedAt,
      );
      allMatches.push(...deterministicMatches);
    }
  }

  return {
    articleCount: articles.length,
    matches: allMatches.sort((a, b) => b.score - a.score),
    source: agentSuccess ? "agent" : "deterministic",
  };
}
