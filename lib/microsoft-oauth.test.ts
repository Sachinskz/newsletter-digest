import { describe, expect, it } from "vitest";
import { buildAuthorizeUrl, createCodeChallenge, generatePkceVerifier, generateState } from "./microsoft-oauth";

describe("microsoft oauth helpers", () => {
  it("generates url-safe PKCE verifier and state values", () => {
    expect(generatePkceVerifier()).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    expect(generateState()).toMatch(/^[A-Za-z0-9_-]{32,128}$/);
  });

  it("creates the RFC 7636 S256 challenge for a known verifier", () => {
    expect(createCodeChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });

  it("builds a Microsoft authorize URL with the required scopes and PKCE parameters", () => {
    const url = new URL(
      buildAuthorizeUrl({
        clientId: "client-id",
        redirectUri: "http://localhost:3002/api/oauth/callback",
        codeChallenge: "challenge",
        state: "state",
      }),
    );

    expect(url.hostname).toBe("login.microsoftonline.com");
    expect(url.pathname).toBe("/organizations/oauth2/v2.0/authorize");
    expect(url.searchParams.get("client_id")).toBe("client-id");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("offline_access User.Read Mail.Read");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe("challenge");
    expect(url.searchParams.get("state")).toBe("state");
  });

  it("can force the prototype mailbox account selection", () => {
    const url = new URL(
      buildAuthorizeUrl({
        clientId: "client-id",
        redirectUri: "http://localhost:3002/api/oauth/callback",
        codeChallenge: "challenge",
        state: "state",
        loginHint: "newsletters@maigent.ai",
        prompt: "login",
        domainHint: "organizations",
      }),
    );

    expect(url.searchParams.get("login_hint")).toBe("newsletters@maigent.ai");
    expect(url.searchParams.get("prompt")).toBe("login");
    expect(url.searchParams.get("domain_hint")).toBe("organizations");
  });
});
