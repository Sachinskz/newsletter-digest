import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuthWithTokenExchange: vi.fn(),
  ensureDataDocuments: vi.fn(),
  getGeneratedContentById: vi.fn(),
  getLinkedInConnection: vi.fn(),
  updateGeneratedContent: vi.fn(),
  updateLinkedInConnection: vi.fn(),
  updateLinkedInConnectionStatus: vi.fn(),
  decryptForUser: vi.fn(),
  createLinkedInTextPost: vi.fn(),
  tokenHasExpired: vi.fn(),
}));

vi.mock("@/lib/auth-middleware", () => ({
  requireAuthWithTokenExchange: mocks.requireAuthWithTokenExchange,
}));

vi.mock("@/lib/data-api-client", () => ({
  ensureDataDocuments: mocks.ensureDataDocuments,
  getGeneratedContentById: mocks.getGeneratedContentById,
  getLinkedInConnection: mocks.getLinkedInConnection,
  updateGeneratedContent: mocks.updateGeneratedContent,
  updateLinkedInConnection: mocks.updateLinkedInConnection,
  updateLinkedInConnectionStatus: mocks.updateLinkedInConnectionStatus,
}));

vi.mock("@/lib/keystore", () => ({
  decryptForUser: mocks.decryptForUser,
}));

vi.mock("@/lib/linkedin-api", () => ({
  createLinkedInTextPost: mocks.createLinkedInTextPost,
  tokenHasExpired: mocks.tokenHasExpired,
}));

import { POST } from "./route";

describe("publish linkedin route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuthWithTokenExchange.mockResolvedValue({
      apiToken: "data-token",
      ssoToken: "session-token",
      userId: "user-1",
    });
    mocks.ensureDataDocuments.mockResolvedValue({
      generatedContent: "generated-doc",
      linkedinConnections: "linkedin-doc",
    });
  });

  it("rejects unknown draft ids", async () => {
    mocks.getGeneratedContentById.mockResolvedValue(null);

    const response = await POST(new NextRequest("http://localhost:3002/api/content/draft-1/publish-linkedin", { method: "POST" }), {
      params: Promise.resolve({ id: "draft-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Generated draft not found");
  });

  it("rejects non-linkedin drafts", async () => {
    mocks.getGeneratedContentById.mockResolvedValue({
      id: "draft-1",
      kind: "email",
    });

    const response = await POST(new NextRequest("http://localhost:3002/api/content/draft-1/publish-linkedin", { method: "POST" }), {
      params: Promise.resolve({ id: "draft-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Only LinkedIn drafts can be published to LinkedIn");
  });

  it("rejects publishing without an active linkedin connection", async () => {
    mocks.getGeneratedContentById.mockResolvedValue({
      id: "draft-1",
      kind: "linkedin",
      body: "Hello LinkedIn",
    });
    mocks.getLinkedInConnection.mockResolvedValue(null);

    const response = await POST(new NextRequest("http://localhost:3002/api/content/draft-1/publish-linkedin", { method: "POST" }), {
      params: Promise.resolve({ id: "draft-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("LinkedIn account is not connected");
  });

  it("marks a linkedin draft published on success", async () => {
    const publishedDraft = {
      id: "draft-1",
      kind: "linkedin",
      body: "Hello LinkedIn",
      publishedAt: "2026-05-15T10:00:00.000Z",
      publishStatus: "published",
      externalPostId: "urn:li:share:123",
    };

    mocks.getGeneratedContentById.mockResolvedValue({
      id: "draft-1",
      kind: "linkedin",
      body: "Hello LinkedIn",
    });
    mocks.getLinkedInConnection.mockResolvedValue({
      memberId: "member-1",
      encryptedTokens: "ciphertext",
      tokenFileId: "file-1",
      status: "active",
    });
    mocks.decryptForUser.mockResolvedValue(JSON.stringify({
      access_token: "access-token",
      expires_at: "2999-01-01T00:00:00.000Z",
    }));
    mocks.tokenHasExpired.mockReturnValue(false);
    mocks.createLinkedInTextPost.mockResolvedValue({ postId: "urn:li:share:123" });
    mocks.updateGeneratedContent
      .mockResolvedValueOnce({
        id: "draft-1",
        kind: "linkedin",
        publishStatus: "publishing",
      })
      .mockResolvedValueOnce(publishedDraft);

    const response = await POST(new NextRequest("http://localhost:3002/api/content/draft-1/publish-linkedin", { method: "POST" }), {
      params: Promise.resolve({ id: "draft-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.externalPostId).toBe("urn:li:share:123");
    expect(body.content).toEqual(publishedDraft);
    expect(mocks.updateGeneratedContent).toHaveBeenLastCalledWith(
      "data-token",
      "generated-doc",
      "draft-1",
      expect.objectContaining({
        publishStatus: "published",
        externalPostId: "urn:li:share:123",
        publishedByUserId: "user-1",
      }),
    );
  });

  it("marks the draft failed when publish fails", async () => {
    mocks.getGeneratedContentById.mockResolvedValue({
      id: "draft-1",
      kind: "linkedin",
      body: "Hello LinkedIn",
    });
    mocks.getLinkedInConnection.mockResolvedValue({
      memberId: "member-1",
      encryptedTokens: "ciphertext",
      tokenFileId: "file-1",
      status: "active",
    });
    mocks.decryptForUser.mockResolvedValue(JSON.stringify({
      access_token: "access-token",
      expires_at: "2999-01-01T00:00:00.000Z",
    }));
    mocks.tokenHasExpired.mockReturnValue(false);
    mocks.createLinkedInTextPost.mockRejectedValue(new Error("LinkedIn rejected the post"));
    mocks.updateGeneratedContent
      .mockResolvedValueOnce({
        id: "draft-1",
        kind: "linkedin",
        publishStatus: "publishing",
      })
      .mockResolvedValueOnce({
        id: "draft-1",
        kind: "linkedin",
        publishStatus: "failed",
        publishError: "LinkedIn rejected the post",
      });

    const response = await POST(new NextRequest("http://localhost:3002/api/content/draft-1/publish-linkedin", { method: "POST" }), {
      params: Promise.resolve({ id: "draft-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).toBe("Failed to publish LinkedIn draft");
    expect(mocks.updateGeneratedContent).toHaveBeenLastCalledWith(
      "data-token",
      "generated-doc",
      "draft-1",
      expect.objectContaining({
        publishStatus: "failed",
        publishError: "LinkedIn rejected the post",
      }),
    );
  });
});
