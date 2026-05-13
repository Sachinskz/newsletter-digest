import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { proxy } from "@/proxy";

describe("dev server middleware", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("redirects direct internal port requests to the proxy port", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("TEST_SESSION_JWT", "token");
    vi.stubEnv("DEV_INTERNAL_PORT", "3099");
    vi.stubEnv("DEV_PROXY_PORT", "3002");

    const response = proxy(new NextRequest("http://localhost:3099/library"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3002/library");
  });

  it("normalizes the internal /home loop back to the proxy root", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("TEST_SESSION_JWT", "token");
    vi.stubEnv("DEV_INTERNAL_PORT", "3099");
    vi.stubEnv("DEV_PROXY_PORT", "3002");

    const response = proxy(
      new NextRequest("http://localhost:3099/home?returnUrl=http%3A%2F%2Flocalhost%3A3099%2Fhome&reason=session_expired"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3002/");
  });

  it("does not redirect requests that already came through the dev proxy", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("TEST_SESSION_JWT", "token");
    vi.stubEnv("DEV_INTERNAL_PORT", "3099");
    vi.stubEnv("DEV_PROXY_PORT", "3002");

    const request = new NextRequest("http://localhost:3099/library", {
      headers: { "x-busibox-dev-proxy": "1" },
    });

    const response = proxy(request);

    expect(response.status).toBe(200);
  });
});
