import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuthWithTokenExchange: vi.fn(),
  createSummary: vi.fn(),
  ensureDataDocuments: vi.fn(),
  getEmailById: vi.fn(),
  getPreferences: vi.fn(),
  getSummaryForEmail: vi.fn(),
  markEmailSummarized: vi.fn(),
  requestNewsletterSummary: vi.fn(),
}));

vi.mock("@/lib/auth-middleware", () => ({
  requireAuthWithTokenExchange: mocks.requireAuthWithTokenExchange,
}));

vi.mock("@/lib/data-api-client", () => ({
  createSummary: mocks.createSummary,
  ensureDataDocuments: mocks.ensureDataDocuments,
  getEmailById: mocks.getEmailById,
  getPreferences: mocks.getPreferences,
  getSummaryForEmail: mocks.getSummaryForEmail,
  markEmailSummarized: mocks.markEmailSummarized,
}));

vi.mock("@/lib/summarization", async () => {
  const actual = await vi.importActual<typeof import("@/lib/summarization")>("@/lib/summarization");
  return {
    ...actual,
    requestNewsletterSummary: mocks.requestNewsletterSummary,
  };
});

import { POST } from "./route";

describe("newsletter summarize route", () => {
  it("returns 404 for an unknown newsletter", async () => {
    mocks.requireAuthWithTokenExchange.mockResolvedValue({ apiToken: "token" });
    mocks.ensureDataDocuments.mockResolvedValue({ emails: "emails-doc", summaries: "summaries-doc" });
    mocks.getEmailById.mockResolvedValue(null);

    const response = await POST(
      new NextRequest("http://localhost:3002/api/newsletters/missing/summarize", { method: "POST" }),
      { params: Promise.resolve({ id: "missing" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Newsletter not found");
    expect(mocks.createSummary).not.toHaveBeenCalled();
  });

  it("uses the saved summary format when invoking agent-api", async () => {
    const newsletter = {
      id: "email-1",
      senderEmail: "news@example.com",
      subject: "AI briefing",
      receivedAt: "2026-05-13T10:00:00.000Z",
      bodyPlainText: "Important AI news.",
    };
    const summaryOutput = {
      title: "AI briefing",
      tldr: "Important news.",
      keyPoints: [],
      actionItems: [],
      sentiment: "neutral",
      topics: [],
      readTimeMinutes: 2,
    };
    mocks.requireAuthWithTokenExchange
      .mockResolvedValueOnce({ apiToken: "agent-token" })
      .mockResolvedValueOnce({ apiToken: "data-token" });
    mocks.ensureDataDocuments.mockResolvedValue({ emails: "emails-doc", summaries: "summaries-doc", preferences: "preferences-doc" });
    mocks.getEmailById.mockResolvedValue(newsletter);
    mocks.getSummaryForEmail.mockResolvedValue(null);
    mocks.getPreferences.mockResolvedValue({ summaryFormat: "key_insights" });
    mocks.requestNewsletterSummary.mockResolvedValue(summaryOutput);
    mocks.createSummary.mockResolvedValue({ id: "summary-1", emailId: "email-1", format: "key_insights", ...summaryOutput });

    const response = await POST(
      new NextRequest("http://localhost:3002/api/newsletters/email-1/summarize", { method: "POST" }),
      { params: Promise.resolve({ id: "email-1" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.requestNewsletterSummary).toHaveBeenCalledWith(
      "agent-token",
      newsletter,
      "key_insights",
    );
    expect(mocks.createSummary).toHaveBeenCalledWith("data-token", "summaries-doc", "email-1", summaryOutput, "key_insights");
  });

  it("falls back to a deterministic summary when agent generation fails", async () => {
    const newsletter = {
      id: "email-2",
      senderEmail: "news@example.com",
      senderName: "Example News",
      subject: "Weekly AI briefing",
      receivedAt: "2026-05-13T10:00:00.000Z",
      bodyPlainText: "A useful newsletter body with enough detail to create a fallback summary for the reader.",
      bodyLengthChars: 84,
      hasBeenSummarized: false,
      fetchedAt: "2026-05-13T10:01:00.000Z",
    };

    mocks.requireAuthWithTokenExchange
      .mockResolvedValueOnce({ apiToken: "agent-token" })
      .mockResolvedValueOnce({ apiToken: "data-token" });
    mocks.ensureDataDocuments.mockResolvedValue({ emails: "emails-doc", summaries: "summaries-doc", preferences: "preferences-doc" });
    mocks.getEmailById.mockResolvedValue(newsletter);
    mocks.getSummaryForEmail.mockResolvedValue(null);
    mocks.getPreferences.mockResolvedValue({ summaryFormat: "bullet_points" });
    mocks.requestNewsletterSummary.mockRejectedValue(new Error("agent timeout"));
    mocks.createSummary.mockResolvedValue({ id: "summary-2", emailId: "email-2" });

    const response = await POST(
      new NextRequest("http://localhost:3002/api/newsletters/email-2/summarize", { method: "POST" }),
      { params: Promise.resolve({ id: "email-2" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.createSummary).toHaveBeenCalledWith(
      "data-token",
      "summaries-doc",
      "email-2",
      expect.objectContaining({
        title: "Weekly AI briefing",
        sentiment: "neutral",
      }),
      "bullet_points",
    );
  });
});
