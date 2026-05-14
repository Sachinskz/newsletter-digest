import { getSummaryFormatOption } from "./summarization";
import type { NewsletterClientProfile as ClientProfile, NewsletterEmail, NewsletterSummary } from "./types";

export type { ClientProfile };

export interface LibraryArticle {
  id: string;
  newsletterId?: string;
  title: string;
  source: string;
  category: string;
  summary: string;
  why: string;
  body: string;
  summaryRecord?: NewsletterSummary;
  importance: number;
  novelty: number;
  urgency: number;
  companies: string[];
  topics: string[];
  savedFormat?: string;
  receivedAt: string;
  url?: string;
}

const KNOWN_COMPANIES = [
  "OpenAI",
  "Anthropic",
  "Google",
  "Microsoft",
  "Meta",
  "NVIDIA",
  "Mistral",
  "Salesforce",
  "HubSpot",
  "ServiceNow",
  "Cursor",
  "Perplexity",
  "Figma",
  "Notion",
  "Adobe",
  "Databricks",
];

const CATEGORY_KEYWORDS: Array<{ category: string; keywords: string[] }> = [
  { category: "Agents", keywords: ["agent", "workflow", "operator", "automation"] },
  { category: "Infrastructure", keywords: ["inference", "gpu", "datacenter", "model", "compute", "infra"] },
  { category: "Regulation", keywords: ["regulation", "policy", "act", "compliance", "law"] },
  { category: "Enterprise", keywords: ["enterprise", "copilot", "workspace", "saas", "buyer"] },
  { category: "Research", keywords: ["research", "paper", "benchmark", "reasoning", "model card"] },
];

const CATEGORY_LABELS = new Set(CATEGORY_KEYWORDS.map((group) => group.category.toLowerCase()));
const TOPIC_STOPWORDS = new Set([
  "the",
  "and",
  "you",
  "your",
  "with",
  "that",
  "this",
  "from",
  "into",
  "about",
  "have",
  "will",
  "they",
  "their",
  "them",
  "what",
  "when",
  "where",
  "which",
  "for",
  "get",
  "com",
  "www",
  "http",
  "https",
  "email",
  "emails",
  "newsletter",
  "newsletters",
  "update",
  "updates",
  "microsoft",
]);

export const DEFAULT_CLIENTS: ClientProfile[] = [];

export function deriveLibraryArticles(newsletters: NewsletterEmail[], summaries: NewsletterSummary[]): LibraryArticle[] {
  if (!newsletters.length) {
    return [];
  }

  const summaryByEmailId = new Map(summaries.map((summary) => [summary.emailId, summary]));

  return newsletters.map((newsletter, index) => {
    const summary = summaryByEmailId.get(newsletter.id);
    const summaryTopics = parseStringArray(summary?.topics);
    const keyPoints = parseKeyPoints(summary?.keyPoints);
    const category = deriveCategory(newsletter.subject, summary?.tldr, summaryTopics);
    const companies = extractCompanies([newsletter.subject, newsletter.bodyPlainText, summary?.tldr || ""].join(" "));
    const ageHours = Math.max(1, Math.round((Date.now() - new Date(newsletter.receivedAt).getTime()) / (1000 * 60 * 60)));
    const importance = clamp(94 - index * 5 - ageHours, 48, 96);
    const novelty = clamp(64 + summaryTopics.length * 6 + (summary ? 6 : 0) - index * 2, 44, 94);
    const urgency = clamp(88 - ageHours * 3 + (category === "Regulation" ? 8 : 0), 38, 95);

    return {
      id: newsletter.id,
      newsletterId: newsletter.id,
      title: summary?.title || newsletter.subject,
      source: newsletter.senderName || newsletter.senderEmail,
      category,
      summary: summary?.tldr || trimText(newsletter.bodyPlainText, 180),
      why: keyPoints[0] || summary?.tldr || trimText(newsletter.bodyPlainText, 140),
      body: newsletter.bodyPlainText,
      summaryRecord: summary,
      importance,
      novelty,
      urgency,
      companies,
      topics: summaryTopics.length ? summaryTopics : fallbackTopics(newsletter.bodyPlainText, category),
      savedFormat: summary?.format ? getSummaryFormatOption(summary.format).title : undefined,
      receivedAt: newsletter.receivedAt,
    };
  });
}

export function matchScore(article: LibraryArticle, client: ClientProfile): number {
  const articleTerms = normalizeTerms([
    article.category,
    ...article.topics,
    ...article.companies,
    article.title,
    article.summary,
    article.why,
  ]);
  const clientTerms = normalizeTerms([client.sector, client.priorities, ...client.topics]);

  let score = 12;
  client.topics.forEach((topic) => {
    if (articleTerms.has(normalizeToken(topic))) {
      score += 18;
    } else if (fuzzyHas(articleTerms, topic)) {
      score += 12;
    }
  });

  const sectorTokens = tokenize(client.sector);
  sectorTokens.forEach((token) => {
    if (articleTerms.has(token)) score += 7;
  });

  article.companies.forEach((company) => {
    if (clientTerms.has(normalizeToken(company))) score += 10;
  });

  if (article.category === "Regulation" && fuzzyHas(clientTerms, "financial services")) score += 10;
  if (article.category === "Enterprise" && fuzzyHas(clientTerms, "workflow")) score += 8;
  if (article.category === "Infrastructure" && fuzzyHas(clientTerms, "on-prem")) score += 10;
  if (article.category === "Agents" && fuzzyHas(clientTerms, "agents")) score += 8;

  score += Math.round(article.importance / 12);
  return clamp(score, 6, 98);
}

