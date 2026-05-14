import { describe, expect, it } from "vitest";
import { deriveCategory, deriveLibraryArticles } from "./editorial-intelligence";
import type { NewsletterEmail, NewsletterSummary } from "./types";

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
});
