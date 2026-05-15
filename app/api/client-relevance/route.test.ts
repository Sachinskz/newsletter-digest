import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuthWithTokenExchange: vi.fn(),
  buildClientMatches: vi.fn(),
  ensureDataDocuments: vi.fn(),
  listClientMatches: vi.fn(),
  listClientProfiles: vi.fn(),
  listEmails: vi.fn(),
  listSummaries: vi.fn(),
  replaceClientMatchesForClient: vi.fn(),
}));

vi.mock("@/lib/auth-middleware", () => ({
  requireAuthWithTokenExchange: mocks.requireAuthWithTokenExchange,
}));

vi.mock("@/lib/client-relevance", () => ({
  buildClientMatches: mocks.buildClientMatches,
}));

vi.mock("@/lib/data-api-client", () => ({
  ensureDataDocuments: mocks.ensureDataDocuments,
  listClientMatches: mocks.listClientMatches,
  listClientProfiles: mocks.listClientProfiles,
  listEmails: mocks.listEmails,
  listSummaries: mocks.listSummaries,
  replaceClientMatchesForClient: mocks.replaceClientMatchesForClient,
}));

import { GET } from "./route";

describe("client relevance route", () => {
  it("refreshes persisted matches and returns the stored results", async () => {
    const clients = [
      {
        id: "client-1",
        name: "Harbor Capital",
        sector: "Financial services",
        topics: ["agents"],
        priorities: "Governed automation",
        createdAt: "2026-05-14T09:00:00.000Z",
        updatedAt: "2026-05-14T09:00:00.000Z",
      },
    ];

    mocks.requireAuthWithTokenExchange.mockResolvedValue({ apiToken: "token" });
    mocks.ensureDataDocuments.mockResolvedValue({
      clients: "clients-doc",
      emails: "emails-doc",
      summaries: "summaries-doc",
      clientMatches: "matches-doc",
    });
    mocks.listClientProfiles.mockResolvedValue(clients);
    mocks.listEmails.mockResolvedValue([{ id: "email-1" }]);
    mocks.listSummaries.mockResolvedValue([{ id: "summary-1" }]);
    mocks.buildClientMatches.mockReturnValue({
      articleCount: 3,
      matches: [
        {
          clientId: "client-1",
          clientName: "Harbor Capital",
          clientSector: "Financial services",
          articleId: "article-1",
          articleTitle: "Governed agents land in banking",
          articleSource: "AI Daily",
          articleCategory: "Agents",
          articleSummary: "Banks are trialing governed agent workflows.",
          articleWhy: "Useful for outreach.",
          articleReceivedAt: "2026-05-14T08:00:00.000Z",
          articleImportance: 90,
          articleNovelty: 76,
          articleUrgency: 71,
          articleCompanies: ["OpenAI"],
          articleTopics: ["agents"],
          score: 84,
          reason: "Strong overlap on agents.",
          matchedAt: "2026-05-14T09:30:00.000Z",
        },
      ],
    });
    mocks.listClientMatches.mockResolvedValue([
      {
        id: "match-1",
        clientId: "client-1",
        clientName: "Harbor Capital",
        clientSector: "Financial services",
        articleId: "article-1",
        articleTitle: "Governed agents land in banking",
        articleSource: "AI Daily",
        articleCategory: "Agents",
        articleSummary: "Banks are trialing governed agent workflows.",
        articleWhy: "Useful for outreach.",
        articleReceivedAt: "2026-05-14T08:00:00.000Z",
        articleImportance: 90,
        articleNovelty: 76,
        articleUrgency: 71,
        articleCompanies: ["OpenAI"],
        articleTopics: ["agents"],
        score: 84,
        reason: "Strong overlap on agents.",
        matchedAt: "2026-05-14T09:30:00.000Z",
      },
    ]);

    const response = await GET(new NextRequest("http://localhost:3002/api/client-relevance"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.replaceClientMatchesForClient).toHaveBeenCalledWith(
      "token",
      "matches-doc",
      "client-1",
      [
        expect.objectContaining({
          clientId: "client-1",
          articleId: "article-1",
          score: 84,
        }),
      ],
    );
    expect(body.articleCount).toBe(3);
    expect(body.clients).toEqual(clients);
    expect(body.matches[0].id).toBe("match-1");
    expect(body.backend).toEqual({
      clientProfileDocument: "ready",
      clientCrudRoutes: "ready",
      matchPersistence: "ready",
      refreshMode: "on_read",
    });
    expect(body.stats).toEqual({
      articleCount: 3,
      clientCount: 1,
      matchCount: 1,
      matchedClientCount: 1,
      unmatchedClientCount: 0,
    });
    expect(typeof body.lastRefreshedAt).toBe("string");
  });
});