export function matchReason(article: LibraryArticle, client: ClientProfile): string {
  const overlappingTopics = client.topics.filter((topic) => fuzzyHas(normalizeTerms(article.topics), topic));
  if (overlappingTopics.length) {
    return `Strong overlap on ${overlappingTopics.slice(0, 2).join(" and ")}, which maps directly to ${client.name}'s current priorities.`;
  }

  if (article.category === "Regulation") {
    return `Regulatory change and governance posture are likely to matter for ${client.name}'s buying and deployment decisions.`;
  }

  if (article.category === "Infrastructure") {
    return `This speaks to deployment model, reliability, and stack choices that operators in ${client.sector} will care about.`;
  }

  return `The article aligns with ${client.name}'s sector focus and strategic priorities, making it a useful outreach trigger.`;
}

export function categoryTone(category: string): string {
  switch (category) {
    case "Agents":
      return "analyst-chip-accent";
    case "Infrastructure":
      return "analyst-chip-cyan";
    case "Regulation":
      return "analyst-chip-warn";
    case "Enterprise":
      return "analyst-chip-good";
    default:
      return "analyst-chip";
  }
}

export function formatReceivedAt(value: string): string {
  const date = new Date(value);
  const diffMinutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

function parseStringArray(value?: string): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => sanitizeTopicLabel(item))
      .filter((item): item is string => Boolean(item))
      .slice(0, 6);
  } catch {
    return [];
  }
}

function parseKeyPoints(value?: string): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (item && typeof item === "object" && typeof (item as { point?: unknown }).point === "string") {
          return (item as { point: string }).point;
        }
        return null;
      })
      .filter((item): item is string => Boolean(item));
  } catch {
    return [];
  }
}

export function deriveCategory(subject: string, summary?: string, topics: string[] = []): string {
  const blob = [subject, summary || "", topics.join(" ")].join(" ").toLowerCase();
  for (const group of CATEGORY_KEYWORDS) {
    if (group.keywords.some((keyword) => blob.includes(keyword))) {
      return group.category;
    }
  }
  const topicFallback = topics.find((topic) => isUsableTopicForCategory(topic));
  return topicFallback ? titleCase(topicFallback) : "Enterprise";
}

function fallbackTopics(text: string, category: string): string[] {
  const blob = text.toLowerCase();
  const topics = new Set<string>();
  CATEGORY_KEYWORDS.forEach((group) => {
    if (group.keywords.some((keyword) => blob.includes(keyword))) {
      group.keywords.slice(0, 2).forEach((keyword) => topics.add(keyword));
    }
  });
  if (!topics.size) topics.add(category.toLowerCase());
  return [...topics].map((topic) => sanitizeTopicLabel(topic)).filter((topic): topic is string => Boolean(topic)).slice(0, 4);
}

function extractCompanies(text: string): string[] {
  const matches = KNOWN_COMPANIES.filter((company) => text.toLowerCase().includes(company.toLowerCase()));
  return matches.slice(0, 3);
}

function trimText(value: string, limit: number): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= limit) return clean;
  return `${clean.slice(0, limit - 1).trimEnd()}…`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function titleCase(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function normalizeTerms(values: string[]): Set<string> {
  const terms = new Set<string>();
  values.forEach((value) => {
    tokenize(value).forEach((token) => terms.add(token));
  });
  return terms;
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2);
}

function normalizeToken(value: string): string {
  return value.toLowerCase().trim();
}

function fuzzyHas(terms: Set<string>, query: string): boolean {
  const queryTokens = tokenize(query);
  return queryTokens.some((token) => terms.has(token));
}

function sanitizeTopicLabel(value: string): string | null {
  const clean = value.replace(/\s+/g, " ").trim();
  if (!clean) return null;
  if (/^\d+$/.test(clean)) return null;

  const tokens = clean
    .split(/[^a-zA-Z0-9]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) return null;
  if (tokens.every((token) => token.length < 3)) return null;

  const meaningfulTokens = tokens.filter((token) => {
    const normalized = token.toLowerCase();
    return token.length >= 3 && !TOPIC_STOPWORDS.has(normalized);
  });

  if (meaningfulTokens.length === 0) return null;

  const normalizedPhrase = meaningfulTokens.join(" ").toLowerCase();
  if (CATEGORY_LABELS.has(normalizedPhrase)) {
    return titleCase(normalizedPhrase);
  }

  return titleCase(meaningfulTokens.join(" "));
}

function isUsableTopicForCategory(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return Boolean(normalized) && !TOPIC_STOPWORDS.has(normalized) && !CATEGORY_LABELS.has(normalized);
}
