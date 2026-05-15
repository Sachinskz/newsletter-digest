import { describe, expect, it } from "vitest";
import { deriveCategory, deriveLibraryArticles } from "./editorial-intelligence";
import type { NewsletterEmail, NewsletterPreferences, NewsletterSummary } from "./types";

describe("editorial intelligence", () => {
  it("ignores junk topic labels when deriving articles", () => {
    const newsletters: NewsletterEmail[] = [
      {
        id: "email-1",
        messageId: "graph-1",
        senderEmail: "digest@example.com",
        senderName: "Digest",
        subject: "OpenAI launches new enterprise agent workflow tools",
        receivedAt: "2026-05-14T09:00:00.000Z",
        bodyPlainText: "Enterprise teams are adopting new agent workflow tools.",
        bodyLengthChars: 60,
        hasBeenSummarized: true,
        summaryId: "summary-1",
        fetchedAt: "2026-05-14T09:05:00.000Z",
      },
    ];

    const summaries: NewsletterSummary[] = [
      {
        id: "summary-1",
        emailId: "email-1",
        title: "OpenAI pushes agents into enterprise workflows",
        tldr: "A new push into enterprise automation and operator workflows.",
        keyPoints: JSON.stringify([{ point: "Enterprise operators are piloting agent workflows.", importance: "high" }]),
        actionItems: JSON.stringify([]),
        sentiment: "positive",
        topics: JSON.stringify(["The", "37", "And", "Email", "For", "Com", "Get", "Agents", "Workflow Automation"]),
        readTimeMinutes: 3,
        generatedAt: "2026-05-14T09:10:00.000Z",
      },
    ];

    const [article] = deriveLibraryArticles(newsletters, summaries);
    expect(article.category).toBe("Agents");
    expect(article.topics).toEqual(["Agents", "Workflow Automation"]);
  });

  it("falls back to enterprise instead of bad single-word stopwords", () => {
    expect(deriveCategory("Weekly digest", "General update", ["The", "And", "You", "For", "Com", "Get"])).toBe("Enterprise");
  });

  it("boosts articles that match the saved briefing profile", () => {
    const newsletters: NewsletterEmail[] = [
      {
        id: "email-1",
        messageId: "graph-1",
        senderEmail: "digest@example.com",
        senderName: "Digest",
        subject: "OpenAI launches new enterprise agent workflow tools",
        receivedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        bodyPlainText: "Enterprise teams are adopting new agent workflow tools for client-facing operations.",
        bodyLengthChars: 84,
        hasBeenSummarized: true,
        summaryId: "summary-1",
        fetchedAt: "2026-05-14T09:05:00.000Z",
      },
      {
        id: "email-2",
        messageId: "graph-2",
        senderEmail: "policy@example.com",
        senderName: "Policy Brief",
        subject: "New cross-border compliance memo",
        receivedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        bodyPlainText: "A regulatory memo covers policy updates.",
        bodyLengthChars: 48,
        hasBeenSummarized: true,
        summaryId: "summary-2",
        fetchedAt: "2026-05-14T09:35:00.000Z",
      },
    ];

    const summaries: NewsletterSummary[] = [
      {
        id: "summary-1",
        emailId: "email-1",
        title: "OpenAI pushes agents into enterprise workflows",
        tldr: "Client teams are piloting agent workflows that shorten response time.",
        keyPoints: JSON.stringify([{ point: "Agent tooling can improve client operations.", importance: "high" }]),
        actionItems: JSON.stringify([]),
        sentiment: "positive",
        topics: JSON.stringify(["Agents", "Enterprise", "Client Operations"]),
        readTimeMinutes: 3,
        generatedAt: "2026-05-14T09:10:00.000Z",
      },
      {
        id: "summary-2",
        emailId: "email-2",
        title: "Policy memo lands",
        tldr: "A memo covers compliance and policy changes.",
        keyPoints: JSON.stringify([{ point: "Regulation continues to shift.", importance: "medium" }]),
        actionItems: JSON.stringify([]),
        sentiment: "neutral",
        topics: JSON.stringify(["Regulation", "Compliance"]),
        readTimeMinutes: 2,
        generatedAt: "2026-05-14T09:40:00.000Z",
      },
    ];

    const preferences: NewsletterPreferences = {
      id: "summary-format",
      summaryFormat: "bullet_points",
      roleTitle: "Sales / Account Executive",
      primaryFocus: "Winning more clients",
      interests: ["AI agents and automation"],
      wantsToKnow: "What should I talk to clients about this week?",
      rankingPriorities: ["Client relevance", "Revenue opportunities"],
      createdAt: "2026-05-14T09:00:00.000Z",
      updatedAt: "2026-05-14T09:00:00.000Z",
    };

    const articles = deriveLibraryArticles(newsletters, summaries, preferences).sort((a, b) => b.importance - a.importance);

    expect(articles[0]?.id).toBe("email-1");
    expect(articles[0]?.personalFit).toBeGreaterThan(articles[1]?.personalFit ?? 0);
    expect(articles[0]?.importance).toBeGreaterThan(articles[1]?.importance ?? 0);
  });

  it("ignores noisy generic language when a sharper operational match exists", () => {
    const newsletters: NewsletterEmail[] = [
      {
        id: "email-1",
        messageId: "graph-1",
        senderEmail: "generic@example.com",
        senderName: "General AI Brief",
        subject: "AI business update for the market",
        receivedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        bodyPlainText: "AI is changing business. AI teams are building AI products for the market.",
        bodyLengthChars: 74,
        hasBeenSummarized: true,
        summaryId: "summary-1",
        fetchedAt: "2026-05-14T09:05:00.000Z",
      },
      {
        id: "email-2",
        messageId: "graph-2",
        senderEmail: "ops@example.com",
        senderName: "Ops Wire",
        subject: "Secure agent rollout playbook for internal teams",
        receivedAt: new Date(Date.now() - 80 * 60 * 1000).toISOString(),
        bodyPlainText: "Operators are deploying secure agent workflows with governance and integration guidance.",
        bodyLengthChars: 92,
        hasBeenSummarized: true,
        summaryId: "summary-2",
        fetchedAt: "2026-05-14T08:35:00.000Z",
      },
    ];

    const summaries: NewsletterSummary[] = [
      {
        id: "summary-1",
        emailId: "email-1",
        title: "AI business update",
        tldr: "A broad update on AI and the market.",
        keyPoints: JSON.stringify([{ point: "AI keeps moving quickly.", importance: "medium" }]),
        actionItems: JSON.stringify([]),
        sentiment: "neutral",
        topics: JSON.stringify(["AI", "Business", "Market"]),
        readTimeMinutes: 2,
        generatedAt: "2026-05-14T09:10:00.000Z",
      },
      {
        id: "summary-2",
        emailId: "email-2",
        title: "Secure agent rollout playbook",
        tldr: "A deployment guide covers governance, rollout, and integration steps for internal AI operations.",
        keyPoints: JSON.stringify([{ point: "Internal teams can operationalize agents safely.", importance: "high" }]),
        actionItems: JSON.stringify([]),
        sentiment: "positive",
        topics: JSON.stringify(["Agents", "Deployment", "Governance"]),
        readTimeMinutes: 4,
        generatedAt: "2026-05-14T08:40:00.000Z",
      },
    ];

    const preferences: NewsletterPreferences = {
      id: "summary-format",
      summaryFormat: "bullet_points",
      roleTitle: "AI Operations Lead",
      primaryFocus: "Operationalizing AI internally",
      interests: ["Tools we can adopt quickly"],
      wantsToKnow: "What can we deploy quickly with the least friction?",
      rankingPriorities: ["Tools we can deploy quickly"],
      createdAt: "2026-05-14T09:00:00.000Z",
      updatedAt: "2026-05-14T09:00:00.000Z",
    };

    const articles = deriveLibraryArticles(newsletters, summaries, preferences).sort((a, b) => b.importance - a.importance);

    expect(articles[0]?.id).toBe("email-2");
    expect(articles[0]?.personalFit).toBeGreaterThan(articles[1]?.personalFit ?? 0);
  });
});
