import { describe, expect, it } from "vitest";
import { buildSummaryPrompt, isSummaryFormat, parseSummaryOutput, SUMMARY_FORMAT_OPTIONS } from "./summarization";
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
