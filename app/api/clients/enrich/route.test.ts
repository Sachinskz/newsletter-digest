import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuthWithTokenExchange: vi.fn(),
}));

vi.mock("@/lib/auth-middleware", () => ({
  requireAuthWithTokenExchange: mocks.requireAuthWithTokenExchange,
}));

import { POST } from "./route";

describe("client enrich route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    mocks.requireAuthWithTokenExchange.mockResolvedValue({ apiToken: "agent-token" });
  });

  it("prefers Anthropic when ANTHROPIC_API_KEY is present", async () => {
    vi.resetModules();
    vi.stubEnv("ANTHROPIC_API_KEY", "anthropic-test-key");
    vi.stubEnv("ANTHROPIC_MODEL", "claude-test-model");

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          content: [
            {
              type: "text",
              text: "{\"name\":\"OpenAI\",\"sector\":\"Technology\",\"topics\":[\"AI agents\",\"enterprise adoption\",\"developer platforms\"],\"priorities\":\"Expand enterprise adoption and strengthen platform positioning.\",\"accountOwner\":\"Unassigned\",\"relationshipStage\":\"Prospect\",\"matchThreshold\":52,\"notes\":\"AI platform company tracking model launches and enterprise demand.\"}",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const { POST: anthropicPost } = await import("./route");
    const response = await anthropicPost(
      new NextRequest("http://localhost:3002/api/clients/enrich", {
        method: "POST",
        body: JSON.stringify({ source: "OpenAI" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.anthropic.com/v1/messages");
    expect(body.client.name).toBe("OpenAI");

    fetchMock.mockRestore();
    vi.unstubAllEnvs();
  });

  it("returns a fully populated client profile shape", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            content:
              "{\"name\":\"Goldman Sachs\",\"sector\":\"Financial services\",\"topics\":[\"capital markets\",\"wealth management\",\"AI adoption\"],\"priorities\":\"Protect margins while modernizing advisory and workflow systems.\",\"accountOwner\":\"Unassigned\",\"relationshipStage\":\"Prospect\",\"matchThreshold\":58,\"notes\":\"Large financial institution evaluating AI and workflow modernization.\"}",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    const response = await POST(
      new NextRequest("http://localhost:3002/api/clients/enrich", {
        method: "POST",
        body: JSON.stringify({ source: "Goldman Sachs" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.client).toEqual({
      name: "Goldman Sachs",
      sector: "Financial services",
      topics: ["capital markets", "wealth management", "AI adoption"],
      priorities: "Protect margins while modernizing advisory and workflow systems.",
      accountOwner: "Unassigned",
      relationshipStage: "Prospect",
      matchThreshold: 58,
      notes: "Large financial institution evaluating AI and workflow modernization.",
    });

    fetchMock.mockRestore();
  });

  it("fills sane defaults when the model omits optional profile fields", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            content:
              "{\"name\":\"OpenAI\",\"sector\":\"Technology\",\"topics\":[\"AI agents\",\"enterprise adoption\",\"developer platforms\"],\"notes\":\"AI platform company with strong interest in enterprise deployment.\"}",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    const response = await POST(
      new NextRequest("http://localhost:3002/api/clients/enrich", {
        method: "POST",
        body: JSON.stringify({ source: "OpenAI" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).toBe("Could not enrich client profile with LLM derivation");
    expect(body.details).toContain("All enrichment strategies failed");

    fetchMock.mockRestore();
  });

  it("returns 502 when all providers fail", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("provider unavailable"));

    const response = await POST(
      new NextRequest("http://localhost:3002/api/clients/enrich", {
        method: "POST",
        body: JSON.stringify({ source: "Mayo Clinic" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).toBe("Could not enrich client profile with LLM derivation");
    expect(body.details).toContain("provider unavailable");

    fetchMock.mockRestore();
  });
});
