import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuthWithTokenExchange: vi.fn(),
  ensureDataDocuments: vi.fn(),
  getLinkedInConnection: vi.fn(),
}));

vi.mock("@/lib/auth-middleware", () => ({
  requireAuthWithTokenExchange: mocks.requireAuthWithTokenExchange,
}));

vi.mock("@/lib/data-api-client", () => ({
  ensureDataDocuments: mocks.ensureDataDocuments,
  getLinkedInConnection: mocks.getLinkedInConnection,
}));

import { GET } from "./route";

describe("linkedin status route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuthWithTokenExchange.mockResolvedValue({ apiToken: "token" });
    mocks.ensureDataDocuments.mockResolvedValue({ linkedinConnections: "linkedin-doc" });
  });

  it("returns disconnected when no linkedin connection exists", async () => {
    mocks.getLinkedInConnection.mockResolvedValue(null);

    const response = await GET(new NextRequest("http://localhost:3002/api/linkedin/status"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ connected: false });
  });
});
