import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildLinkedInAuthorizeUrl,
  exchangeLinkedInCodeForTokens,
  generateLinkedInState,
  getLinkedInConfig,
} from "./linkedin-oauth";

describe("linkedin oauth helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.LINKEDIN_CLIENT_ID;
    delete process.env.LINKEDIN_CLIENT_SECRET;
    delete process.env.LINKEDIN_REDIRECT_URI;
  });

  it("builds an authorize url with required scopes", () => {
    const url = new URL(buildLinkedInAuthorizeUrl({
      clientId: "client-id",
      redirectUri: "http://localhost:3002/api/linkedin/callback",
      state: "state-123",
      prompt: "login",
    }));

    expect(url.origin).toBe("https://www.linkedin.com");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("client-id");
    expect(url.searchParams.get("state")).toBe("state-123");
    expect(url.searchParams.get("scope")).toContain("openid");
    expect(url.searchParams.get("scope")).toContain("profile");
    expect(url.searchParams.get("scope")).toContain("email");
    expect(url.searchParams.get("scope")).toContain("w_member_social");
    expect(url.searchParams.get("prompt")).toBe("login");
  });

  it("exchanges code for tokens using form encoding", async () => {
    process.env.LINKEDIN_CLIENT_ID = "client-id";
    process.env.LINKEDIN_CLIENT_SECRET = "client-secret";
    process.env.LINKEDIN_REDIRECT_URI = "http://localhost:3002/api/linkedin/callback";

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "access-token",
          expires_in: 3600,
          token_type: "Bearer",
          scope: "openid profile email w_member_social",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const tokens = await exchangeLinkedInCodeForTokens({ code: "auth-code" });
    const body = String(fetchMock.mock.calls[0]?.[1]?.body);

    expect(body).toContain("grant_type=authorization_code");
    expect(body).toContain("code=auth-code");
    expect(body).toContain("client_id=client-id");
    expect(body).toContain("client_secret=client-secret");
    expect(tokens.access_token).toBe("access-token");
    expect(tokens.expires_at).toMatch(/T/);
  });

  it("loads config from environment", () => {
    process.env.LINKEDIN_CLIENT_ID = "client-id";
    process.env.LINKEDIN_CLIENT_SECRET = "client-secret";
    process.env.LINKEDIN_REDIRECT_URI = "http://localhost:3002/api/linkedin/callback";

    expect(getLinkedInConfig()).toEqual({
      clientId: "client-id",
      clientSecret: "client-secret",
      redirectUri: "http://localhost:3002/api/linkedin/callback",
    });
  });

  it("generates a non-empty oauth state", () => {
    expect(generateLinkedInState().length).toBeGreaterThan(20);
  });
});
