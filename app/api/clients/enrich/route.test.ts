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
    mocks.requireAuthWithTokenExchange.mockResolvedValue({ apiToken: "agent-token" });
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

    expect(response.status).toBe(200);
    expect(body.client.priorities).toContain("Track material AI");
    expect(body.client.accountOwner).toBe("Unassigned");
    expect(body.client.relationshipStage).toBe("Prospect");
    expect(body.client.matchThreshold).toBe(42);

    fetchMock.mockRestore();
  });

  it("falls back to a deterministic company profile when providers fail", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("provider unavailable"));

    const response = await POST(
      new NextRequest("http://localhost:3002/api/clients/enrich", {
        method: "POST",
        body: JSON.stringify({ source: "Mayo Clinic" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.fallback).toBe(true);
    expect(body.client).toEqual(
      expect.objectContaining({
        name: "Mayo Clinic",
        sector: "Healthcare",
        accountOwner: "Unassigned",
        relationshipStage: "Prospect",
      }),
    );
    expect(body.client.topics).toContain("clinical operations");
    expect(body.client.matchThreshold).toBeGreaterThanOrEqual(0);

    fetchMock.mockRestore();
  });
});
