import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuthWithTokenExchange: vi.fn(),
  ensureDataDocuments: vi.fn(),
  getPreferences: vi.fn(),
  upsertPreferences: vi.fn(),
}));

vi.mock("@/lib/auth-middleware", () => ({
  requireAuthWithTokenExchange: mocks.requireAuthWithTokenExchange,
}));

vi.mock("@/lib/data-api-client", () => ({
  ensureDataDocuments: mocks.ensureDataDocuments,
  getPreferences: mocks.getPreferences,
  upsertPreferences: mocks.upsertPreferences,
}));

import { GET, PUT } from "./route";

describe("preferences route", () => {
  it("returns default format when no preferences exist", async () => {
    mocks.requireAuthWithTokenExchange.mockResolvedValue({ apiToken: "token" });
    mocks.ensureDataDocuments.mockResolvedValue({ preferences: "preferences-doc" });
    mocks.getPreferences.mockResolvedValue(null);

    const response = await GET(new NextRequest("http://localhost:3002/api/preferences"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.hasPreferences).toBe(false);
    expect(body.summaryFormat).toBe("bullet_points");
  });

  it("rejects invalid formats", async () => {
    mocks.requireAuthWithTokenExchange.mockResolvedValue({ apiToken: "token" });

    const response = await PUT(
      new NextRequest("http://localhost:3002/api/preferences", {
        method: "PUT",
        body: JSON.stringify({ summaryFormat: "bad_format" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid summary format");
    expect(mocks.upsertPreferences).not.toHaveBeenCalled();
  });

  it("saves a valid format", async () => {
    mocks.requireAuthWithTokenExchange.mockResolvedValue({ apiToken: "token" });
    mocks.ensureDataDocuments.mockResolvedValue({ preferences: "preferences-doc" });
    mocks.upsertPreferences.mockResolvedValue({
      id: "summary-format",
      summaryFormat: "executive_summary",
      createdAt: "now",
      updatedAt: "now",
    });

    const response = await PUT(
      new NextRequest("http://localhost:3002/api/preferences", {
        method: "PUT",
        body: JSON.stringify({ summaryFormat: "executive_summary" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.hasPreferences).toBe(true);
    expect(body.summaryFormat).toBe("executive_summary");
    expect(mocks.upsertPreferences).toHaveBeenCalledWith("token", "preferences-doc", "executive_summary");
  });
});
