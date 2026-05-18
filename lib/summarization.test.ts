import { describe, expect, it } from "vitest";
import {
  buildFallbackSummary,
  buildSummaryPrompt,
  isSummaryFormat,
  parseSummaryOutput,
  prepareNewsletterTextForSummary,
  SUMMARY_FORMAT_OPTIONS,
} from "./summarization";
import type { NewsletterEmail, SummaryOutput } from "./types";

const email: NewsletterEmail = {
  id: "email-1",
  messageId: "graph-1",
  senderEmail: "news@example.com",
  senderName: "Example News",
  subject: "Weekly AI briefing",
  receivedAt: "2026-05-13T10:00:00.000Z",
  bodyPlainText: "A useful newsletter body.",
  bodyLengthChars: 25,
  hasBeenSummarized: false,
  fetchedAt: "2026-05-13T10:01:00.000Z",
};

describe("summarization helpers", () => {
  it("builds a prompt containing sender, subject, received date, and body", () => {
    const prompt = buildSummaryPrompt(email);

    expect(prompt).toContain("Example News <news@example.com>");
    expect(prompt).toContain("Weekly AI briefing");
    expect(prompt).toContain("2026-05-13T10:00:00.000Z");
    expect(prompt).toContain("A useful newsletter body.");
  });

  it("adds format-specific instructions for every summary format", () => {
    for (const option of SUMMARY_FORMAT_OPTIONS) {
      const prompt = buildSummaryPrompt(email, option.id);
      expect(prompt).toContain(`Preferred format: ${option.title}.`);
    }
    expect(buildSummaryPrompt(email, "key_insights")).toContain("business implications");
    expect(buildSummaryPrompt(email, "full_digest")).toContain("comprehensive digest");
  });

  it("validates summary format values", () => {
    expect(isSummaryFormat("bullet_points")).toBe(true);
    expect(isSummaryFormat("not_real")).toBe(false);
  });

  it("accepts valid structured summary output", () => {
    const output: SummaryOutput = {
      title: "AI briefing",
      tldr: "Useful updates.",
      keyPoints: [{ point: "Model releases", importance: "high" }],
      actionItems: [{ action: "Share with team", urgency: "medium" }],
      sentiment: "positive",
      topics: ["AI", "Operations"],
      readTimeMinutes: 4,
    };

    expect(parseSummaryOutput(output)).toEqual(output);
  });

  it("accepts wrapped JSON string output", () => {
    const output: SummaryOutput = {
      title: "AI briefing",
      tldr: "Useful updates.",
      keyPoints: [{ point: "Model releases", importance: "high" }],
      actionItems: [{ action: "Share with team", urgency: "medium" }],
      sentiment: "positive",
      topics: ["AI", "Operations"],
      readTimeMinutes: 4,
    };

    expect(
      parseSummaryOutput({
        output: `\`\`\`json
${JSON.stringify(output, null, 2)}
\`\`\``,
      }),
    ).toEqual(output);
  });

  it("accepts agent result strings missing the opening object brace", () => {
    const output: SummaryOutput = {
      title: "Career pivots surge",
      tldr: "Workers are changing careers as layoffs and AI reshape labor demand.",
      keyPoints: [{ point: "Nearly 80% of US professionals want a new job.", importance: "high" }],
      actionItems: [{ action: "Review hiring plans for mid-career switchers.", urgency: "medium" }],
      sentiment: "neutral",
      topics: ["Career Pivot Trends", "Workforce Aging"],
      readTimeMinutes: 6,
    };
    const withoutOpeningBrace = JSON.stringify(output, null, 2).replace(/^\{/, "");

    expect(parseSummaryOutput({ result: withoutOpeningBrace })).toEqual(output);
  });

  it("accepts nested result wrappers", () => {
    const output: SummaryOutput = {
      title: "AI briefing",
      tldr: "Useful updates.",
      keyPoints: [{ point: "Model releases", importance: "high" }],
      actionItems: [{ action: "Share with team", urgency: "medium" }],
      sentiment: "positive",
      topics: ["AI", "Operations"],
      readTimeMinutes: 4,
    };

    expect(
      parseSummaryOutput({
        result: {
          response: {
            newsletter_summary: output,
          },
        },
      }),
    ).toEqual(output);
  });

  it("builds a deterministic fallback summary from the newsletter body", () => {
    const output = buildFallbackSummary(email, "bullet_points");

    expect(output.title).toContain("Weekly AI briefing");
    expect(output.tldr.length).toBeGreaterThan(0);
    expect(output.keyPoints.length).toBeGreaterThan(0);
    expect(output.actionItems.length).toBeGreaterThan(0);
    expect(output.sentiment).toBe("neutral");
    expect(output.readTimeMinutes).toBeGreaterThan(0);
  });

  it("prepares newsletter text by stripping obvious promo/footer noise", () => {
    const prepared = prepareNewsletterTextForSummary(`
Presented by Example Corp
Important market update for operators.
Privacy Statement | Unsubscribe
This email was sent from an unmonitored mailbox.
Another real paragraph with useful context.
`);

    expect(prepared).toContain("Important market update for operators.");
    expect(prepared).toContain("Another real paragraph with useful context.");
    expect(prepared).not.toContain("Presented by Example Corp");
    expect(prepared).not.toContain("Privacy Statement");
    expect(prepared).not.toContain("unmonitored mailbox");
  });

  it("rejects malformed output shape", () => {
    expect(() =>
      parseSummaryOutput({
        title: "Missing arrays",
        tldr: "Nope",
        keyPoints: "bad",
        actionItems: [],
        sentiment: "neutral",
        topics: [],
        readTimeMinutes: 2,
      }),
    ).toThrow("missing required fields");
  });

  it("rejects invalid sentiment", () => {
    expect(() =>
      parseSummaryOutput({
        title: "Invalid",
        tldr: "Nope",
        keyPoints: [],
        actionItems: [],
        sentiment: "excited",
        topics: [],
        readTimeMinutes: 2,
      }),
    ).toThrow("invalid sentiment");
  });
});
