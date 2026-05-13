import { describe, expect, it } from "vitest";
import { buildContentPrompt, parseGeneratedContentOutput } from "./content-generation";
import type { LibraryArticle } from "./editorial-intelligence";

const article: LibraryArticle = {
  id: "article-1",
  title: "AI agents enter enterprise workflows",
  source: "AI Daily",
  category: "Agents",
  summary: "Agents are moving into structured enterprise workflows.",
  why: "It changes how operators evaluate AI platforms.",
  importance: 91,
  novelty: 78,
  urgency: 82,
  companies: ["OpenAI"],
  topics: ["agents", "workflow"],
  receivedAt: "2026-05-13T10:00:00.000Z",
};

describe("content generation helpers", () => {
  it("builds client-aware email prompts", () => {
    const prompt = buildContentPrompt({
      article,
      kind: "email",
      tone: "Executive",
      client: {
        id: "client-1",
        name: "Meridian Capital",
        sector: "Financial Services",
        priorities: "Governed AI deployment",
        topics: ["regulation", "agents"],
      },
    });

    expect(prompt).toContain("Output type: Client email");
    expect(prompt).toContain("Client context:");
    expect(prompt).toContain("Meridian Capital");
    expect(prompt).toContain("Do not invent facts");
  });

  it("rejects malformed generated output", () => {
    expect(() => parseGeneratedContentOutput({ title: "Draft" })).toThrow("missing required fields");
  });

  it("normalizes missing subject to an empty string", () => {
    expect(parseGeneratedContentOutput({ title: "Draft", body: "Body", notes: "Review" })).toEqual({
      title: "Draft",
      subject: "",
      body: "Body",
      notes: "Review",
    });
  });
});
