import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuthWithTokenExchange: vi.fn(),
  ensureDataDocuments: vi.fn(),
  upsertLinkedInConnection: vi.fn(),
  exchangeLinkedInCodeForTokens: vi.fn(),
  getLinkedInProfile: vi.fn(),
  encryptForUser: vi.fn(),
  tokenFileIdForConnection: vi.fn(),
}));

vi.mock("@/lib/auth-middleware", () => ({
  requireAuthWithTokenExchange: mocks.requireAuthWithTokenExchange,
}));

vi.mock("@/lib/data-api-client", () => ({
  DEFAULT_LINKEDIN_CONNECTION_ID: "linkedin-primary",
  ensureDataDocuments: mocks.ensureDataDocuments,
  upsertLinkedInConnection: mocks.upsertLinkedInConnection,
}));

vi.mock("@/lib/linkedin-oauth", () => ({
  exchangeLinkedInCodeForTokens: mocks.exchangeLinkedInCodeForTokens,
}));

vi.mock("@/lib/linkedin-api", () => ({
  getLinkedInProfile: mocks.getLinkedInProfile,
}));

vi.mock("@/lib/keystore", () => ({
  encryptForUser: mocks.encryptForUser,
  tokenFileIdForConnection: mocks.tokenFileIdForConnection,
}));

import { GET } from "./route";

describe("linkedin oauth callback route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects missing or invalid oauth state before storing tokens", async () => {
    mocks.requireAuthWithTokenExchange.mockResolvedValue({
      apiToken: "data-token",
      ssoToken: "session-token",
      userId: "user-1",
    });

    const request = new NextRequest("http://localhost:3002/api/linkedin/callback?code=abc&state=actual", {
      headers: {
        cookie: "linkedin_oauth_state=expected",
      },
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid LinkedIn OAuth callback state");
    expect(mocks.exchangeLinkedInCodeForTokens).not.toHaveBeenCalled();
    expect(mocks.upsertLinkedInConnection).not.toHaveBeenCalled();
  });

  it("stores encrypted tokens and linkedin connection metadata on success", async () => {
    mocks.requireAuthWithTokenExchange.mockResolvedValue({
      apiToken: "data-token",
      ssoToken: "session-token",
      userId: "user-1",
    });
    mocks.exchangeLinkedInCodeForTokens.mockResolvedValue({
      access_token: "linkedin-token",
      expires_at: "2026-05-16T10:00:00.000Z",
    });
    mocks.getLinkedInProfile.mockResolvedValue({
      sub: "member-1",
      name: "Sachin",
      email: "sachin@example.com",
    });
    mocks.ensureDataDocuments.mockResolvedValue({ linkedinConnections: "linkedin-doc" });
    mocks.tokenFileIdForConnection.mockReturnValue("file-123");
    mocks.encryptForUser.mockResolvedValue("encrypted-token");

    const request = new NextRequest("http://localhost:3002/api/linkedin/callback?code=abc&state=expected", {
      headers: {
        cookie: "linkedin_oauth_state=expected",
      },
    });

    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/settings?linkedin=connected");
    expect(mocks.upsertLinkedInConnection).toHaveBeenCalledWith(
      "data-token",
      "linkedin-doc",
      expect.objectContaining({
        memberId: "member-1",
        memberName: "Sachin",
        memberEmail: "sachin@example.com",
        tokenFileId: "file-123",
        encryptedTokens: "encrypted-token",
        status: "active",
      }),
    );
  });
});
