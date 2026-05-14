import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteRecords: vi.fn(),
  getNow: vi.fn(),
  insertRecords: vi.fn(),
  queryRecords: vi.fn(),
  updateRecords: vi.fn(),
}));

vi.mock("@jazzmind/busibox-app", () => ({
  deleteRecords: mocks.deleteRecords,
  ensureDocuments: vi.fn(),
  generateId: vi.fn(() => "generated-id"),
  getNow: mocks.getNow,
  insertRecords: mocks.insertRecords,
  queryRecords: mocks.queryRecords,
  updateRecords: mocks.updateRecords,
}));

import {
  DEFAULT_PREFERENCES_ID,
  createClientProfile,
  deleteClientProfile,
  deleteClientMatchesForClient,
  getPreferences,
  listClientMatches,
  listClientProfiles,
  replaceClientMatchesForClient,
  updateClientProfile,
  upsertPreferences,
} from "./data-api-client";

describe("preferences data helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getNow.mockReturnValue("2026-05-13T10:00:00.000Z");
  });

  it("returns null when no preferences exist", async () => {
    mocks.queryRecords.mockResolvedValue({ records: [] });

    await expect(getPreferences("token", "preferences-doc")).resolves.toBeNull();
  });

  it("creates preferences on first save", async () => {
    mocks.queryRecords.mockResolvedValue({ records: [] });

    const preferences = await upsertPreferences("token", "preferences-doc", "key_insights");

    expect(preferences).toEqual({
      id: DEFAULT_PREFERENCES_ID,
      summaryFormat: "key_insights",
      createdAt: "2026-05-13T10:00:00.000Z",
      updatedAt: "2026-05-13T10:00:00.000Z",
    });
    expect(mocks.insertRecords).toHaveBeenCalledWith("token", "preferences-doc", [preferences]);
    expect(mocks.updateRecords).not.toHaveBeenCalled();
  });

  it("updates existing preferences while preserving createdAt", async () => {
    mocks.queryRecords.mockResolvedValue({
      records: [
        {
          id: DEFAULT_PREFERENCES_ID,
          summaryFormat: "bullet_points",
          createdAt: "2026-05-12T10:00:00.000Z",
          updatedAt: "2026-05-12T10:00:00.000Z",
        },
      ],
    });

    const preferences = await upsertPreferences("token", "preferences-doc", "full_digest");

    expect(preferences.createdAt).toBe("2026-05-12T10:00:00.000Z");
    expect(preferences.summaryFormat).toBe("full_digest");
    expect(mocks.updateRecords).toHaveBeenCalled();
    expect(mocks.insertRecords).not.toHaveBeenCalled();
  });
});

