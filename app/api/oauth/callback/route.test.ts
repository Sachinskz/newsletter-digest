import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuthWithTokenExchange: vi.fn(),
  ensureDataDocuments: vi.fn(),
  upsertConnection: vi.fn(),
  exchangeCodeForTokens: vi.fn(),
  getMicrosoftProfile: vi.fn(),
  encryptForUser: vi.fn(),
  tokenFileIdForConnection: vi.fn(),
}));

vi.mock("@/lib/auth-middleware", () => ({
  requireAuthWithTokenExchange: mocks.requireAuthWithTokenExchange,
}));

vi.mock("@/lib/data-api-client", () => ({
  DEFAULT_CONNECTION_ID: "microsoft-primary",
  ensureDataDocuments: mocks.ensureDataDocuments,
  upsertConnection: mocks.upsertConnection,
}));

vi.mock("@/lib/microsoft-oauth", () => ({
  exchangeCodeForTokens: mocks.exchangeCodeForTokens,
}));

vi.mock("@/lib/microsoft-graph", () => ({
  getMicrosoftProfile: mocks.getMicrosoftProfile,
}));

vi.mock("@/lib/keystore", () => ({
  encryptForUser: mocks.encryptForUser,
  tokenFileIdForConnection: mocks.tokenFileIdForConnection,
}));

import { GET } from "./route";

describe("oauth callback route", () => {
  it("rejects missing or invalid oauth state before storing tokens", async () => {
    mocks.requireAuthWithTokenExchange.mockResolvedValue({
      apiToken: "data-token",
      ssoToken: "session-token",
      userId: "user-1",
    });

    const request = new NextRequest("http://localhost:3002/api/oauth/callback?code=abc&state=actual", {
      headers: {
        cookie: "newsletter_oauth_state=expected; newsletter_oauth_verifier=verifier",
      },
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid OAuth callback state");
    expect(mocks.exchangeCodeForTokens).not.toHaveBeenCalled();
    expect(mocks.upsertConnection).not.toHaveBeenCalled();
  });
});
