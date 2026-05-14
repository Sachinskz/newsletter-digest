import { getNow } from "@jazzmind/busibox-app";
import { deriveLibraryArticles, matchReason, matchScore } from "./editorial-intelligence";
import type {
  NewsletterClientMatch,
  NewsletterClientProfile,
  NewsletterEmail,
  NewsletterSummary,
} from "./types";

export function buildClientMatches(
  newsletters: NewsletterEmail[],
  summaries: NewsletterSummary[],
  clients: NewsletterClientProfile[],
  matchedAt = getNow(),
): {
  articleCount: number;
  matches: Array<Omit<NewsletterClientMatch, "id">>;
} {
  const articles = deriveLibraryArticles(newsletters, summaries);

  const matches = clients.flatMap((client) => {
    const threshold = client.matchThreshold ?? 42;

    return articles
      .map((article) => ({
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
        score: matchScore(article, client),
        reason: matchReason(article, client),
        matchedAt,
      }))
      .filter((match) => match.score >= threshold)
      .sort((a, b) => b.score - a.score);
  });

  return {
    articleCount: articles.length,
    matches,
  };
}