describe("client profile data helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getNow.mockReturnValue("2026-05-14T09:30:00.000Z");
  });

  it("lists client profiles and parses topics JSON", async () => {
    mocks.queryRecords.mockResolvedValue({
      records: [
        {
          id: "client-1",
          name: "Harbor Capital",
          sector: "Financial services",
          topics: JSON.stringify(["agents", "compliance"]),
          priorities: "Improve internal workflows",
          createdAt: "2026-05-13T10:00:00.000Z",
          updatedAt: "2026-05-13T10:00:00.000Z",
        },
      ],
    });

    await expect(listClientProfiles("token", "clients-doc")).resolves.toEqual([
      {
        id: "client-1",
        name: "Harbor Capital",
        sector: "Financial services",
        topics: ["agents", "compliance"],
        priorities: "Improve internal workflows",
        createdAt: "2026-05-13T10:00:00.000Z",
        updatedAt: "2026-05-13T10:00:00.000Z",
      },
    ]);
  });

  it("creates a client profile with timestamps", async () => {
    const client = await createClientProfile("token", "clients-doc", {
      name: "North Channel",
      sector: "Industrial",
      topics: ["automation", "on-prem"],
      priorities: "Reduce process latency",
      accountOwner: "Avery",
      matchThreshold: 55,
    });

    expect(client).toEqual({
      id: "generated-id",
      name: "North Channel",
      sector: "Industrial",
      topics: ["automation", "on-prem"],
      priorities: "Reduce process latency",
      accountOwner: "Avery",
      matchThreshold: 55,
      createdAt: "2026-05-14T09:30:00.000Z",
      updatedAt: "2026-05-14T09:30:00.000Z",
    });
    expect(mocks.insertRecords).toHaveBeenCalledWith("token", "clients-doc", [
      {
        ...client,
        topics: JSON.stringify(["automation", "on-prem"]),
      },
    ]);
  });

  it("updates a client profile and reserializes topics", async () => {
    mocks.queryRecords.mockResolvedValue({
      records: [
        {
          id: "client-2",
          name: "Blue Harbor",
          sector: "Logistics",
          topics: JSON.stringify(["workflow"]),
          priorities: "Improve handoffs",
          createdAt: "2026-05-13T10:00:00.000Z",
          updatedAt: "2026-05-13T10:00:00.000Z",
        },
      ],
    });

    const updated = await updateClientProfile("token", "clients-doc", "client-2", {
      topics: ["workflow", "agents"],
      priorities: "Improve handoffs and automate intake",
    });

    expect(updated?.topics).toEqual(["workflow", "agents"]);
    expect(updated?.updatedAt).toBe("2026-05-14T09:30:00.000Z");
    expect(mocks.updateRecords).toHaveBeenCalledWith(
      "token",
      "clients-doc",
      expect.objectContaining({
        topics: JSON.stringify(["workflow", "agents"]),
        priorities: "Improve handoffs and automate intake",
      }),
      { field: "id", op: "eq", value: "client-2" },
    );
  });

  it("deletes a client profile by id", async () => {
    await deleteClientProfile("token", "clients-doc", "client-3");

    expect(mocks.deleteRecords).toHaveBeenCalledWith("token", "clients-doc", {
      field: "id",
      op: "eq",
      value: "client-3",
    });
  });

  it("lists stored client matches and parses article metadata arrays", async () => {
    mocks.queryRecords.mockResolvedValue({
      records: [
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
          articleCompanies: JSON.stringify(["OpenAI"]),
          articleTopics: JSON.stringify(["agents", "governance"]),
          score: 84,
          reason: "Strong overlap on agents and governance.",
          matchedAt: "2026-05-14T09:30:00.000Z",
        },
      ],
    });

    await expect(listClientMatches("token", "matches-doc")).resolves.toEqual([
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
        articleTopics: ["agents", "governance"],
        score: 84,
        reason: "Strong overlap on agents and governance.",
        matchedAt: "2026-05-14T09:30:00.000Z",
      },
    ]);
  });

  it("replaces client matches by clearing old records and inserting serialized snapshots", async () => {
    await replaceClientMatchesForClient("token", "matches-doc", "client-1", [
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
        articleTopics: ["agents", "governance"],
        score: 84,
        reason: "Strong overlap on agents and governance.",
        matchedAt: "2026-05-14T09:30:00.000Z",
      },
    ]);

    expect(mocks.deleteRecords).toHaveBeenCalledWith("token", "matches-doc", {
      field: "clientId",
      op: "eq",
      value: "client-1",
    });
    expect(mocks.insertRecords).toHaveBeenCalledWith("token", "matches-doc", [
      expect.objectContaining({
        id: "generated-id",
        articleCompanies: JSON.stringify(["OpenAI"]),
        articleTopics: JSON.stringify(["agents", "governance"]),
      }),
    ]);
  });

  it("deletes all stored matches for a client", async () => {
    await deleteClientMatchesForClient("token", "matches-doc", "client-3");

    expect(mocks.deleteRecords).toHaveBeenCalledWith("token", "matches-doc", {
      field: "clientId",
      op: "eq",
      value: "client-3",
    });
  });
});
