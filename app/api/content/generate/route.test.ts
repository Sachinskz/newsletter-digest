import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuthWithTokenExchange: vi.fn(),
  createGeneratedContent: vi.fn(),
  ensureDataDocuments: vi.fn(),
}));

vi.mock("@/lib/auth-middleware", () => ({
  requireAuthWithTokenExchange: mocks.requireAuthWithTokenExchange,
}));

vi.mock("@/lib/data-api-client", () => ({
  createGeneratedContent: mocks.createGeneratedContent,
  ensureDataDocuments: mocks.ensureDataDocuments,
}));

import { POST } from "./route";

const article = {
  id: "article-1",
  title: "AI agents enter workflows",
  source: "AI Daily",
  category: "Agents",
  summary: "Agents are entering workflows.",
  why: "Operators need governed systems.",
  importance: 91,
  novelty: 78,
  urgency: 82,
  companies: ["OpenAI"],
  topics: ["agents"],
  receivedAt: "2026-05-13T10:00:00.000Z",
};

describe("content generate route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects client email generation without a client", async () => {
    mocks.requireAuthWithTokenExchange.mockResolvedValue({ apiToken: "token" });

    const response = await POST(
      new NextRequest("http://localhost:3002/api/content/generate", {
        method: "POST",
        body: JSON.stringify({ article, kind: "email", tone: "Analytical" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Client email generation requires a client");
    expect(mocks.createGeneratedContent).not.toHaveBeenCalled();
  });

  it("invokes the content agent and persists generated content", async () => {
    const output = {
      title: "LinkedIn draft",
      subject: "",
      body: "A useful LinkedIn post.",
      notes: "Review for specificity.",
    };
    // Use mockImplementation so each fetch call gets a fresh (unconsumed) Response.
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify({ status: "succeeded", output: { result: JSON.stringify(output).replace(/^\{/, "") } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    mocks.requireAuthWithTokenExchange
      .mockResolvedValueOnce({ apiToken: "agent-token" })
      .mockResolvedValueOnce({ apiToken: "data-token" });
    mocks.ensureDataDocuments.mockResolvedValue({ generatedContent: "generated-doc" });
    mocks.createGeneratedContent.mockResolvedValue({ id: "content-1", ...output });

    const response = await POST(
      new NextRequest("http://localhost:3002/api/content/generate", {
        method: "POST",
        body: JSON.stringify({ article, kind: "linkedin", tone: "Analytical" }),
      }),
    );

    expect(response.status).toBe(200);
    const agentBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    expect(agentBody.agent_name).toBe("content-generator");
    expect(agentBody.input.prompt).toContain("LinkedIn post");
    expect(mocks.createGeneratedContent).toHaveBeenCalledWith("data-token", "generated-doc", expect.objectContaining({
      articleId: "article-1",
      kind: "linkedin",
      output,
    }));
    fetchMock.mockRestore();
  });
});
